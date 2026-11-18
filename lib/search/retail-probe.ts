import * as cheerio from "cheerio";
import type { Country } from "@/types/domain";
import { COUNTRY_META } from "@/types/domain";
import type { FetchClient } from "@/lib/search/fetch-client";
import type { SearchResult } from "@/lib/search/types";
import { parseMoney } from "@/lib/utils/money";

export interface RetailProbeResult {
  results: SearchResult[];
  warnings: string[];
  attemptedSources: string[];
}

interface ProbeOptions {
  country: Country;
  query: string;
  seedUrls?: string[];
  maxResults?: number;
  signal?: AbortSignal;
}

const AMAZON_HEADERS: Record<Country, Record<string, string>> = {
  US: {
    "Accept-Language": "en-US,en;q=0.9",
    Cookie: "i18n-prefs=USD; lc-main=en_US",
  },
  DE: {
    "Accept-Language": "de-DE,de;q=0.9,en;q=0.8",
    Cookie: "i18n-prefs=EUR; lc-main=de_DE",
  },
  UK: {
    "Accept-Language": "en-GB,en;q=0.9",
    Cookie: "i18n-prefs=GBP; lc-main=en_GB",
  },
  JP: {
    "Accept-Language": "ja-JP,ja;q=0.9",
    Cookie: "i18n-prefs=JPY; lc-main=ja_JP",
  },
};

const BROWSER_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36";

const cache = new Map<string, { expiresAt: number; value: RetailProbeResult }>();
const CACHE_TTL_MS = 30 * 60 * 1000;

function currencyFor(country: Country): string {
  return COUNTRY_META[country].currency;
}

function parseRating(text: string): number | null {
  const normalized = text.replace(",", ".");
  const match = normalized.match(/([0-5](?:\.\d)?)\s*(?:out of 5|von 5|\/5|つ星|星)/i);
  if (match) return Number(match[1]);
  const fallback = normalized.match(/^([0-5](?:\.\d)?)$/);
  return fallback ? Number(fallback[1]) : null;
}

function parseReviewCount(text: string): number | null {
  const normalized = text.replace(/[^\d,.]/g, "");
  if (!normalized) return null;
  const digits = normalized.replace(/[.,]/g, "");
  const value = Number(digits);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

export function parseIkeaProduct(
  html: string,
  url: string,
  country: Country,
): SearchResult | null {
  const $ = cheerio.load(html);
  const scripts = $('script[type="application/ld+json"]')
    .map((_, el) => $(el).text())
    .get();

  const candidates: unknown[] = [];
  for (const raw of scripts) {
    try {
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (Array.isArray((parsed as { "@graph"?: unknown[] })["@graph"])) {
        candidates.push(...((parsed as { "@graph": unknown[] })["@graph"]));
      } else {
        candidates.push(parsed);
      }
    } catch {
      // ignore malformed JSON-LD
    }
  }

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") continue;
    const product = candidate as Record<string, unknown>;
    if (product["@type"] !== "Product") continue;
    const name = typeof product.name === "string" ? product.name.trim() : "";
    if (!name) continue;
    const offers = product.offers as Record<string, unknown> | Array<Record<string, unknown>> | undefined;
    const offerList = Array.isArray(offers) ? offers : offers ? [offers] : [];
    let price: number | null = null;
    let currency: string | null = null;
    for (const offer of offerList) {
      const specs = offer.priceSpecification;
      const specList = Array.isArray(specs) ? specs : specs ? [specs] : [];
      for (const spec of specList) {
        const specObj = spec as Record<string, unknown>;
        if (typeof specObj.priceType === "string" && specObj.priceType.includes("Strikethrough")) continue;
        if (specObj.price !== undefined) {
          const parsed = Number(String(specObj.price).replace(",", "."));
          if (Number.isFinite(parsed)) {
            price = parsed;
            currency = typeof specObj.priceCurrency === "string" ? specObj.priceCurrency : null;
            break;
          }
        }
      }
      if (price === null && offer.price !== undefined) {
        const parsed = Number(String(offer.price).replace(",", "."));
        if (Number.isFinite(parsed)) {
          price = parsed;
          currency = typeof offer.priceCurrency === "string" ? offer.priceCurrency : null;
        }
      }
      if (price !== null) break;
    }

    const imageRaw = product.image;
    let imageUrl: string | null = null;
    if (typeof imageRaw === "string") imageUrl = imageRaw;
    else if (Array.isArray(imageRaw) && imageRaw.length > 0) {
      const first = imageRaw[0];
      if (typeof first === "string") imageUrl = first;
      else if (first && typeof first === "object" && "contentUrl" in first) {
        imageUrl = String((first as { contentUrl: unknown }).contentUrl);
      }
    }

    const ratingObj = product.aggregateRating as Record<string, unknown> | undefined;
    const rating = ratingObj?.ratingValue ? Number(ratingObj.ratingValue) : null;
    const reviewCount = ratingObj?.reviewCount
      ? Number(ratingObj.reviewCount)
      : ratingObj?.ratingCount
        ? Number(ratingObj.ratingCount)
        : null;

    if (price === null) {
      const embedded = html.match(/"currencyCode":"([A-Z]{3})","price":([0-9.,]+)/);
      if (embedded) {
        const parsed = Number(embedded[2].replace(",", "."));
        if (Number.isFinite(parsed)) {
          price = parsed;
          currency = currency ?? embedded[1];
        }
      }
    }

    return {
      title: name,
      url,
      snippet: `${name}. Observed live price: ${price ?? "unknown"} ${currency ?? currencyFor(country)}. Rating: ${rating ?? "n/a"} from ${reviewCount ?? "n/a"} reviews. Observed on the retailer product page.`,
      domain: new URL(url).hostname.replace(/^www\./, ""),
      language: COUNTRY_META[country].language.toLowerCase(),
      provider: "ikea-product-page",
      retrievedAt: new Date().toISOString(),
      origin: "RETAIL_PROBE",
      verificationStatus: "PARTIALLY_VERIFIED",
      observedPrice: price,
      currency: currency ?? currencyFor(country),
      imageUrl,
      brand: "IKEA",
      rating: rating !== null && Number.isFinite(rating) ? rating : null,
      reviewCount: reviewCount !== null && Number.isFinite(reviewCount) ? reviewCount : null,
    };
  }
  return null;
}

function parseAmazonSearch(html: string, country: Country): SearchResult[] {
  const $ = cheerio.load(html);
  const host = COUNTRY_META[country].amazonHost;
  const currency = currencyFor(country);
  const results: SearchResult[] = [];
  const seen = new Set<string>();

  $('[data-component-type="s-search-result"]').each((_, element) => {
    const card = $(element);
    const asin = card.attr("data-asin");
    if (!asin || seen.has(asin)) return;
    const title = card.find("h2").first().text().replace(/\s+/g, " ").trim();
    if (!title) return;
    const priceText = card.find(".a-price .a-offscreen").first().text().trim();
    const price = parseMoney(priceText, currency);
    const imageUrl = card.find("img.s-image").first().attr("src") ?? null;
    const rating = parseRating(card.find(".a-icon-alt").first().text());
    const reviewText =
      card.find('a[href*="customerReviews"] span').first().text() ||
      card.find("span.a-size-base.s-underline-text").first().text() ||
      card.find('span[aria-label*="ratings"]').first().attr("aria-label") ||
      "";
    const reviewCount = parseReviewCount(reviewText);
    const url = `https://${host}/dp/${asin}`;
    seen.add(asin);
    results.push({
      title,
      url,
      snippet: `${title}. Live search listing on ${host}; displayed price ${priceText || "not shown"}. Rating ${rating ?? "n/a"} from ${reviewCount ?? "n/a"} ratings.`,
      domain: host.replace(/^www\./, ""),
      language: COUNTRY_META[country].language.toLowerCase(),
      provider: "amazon-search-page",
      retrievedAt: new Date().toISOString(),
      origin: "RETAIL_PROBE",
      verificationStatus: "PARTIALLY_VERIFIED",
      observedPrice: price,
      currency,
      imageUrl,
      brand: null,
      rating,
      reviewCount,
    });
  });

  return results;
}

function parseMonotaro(html: string): SearchResult[] {
  const $ = cheerio.load(html);
  const results: SearchResult[] = [];
  const seen = new Set<string>();

  $("li[data-ee-product-code]").each((_, element) => {
    const card = $(element);
    const code = card.attr("data-ee-product-code");
    if (!code || seen.has(code)) return;
    const title = card.find("h2 a").first().text().replace(/\s+/g, " ").trim();
    if (!title) return;
    const brand = card.find('[class*="BrandText"]').first().text().trim() || null;
    const imageUrl = card.find("img").first().attr("src") ?? null;
    const reviewText = card.find('[class*="Review"]').first().text().replace(/\s+/g, " ").trim();
    const reviewAttr = card.find('[title*="レビュー"]').first().attr("title") ?? "";
    const ratingMatch = reviewAttr.match(/平均満足度\s*([0-5](?:\.\d)?)/);
    const rating = ratingMatch ? Number(ratingMatch[1]) : null;
    const reviewCountMatch = reviewText.match(/\(?([\d,]+)\s*件/);
    const reviewCount = reviewCountMatch ? Number(reviewCountMatch[1].replace(/,/g, "")) : null;

    const taxIncluded = card
      .text()
      .match(/税込\s*[￥¥]?\s*([0-9,]+)/)?.[1];
    const dataPrice = card.attr("data-ee-price");
    const price = taxIncluded
      ? Number(taxIncluded.replace(/,/g, ""))
      : dataPrice
        ? Number(dataPrice)
        : null;

    const url = `https://www.monotaro.com/g/${code}/`;
    const image = imageUrl?.startsWith("//") ? `https:${imageUrl}` : imageUrl;
    seen.add(code);
    results.push({
      title,
      url,
      snippet: `${title}${brand ? ` (${brand})` : ""}. Live Monotaro Japan listing. Tax-included observed price: ${price ?? "not shown"} JPY. Reviews: ${reviewCount ?? "n/a"}.`,
      domain: "monotaro.com",
      language: "japanese",
      provider: "monotaro-search-page",
      retrievedAt: new Date().toISOString(),
      origin: "RETAIL_PROBE",
      verificationStatus: "PARTIALLY_VERIFIED",
      observedPrice: price,
      currency: "JPY",
      imageUrl: image,
      brand,
      rating,
      reviewCount,
    });
  });

  return results;
}

async function probeAmazon(
  fetchClient: FetchClient,
  country: "US" | "DE" | "UK",
  query: string,
  signal?: AbortSignal,
): Promise<{ results: SearchResult[]; warning: string | null }> {
  const host = COUNTRY_META[country].amazonHost;
  const url = `https://${host}/s?k=${encodeURIComponent(query)}`;
  const page = await fetchClient.fetchPage(url, {
    headers: { ...AMAZON_HEADERS[country], "User-Agent": BROWSER_UA },
    cache: false,
    signal,
  });
  if (!page.ok || page.status === 202 || page.text.length < 500) {
    return {
      results: [],
      warning: `Amazon ${country} search did not return a usable page (status ${page.status || page.error}). No fabricated prices were added.`,
    };
  }
  const results = parseAmazonSearch(page.html ?? page.text, country);
  return {
    results,
    warning:
      results.length === 0
        ? `Amazon ${country} search page was reachable but no product cards could be parsed.`
        : null,
  };
}

async function probeMonotaro(
  fetchClient: FetchClient,
  query: string,
  signal?: AbortSignal,
): Promise<{ results: SearchResult[]; warning: string | null }> {
  const url = `https://www.monotaro.com/s/?q=${encodeURIComponent(query)}`;
  const page = await fetchClient.fetchPage(url, {
    headers: {
      "User-Agent": BROWSER_UA,
      "Accept-Language": "ja-JP,ja;q=0.9",
    },
    cache: false,
    signal,
  });
  if (!page.ok) {
    return {
      results: [],
      warning: `Monotaro Japan search failed (status ${page.status || page.error}). No fabricated prices were added.`,
    };
  }
  const results = parseMonotaro(page.html ?? page.text);
  return {
    results,
    warning: results.length === 0 ? "Monotaro page reached but no product cards were parsed." : null,
  };
}

async function probeSeedUrls(
  fetchClient: FetchClient,
  country: Country,
  urls: string[],
  signal?: AbortSignal,
): Promise<{ results: SearchResult[]; warnings: string[] }> {
  const results: SearchResult[] = [];
  const warnings: string[] = [];
  for (const url of urls.slice(0, 8)) {
    const page = await fetchClient.fetchPage(url, {
      headers: url.includes("amazon.")
        ? { ...AMAZON_HEADERS[country], "User-Agent": BROWSER_UA }
        : { "User-Agent": BROWSER_UA, "Accept-Language": "en-GB,en;q=0.9" },
      cache: false,
      signal,
    });
    if (!page.ok) {
      warnings.push(`Seed product page could not be refreshed: ${url} (${page.status || page.error}).`);
      continue;
    }
    const parsed =
      parseIkeaProduct(page.html ?? "", page.finalUrl, country) ??
      (page.html ? parseAmazonProductPage(page.html, url, country) : null);
    if (parsed) results.push(parsed);
    else warnings.push(`Seed product page was fetched but not parseable: ${url}.`);
  }
  return { results, warnings };
}

export function parseAmazonProductPage(
  html: string,
  url: string,
  country: Country,
): SearchResult | null {
  const $ = cheerio.load(html);
  const title = $("#productTitle").first().text().replace(/\s+/g, " ").trim();
  if (!title) return null;
  const currency = currencyFor(country);
  let priceText = $("#corePrice_feature_div .a-offscreen, #corePriceDisplay_desktop_feature_div .a-offscreen, .a-price .a-offscreen")
    .first()
    .text()
    .trim();
  if (!priceText || !new RegExp(currency === "USD" ? "\\$" : currency === "GBP" ? "£" : currency === "EUR" ? "€" : "￥|¥").test(priceText)) {
    const embedded = html.match(/"currencyCode":"([A-Z]{3})","price":([0-9.,]+)/);
    if (embedded && embedded[1] === currency) priceText = `${embedded[2]} ${currency}`;
  }
  const price = parseMoney(priceText, currency);
  const imageUrl = $("#landingImage").attr("src") ?? $("#imgTagWrapperId img").attr("data-old-hires") ?? null;
  const rating = parseRating($("#acrPopover").attr("title") ?? $(".a-icon-alt").first().text());
  const reviewCount = parseReviewCount($("#acrCustomerReviewText").first().text());
  if (price === null) return null;
  return {
    title,
    url,
    snippet: `${title}. Amazon ${country} product page. Observed displayed price: ${priceText}. Rating ${rating ?? "n/a"} from ${reviewCount ?? "n/a"} ratings.`,
    domain: new URL(url).hostname.replace(/^www\./, ""),
    language: COUNTRY_META[country].language.toLowerCase(),
    provider: "amazon-product-page",
    retrievedAt: new Date().toISOString(),
    origin: "RETAIL_PROBE",
    verificationStatus: "PARTIALLY_VERIFIED",
    observedPrice: price,
    currency,
    imageUrl,
    brand: null,
    rating,
    reviewCount,
  };
}

export async function probeRetail(
  fetchClient: FetchClient,
  options: ProbeOptions,
): Promise<RetailProbeResult> {
  const { country, query, seedUrls = [], maxResults = 10, signal } = options;
  const cacheKey = `${country}:${query}:${seedUrls.join("|")}`;
  const cached = cache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.value;

  const warnings: string[] = [];
  const attemptedSources: string[] = [];
  let results: SearchResult[] = [];

  const experimentalAmazon = process.env.RETAIL_PROBE_AMAZON === "1";
  const experimentalMonotaro = process.env.RETAIL_PROBE_MONOTARO === "1";

  if (experimentalAmazon && (country === "US" || country === "DE" || country === "UK")) {
    attemptedSources.push(`Amazon ${country} search`);
    const amazon = await probeAmazon(fetchClient, country, query, signal);
    if (amazon.warning) warnings.push(amazon.warning);
    results.push(...amazon.results);
  }

  if (experimentalMonotaro && country === "JP") {
    attemptedSources.push("Monotaro Japan search");
    const mono = await probeMonotaro(fetchClient, query, signal);
    if (mono.warning) warnings.push(mono.warning);
    results.push(...mono.results);
  }

  if (seedUrls.length > 0) {
    attemptedSources.push("Curated local product pages");
    const seeds = await probeSeedUrls(fetchClient, country, seedUrls, signal);
    warnings.push(...seeds.warnings);
    results.push(...seeds.results);
  }

  // Deduplicate by URL, prefer entries with prices.
  const byUrl = new Map<string, SearchResult>();
  for (const result of results) {
    const existing = byUrl.get(result.url);
    if (!existing || (existing.observedPrice === null && result.observedPrice !== null)) {
      byUrl.set(result.url, result);
    }
  }
  results = Array.from(byUrl.values())
    .filter((result) => {
      if (!result.observedPrice || result.observedPrice <= 0) return false;
      const currency = result.currency ?? "";
      if (country === "US" && currency !== "USD") return false;
      if (country === "JP" && currency !== "JPY") return false;
      if (country === "DE" && currency !== "EUR") return false;
      if (country === "UK" && currency !== "GBP") return false;
      return true;
    })
    .slice(0, maxResults);

  if (results.length === 0) {
    warnings.push(
      `No live ${country} retail prices could be collected. Market pricing will be shown as incomplete rather than estimated from fabricated data.`,
    );
  }

  const value: RetailProbeResult = { results, warnings, attemptedSources };
  cache.set(cacheKey, { expiresAt: Date.now() + CACHE_TTL_MS, value });
  return value;
}