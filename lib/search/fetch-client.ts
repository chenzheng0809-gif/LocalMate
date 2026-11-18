import dns from "node:dns/promises";
import { isIP } from "node:net";
import * as cheerio from "cheerio";
import { config } from "@/lib/config";
import type { CacheRepository } from "@/lib/repositories/cache-repository";
import type { FetchResult } from "@/lib/search/types";
import {
  isObviouslyBlockedHost,
  isValidPublicIp,
  sanitizeSourceUrl,
} from "@/lib/search/source-validator";

export interface FetchClientOptions {
  timeoutMs: number;
  maxBytes: number;
  maxChars: number;
  userAgent: string;
  cache?: CacheRepository;
  cacheTtlMs?: number;
}

export interface FetchClient {
  fetchPage(
    url: string,
    options?: { signal?: AbortSignal; cache?: boolean; headers?: Record<string, string> },
  ): Promise<FetchResult>;
  fetchJson<T>(
    url: string,
    options?: { signal?: AbortSignal; headers?: Record<string, string> },
  ): Promise<{ ok: boolean; status: number; data: T | null; error: string | null; url: string }>;
}

const MAX_REDIRECTS = 4;

async function assertPublicHostname(hostname: string): Promise<void> {
  if (isObviouslyBlockedHost(hostname)) {
    throw new Error("Blocked hostname (private, local, or metadata endpoint).");
  }
  if (isIP(hostname)) {
    if (!isValidPublicIp(hostname)) throw new Error("Blocked private IP address.");
    return;
  }
  const records = await dns.lookup(hostname, { all: true, verbatim: true });
  if (records.length === 0) throw new Error("Hostname did not resolve.");
  for (const record of records) {
    if (!isValidPublicIp(record.address)) {
      throw new Error(`Blocked DNS resolution to private address (${record.address}).`);
    }
  }
}

function detectCharset(contentType: string | null, bytes: Uint8Array): string {
  const fromHeader = contentType?.match(/charset=["']?([^;"'\s]+)/i)?.[1];
  if (fromHeader) return fromHeader.toLowerCase();
  const head = new TextDecoder("latin1").decode(bytes.slice(0, 4096));
  const fromMeta =
    head.match(/<meta[^>]+charset=["']?([^"'\s/>]+)/i)?.[1] ??
    head.match(/<meta[^>]+content=["'][^"']*charset=([^"'\s;]+)/i)?.[1];
  return fromMeta?.toLowerCase() ?? "utf-8";
}

function decodeBytes(bytes: Uint8Array, contentType: string | null): string {
  const charset = detectCharset(contentType, bytes);
  const normalized = charset === "gb2312" ? "gbk" : charset === "utf8" ? "utf-8" : charset;
  try {
    return new TextDecoder(normalized).decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

export function extractReadableText(html: string, maxChars: number): { title: string | null; text: string } {
  const $ = cheerio.load(html);
  const title = $("title").first().text().trim() || null;
  $("script, style, noscript, svg, iframe, canvas, form, button, nav, footer, header").remove();
  const candidates = ["main", "article", "[role='main']", "#main-content", "#content", ".content"];
  let selected = "body";
  for (const selector of candidates) {
    const candidate = $(selector).first();
    if (candidate.length && candidate.text().trim().length > 500) {
      selected = selector;
      break;
    }
  }
  const text = $(selected).first()
    .text()
    .replace(/\u00a0/g, " ")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, maxChars);
  return { title, text };
}

export function createFetchClient(options: FetchClientOptions): FetchClient {
  const {
    timeoutMs,
    maxBytes,
    maxChars,
    userAgent,
    cache,
    cacheTtlMs = 24 * 60 * 60 * 1000,
  } = options;

  async function fetchPage(
    rawUrl: string,
    fetchOptions: { signal?: AbortSignal; cache?: boolean; headers?: Record<string, string> } = {},
  ): Promise<FetchResult> {
    const sanitized = sanitizeSourceUrl(rawUrl);
    const fetchedAt = new Date().toISOString();
    if (!sanitized) {
      return {
        ok: false,
        url: rawUrl,
        finalUrl: rawUrl,
        status: 0,
        title: null,
        text: "",
        html: null,
        contentType: null,
        bytes: 0,
        fetchedAt,
        cached: false,
        error: "INVALID_URL",
      };
    }

    const useCache = fetchOptions.cache !== false && !fetchOptions.headers;
    if (useCache && cache) {
      const cached = cache.getFetch(sanitized);
      if (cached) {
        return {
          ok: cached.status >= 200 && cached.status < 300,
          url: sanitized,
          finalUrl: sanitized,
          status: cached.status,
          title: cached.contentTitle,
          text: cached.contentText,
          html: null,
          contentType: null,
          bytes: cached.contentText.length,
          fetchedAt: cached.fetchedAt,
          cached: true,
          error: cached.error,
        };
      }
    }

    let currentUrl = sanitized;
    try {
      for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
        const parsed = new URL(currentUrl);
        await assertPublicHostname(parsed.hostname);

        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), timeoutMs);
        const signal = fetchOptions.signal
          ? AbortSignal.any([controller.signal, fetchOptions.signal])
          : controller.signal;

        let response: Response;
        try {
          response = await fetch(currentUrl, {
            redirect: "manual",
            signal,
            headers: {
              "User-Agent": userAgent,
              Accept: "text/html,application/xhtml+xml,application/json;q=0.9,text/plain;q=0.8",
              "Accept-Language": "en-US,en;q=0.8",
              ...fetchOptions.headers,
            },
          });
        } finally {
          clearTimeout(timer);
        }

        if ([301, 302, 303, 307, 308].includes(response.status)) {
          const location = response.headers.get("location");
          if (!location) throw new Error(`Redirect ${response.status} without a Location header.`);
          const next = new URL(location, currentUrl).toString();
          const nextSanitized = sanitizeSourceUrl(next);
          if (!nextSanitized) throw new Error("Redirect target was invalid or unsafe.");
          currentUrl = nextSanitized;
          continue;
        }

        const contentType = response.headers.get("content-type");
        const reader = response.body?.getReader();
        const chunks: Uint8Array[] = [];
        let total = 0;
        if (reader) {
          while (total < maxBytes) {
            const { done, value } = await reader.read();
            if (done) break;
            if (value) {
              chunks.push(value);
              total += value.byteLength;
            }
          }
          if (total >= maxBytes) {
            await reader.cancel().catch(() => undefined);
          }
        }
        const bytes = Buffer.concat(chunks.map((chunk) => Buffer.from(chunk))).subarray(0, maxBytes);
        const raw = decodeBytes(bytes, contentType);
        const isHtml = (contentType ?? "").includes("html") || /<html|<body/i.test(raw.slice(0, 500));
        const isJson = (contentType ?? "").includes("json");
        let title: string | null = null;
        let text = "";
        let html: string | null = null;

        if (isJson) {
          try {
            text = JSON.stringify(JSON.parse(raw), null, 2).slice(0, maxChars);
          } catch {
            text = raw.slice(0, maxChars);
          }
        } else if (isHtml) {
          html = raw;
          const extracted = extractReadableText(raw, maxChars);
          title = extracted.title;
          text = extracted.text;
        } else {
          text = raw.slice(0, maxChars);
        }

        const result: FetchResult = {
          ok: response.ok,
          url: sanitized,
          finalUrl: currentUrl,
          status: response.status,
          title,
          text,
          html,
          contentType,
          bytes: total,
          fetchedAt,
          cached: false,
          error: response.ok ? null : `HTTP_${response.status}`,
        };

        if (cache && response.ok && useCache) {
          cache.setFetch({
            url: sanitized,
            status: response.status,
            contentText: text,
            contentTitle: title,
            fetchedAt,
            expiresAt: new Date(Date.now() + cacheTtlMs).toISOString(),
            error: null,
          });
        }
        return result;
      }

      throw new Error("Too many redirects.");
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        ok: false,
        url: sanitized,
        finalUrl: currentUrl,
        status: 0,
        title: null,
        text: "",
        html: null,
        contentType: null,
        bytes: 0,
        fetchedAt,
        cached: false,
        error: /abort/i.test(message) ? "FETCH_TIMEOUT" : message,
      };
    }
  }

  async function fetchJson<T>(
    rawUrl: string,
    fetchOptions: { signal?: AbortSignal; headers?: Record<string, string> } = {},
  ): Promise<{ ok: boolean; status: number; data: T | null; error: string | null; url: string }> {
    const sanitized = sanitizeSourceUrl(rawUrl);
    if (!sanitized) {
      return { ok: false, status: 0, data: null, error: "INVALID_URL", url: rawUrl };
    }
    try {
      const parsed = new URL(sanitized);
      await assertPublicHostname(parsed.hostname);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      const signal = fetchOptions.signal
        ? AbortSignal.any([controller.signal, fetchOptions.signal])
        : controller.signal;
      try {
        const response = await fetch(sanitized, {
          signal,
          headers: {
            "User-Agent": userAgent,
            Accept: "application/json,text/plain;q=0.9",
            ...fetchOptions.headers,
          },
        });
        const text = (await response.text()).slice(0, maxBytes);
        if (!response.ok) {
          return {
            ok: false,
            status: response.status,
            data: null,
            error: `HTTP_${response.status}`,
            url: sanitized,
          };
        }
        return {
          ok: true,
          status: response.status,
          data: JSON.parse(text) as T,
          error: null,
          url: sanitized,
        };
      } finally {
        clearTimeout(timer);
      }
    } catch (error) {
      return {
        ok: false,
        status: 0,
        data: null,
        error: error instanceof Error ? error.message : String(error),
        url: sanitized,
      };
    }
  }

  return { fetchPage, fetchJson };
}

let singleton: FetchClient | null = null;

export function getFetchClient(cache?: CacheRepository): FetchClient {
  if (!singleton) {
    singleton = createFetchClient({
      timeoutMs: config.fetch.timeoutMs,
      maxBytes: config.fetch.maxBytes,
      maxChars: config.fetch.maxChars,
      userAgent: config.fetch.userAgent,
      cacheTtlMs: config.fetch.cacheTtlMs,
      cache,
    });
  }
  return singleton;
}

export function setFetchClient(client: FetchClient | null): void {
  singleton = client;
}