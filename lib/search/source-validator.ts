import { isIP } from "node:net";
import type { Country } from "@/types/domain";

export function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function sanitizeSourceUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (url.username || url.password) return null;
    if (url.port && !["80", "443"].includes(url.port)) return null;
    if (isObviouslyBlockedHost(url.hostname)) return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (/^(utm_|ref|ref_|tag|linkCode|th|psc|pd_rd|sp_csd|aref|gclid|fbclid)/i.test(key)) {
        url.searchParams.delete(key);
      }
    }
    return url.toString();
  } catch {
    return null;
  }
}

const BLOCKED_HOSTS = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata.google.internal",
  "metadata",
  "instance-data",
  "169.254.169.254",
  "0.0.0.0",
]);

const PRIVATE_HOST_SUFFIXES = [".localhost", ".local", ".internal", ".home", ".lan", ".intranet"];

export function isObviouslyBlockedHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/\.$/, "").replace(/^\[|\]$/g, "");
  if (BLOCKED_HOSTS.has(host)) return true;
  if (PRIVATE_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix))) return true;
  if (isIP(host) === 4) {
    const parts = host.split(".").map(Number);
    if (parts[0] === 10) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 0) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
    if (parts[0] === 198 && (parts[1] === 18 || parts[1] === 19)) return true;
  }
  if (isIP(host) === 6) {
    const normalized = host.toLowerCase();
    if (normalized === "::1" || normalized === "::") return true;
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
    if (normalized.startsWith("fe80")) return true;
    if (normalized.startsWith("::ffff:")) return true;
  }
  return false;
}

export function isValidPublicIp(address: string): boolean {
  if (isIP(address) === 4) {
    const parts = address.split(".").map(Number);
    if (parts[0] === 10 || parts[0] === 127 || parts[0] === 0) return false;
    if (parts[0] === 169 && parts[1] === 254) return false;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false;
    if (parts[0] === 192 && parts[1] === 168) return false;
    return true;
  }
  if (isIP(address) === 6) {
    const normalized = address.toLowerCase();
    if (normalized === "::1" || normalized === "::") return false;
    if (normalized.startsWith("fc") || normalized.startsWith("fd")) return false;
    if (normalized.startsWith("fe80")) return false;
    return true;
  }
  return false;
}

export const OFFICIAL_DOMAINS: Record<Country, string[]> = {
  US: [
    "cbp.gov",
    "usitc.gov",
    "hts.usitc.gov",
    "cpsc.gov",
    "ftc.gov",
    "govinfo.gov",
    "ecfr.gov",
    "trade.gov",
    "aphis.usda.gov",
    "fda.gov",
    "sba.gov",
  ],
  JP: [
    "customs.go.jp",
    "jetro.go.jp",
    "meti.go.jp",
    "caa.go.jp",
    "mhlw.go.jp",
    "maff.go.jp",
    "gov-online.go.jp",
    "nta.go.jp",
  ],
  DE: [
    "europa.eu",
    "ec.europa.eu",
    "trade.ec.europa.eu",
    "eur-lex.europa.eu",
    "access2markets.ec.europa.eu",
    "verpackungsregister.org",
    "zoll.de",
    "bvl.bund.de",
    "bmwk.de",
    "umweltbundesamt.de",
  ],
  UK: [
    "gov.uk",
    "trade-tariff.service.gov.uk",
    "legislation.gov.uk",
    "hse.gov.uk",
    "food.gov.uk",
    "environment.agency.gov.uk",
    "gov.uk",
  ],
};

const SHORTENER_HOSTS = new Set([
  "bit.ly",
  "t.co",
  "tinyurl.com",
  "goo.gl",
  "ow.ly",
  "is.gd",
  "buff.ly",
]);

export function isOfficialDomain(domain: string, country?: Country): boolean {
  const normalized = domain.toLowerCase().replace(/^www\./, "");
  const domains = country ? OFFICIAL_DOMAINS[country] : Object.values(OFFICIAL_DOMAINS).flat();
  return domains.some((allowed) => normalized === allowed || normalized.endsWith(`.${allowed}`));
}

export function isRetailerDomain(domain: string): boolean {
  const normalized = domain.toLowerCase();
  return [
    "amazon.com",
    "amazon.co.uk",
    "amazon.de",
    "amazon.co.jp",
    "ikea.com",
    "muji.com",
    "etsy.com",
    "walmart.com",
    "target.com",
    "otto.de",
    "argos.co.uk",
    "rakuten.co.jp",
    "yahoo.co.jp",
  ].some((allowed) => normalized === allowed || normalized.endsWith(`.${allowed}`));
}

export function isUsableSource(url: string): boolean {
  const sanitized = sanitizeSourceUrl(url);
  if (!sanitized) return false;
  const domain = domainFromUrl(sanitized);
  if (!domain || SHORTENER_HOSTS.has(domain)) return false;
  if (isObviouslyBlockedHost(domain)) return false;
  return true;
}

export function classifyDomain(url: string, country?: Country): "OFFICIAL" | "RETAILER" | "OTHER" {
  const domain = domainFromUrl(url);
  if (isOfficialDomain(domain, country)) return "OFFICIAL";
  if (isRetailerDomain(domain)) return "RETAILER";
  return "OTHER";
}

export function normalizeForQuoteMatch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^a-z0-9\u00c0-\u024f\u3040-\u30ff\u3400-\u9fff]+/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * A quote only counts as verified when it is materially present in the fetched
 * page text. We tolerate minor whitespace/typographic differences and otherwise
 * require substantial token overlap.
 */
export function quoteExistsInText(quote: string, text: string): boolean {
  const q = normalizeForQuoteMatch(quote);
  const t = normalizeForQuoteMatch(text);
  if (q.length < 12 || t.length < 12) return false;
  if (t.includes(q)) return true;
  const quoteTokens = q.split(" ").filter((token) => token.length > 3);
  if (quoteTokens.length < 5) return false;
  const textTokens = new Set(t.split(" "));
  const hits = quoteTokens.filter((token) => textTokens.has(token)).length;
  return hits / quoteTokens.length >= 0.82;
}

export function urlTrustLabel(domain: string, country?: Country): string {
  if (isOfficialDomain(domain, country)) return "OFFICIAL SOURCE";
  if (isRetailerDomain(domain)) return "RETAIL SOURCE";
  return "THIRD-PARTY SOURCE";
}