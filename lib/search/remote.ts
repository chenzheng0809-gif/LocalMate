import { config } from "@/lib/config";
import type { Country } from "@/types/domain";
import type {
  SearchClient,
  SearchOptions,
  SearchResponse,
  SearchResult,
} from "@/lib/search/types";
import { domainFromUrl } from "@/lib/search/source-validator";

const MARKET_LANGUAGE: Record<string, string> = {
  JP: "ja", DE: "de", MX: "es", ES: "es", BR: "pt", PT: "pt", FR: "fr", IT: "it",
  TH: "th", VN: "vi", ID: "id", KR: "ko", NL: "nl", PL: "pl", SA: "ar", AE: "ar",
};

function locale(options?: SearchOptions) {
  const market = options?.market ?? options?.country ?? "US";
  return { gl: market === "UK" ? "gb" : market.toLowerCase(), hl: MARKET_LANGUAGE[market] ?? "en" };
}

function resultBase(
  item: { title: string; url: string; snippet: string },
  provider: string,
  retrievedAt: string,
  extras: Partial<SearchResult> = {},
): SearchResult {
  return {
    title: item.title.replace(/\s+/g, " ").trim(),
    url: item.url,
    snippet: item.snippet.replace(/\s+/g, " ").trim(),
    domain: domainFromUrl(item.url),
    language: extras.language ?? "english",
    provider,
    retrievedAt,
    origin: "LIVE_SEARCH",
    verificationStatus: "PARTIALLY_VERIFIED",
    ...extras,
  };
}

async function postJson(
  url: string,
  body: Record<string, unknown>,
  headers: Record<string, string>,
  timeoutMs: number,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) {
      throw new Error(`Search provider returned HTTP ${response.status}: ${text.slice(0, 180)}`);
    }
    return JSON.parse(text) as unknown;
  } finally {
    clearTimeout(timer);
  }
}

function tavilyClient(apiKey: string): SearchClient {
  return {
    mode: "LIVE_SEARCH",
    provider: "tavily",
    async search(query, options) {
      const data = (await postJson(
        "https://api.tavily.com/search",
        {
          api_key: apiKey,
          query,
          search_depth: "basic",
          include_answer: false,
          max_results: options?.maxResults ?? config.search.maxResults,
        },
        {},
        config.search.timeoutMs,
      )) as { results?: Array<Record<string, unknown>> };
      const retrievedAt = new Date().toISOString();
      const results = (data.results ?? [])
        .map((item) =>
          resultBase(
            {
              title: String(item.title ?? ""),
              url: String(item.url ?? ""),
              snippet: String(item.content ?? ""),
            },
            "tavily",
            retrievedAt,
            { language: locale(options).hl },
          ),
        )
        .filter((item) => item.title && item.url.startsWith("http"));
      return {
        query,
        provider: "tavily",
        mode: "LIVE_SEARCH",
        results,
        notes: ["Live Tavily search. Results are discovery leads, not verified facts until fetched."],
        searchedAt: retrievedAt,
        cached: false,
      } satisfies SearchResponse;
    },
    async searchMany(queries, options) {
      const out: SearchResponse[] = [];
      for (const query of queries) out.push(await this.search(query, options));
      return out;
    },
  };
}

function exaClient(apiKey: string): SearchClient {
  return {
    mode: "LIVE_SEARCH",
    provider: "exa",
    async search(query, options) {
      const data = (await postJson(
        "https://api.exa.ai/search",
        {
          query,
          numResults: options?.maxResults ?? config.search.maxResults,
          contents: { text: { maxCharacters: 1200 } },
        },
        { "x-api-key": apiKey },
        config.search.timeoutMs,
      )) as { results?: Array<Record<string, unknown>> };
      const retrievedAt = new Date().toISOString();
      const results = (data.results ?? [])
        .map((item) =>
          resultBase(
            {
              title: String(item.title ?? ""),
              url: String(item.url ?? ""),
              snippet: String(item.text ?? ""),
            },
            "exa",
            retrievedAt,
            { language: locale(options).hl, publishedAt: item.publishedDate ? String(item.publishedDate) : null },
          ),
        )
        .filter((item) => item.title && item.url.startsWith("http"));
      return {
        query,
        provider: "exa",
        mode: "LIVE_SEARCH",
        results,
        notes: ["Live Exa search. Snippets are discovery leads and require source verification."],
        searchedAt: retrievedAt,
        cached: false,
      } satisfies SearchResponse;
    },
    async searchMany(queries, options) {
      const out: SearchResponse[] = [];
      for (const query of queries) out.push(await this.search(query, options));
      return out;
    },
  };
}

function serperClient(apiKey: string): SearchClient {
  return {
    mode: "LIVE_SEARCH",
    provider: "serper",
    async search(query, options) {
      const { gl, hl } = locale(options);
      const data = (await postJson(
        "https://google.serper.dev/search",
        {
          q: query,
          num: options?.maxResults ?? config.search.maxResults,
          gl,
          hl,
        },
        { "X-API-KEY": apiKey },
        config.search.timeoutMs,
      )) as { organic?: Array<Record<string, unknown>> };
      const retrievedAt = new Date().toISOString();
      const results = (data.organic ?? [])
        .map((item) =>
          resultBase(
            {
              title: String(item.title ?? ""),
              url: String(item.link ?? ""),
              snippet: String(item.snippet ?? ""),
            },
            "serper",
            retrievedAt,
            { language: hl, publishedAt: item.date ? String(item.date) : null },
          ),
        )
        .filter((item) => item.title && item.url.startsWith("http"));
      return {
        query,
        provider: "serper",
        mode: "LIVE_SEARCH",
        results,
        notes: ["Live Serper (Google) results. Discovery only; verify claims at the source."],
        searchedAt: retrievedAt,
        cached: false,
      } satisfies SearchResponse;
    },
    async searchMany(queries, options) {
      const out: SearchResponse[] = [];
      for (const query of queries) out.push(await this.search(query, options));
      return out;
    },
  };
}

export function createRemoteSearchClient(): SearchClient | null {
  const provider = config.search.provider;
  const key = config.search.apiKey;
  if (!key) return null;
  if (provider === "tavily") return tavilyClient(key);
  if (provider === "exa") return exaClient(key);
  if (provider === "serper") return serperClient(key);
  return null;
}

export function remoteSearchOptions(country: Country): SearchOptions {
  return { country, maxResults: config.search.maxResults };
}