export function chatEndpoint(baseUrl: string): string | null {
  try {
    const url = new URL(baseUrl);
    const loopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if (url.protocol !== "https:" && !(url.protocol === "http:" && loopback)) return null;
    if (url.username || url.password || url.search || url.hash) return null;
    url.pathname = `${url.pathname.replace(/\/+$/, "")}/chat/completions`;
    return url.toString();
  } catch {
    return null;
  }
}
