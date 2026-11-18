const URL_PATTERN = /https?:\/\/[^\s<>"'，。；;）)】]+/gi;
const BARE_SUPPLIER_PATTERN = /(?<![A-Za-z0-9._/@:-])(?:https?:\/\/)?(?:[a-z0-9-]+\.)*(?:1688|taobao|tmall)\.com\/[^\s<>"'，。；;）)】]+/gi;

function normalize(raw: string, platforms: string[]): string | null {
  const trimmed = raw.replace(/[.,，。；;）)】\]]+$/g, "").trim();
  if (!trimmed) return null;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (parsed.username || parsed.password || parsed.port) return null;
    if (!platforms.some(domain => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`))) return null;
    return parsed.toString();
  } catch {
    return null;
  }
}

/** Find the first 1688 URL in a pasted message, including bare links without a scheme. */
function findUrl(text: string, platforms: string[]): string | null {
  const matches = [...text.matchAll(URL_PATTERN), ...text.matchAll(BARE_SUPPLIER_PATTERN)];
  for (const match of matches) {
    const candidate = normalize(match[0], platforms);
    if (candidate) return candidate;
  }
  return null;
}

export function findSupplierProductUrl(text: string): string | null {
  return findUrl(text, ["1688.com", "taobao.com", "tmall.com"]);
}

export function find1688Url(text: string): string | null {
  return findUrl(text, ["1688.com"]);
}

export function is1688Url(text: string): boolean {
  return find1688Url(text) !== null;
}
