import { readFileSync } from "node:fs";
import path from "node:path";
import type {
  Country,
} from "@/types/domain";
import type {
  CorpusEntry,
  ResearchCorpus,
  SearchClient,
  SearchOptions,
  SearchResponse,
  SearchResult,
} from "@/lib/search/types";

const EMPTY_CORPUS: ResearchCorpus = {
  version: 0,
  compiledAt: new Date(0).toISOString(),
  note: "没有安装本地研究语料。",
  entries: [],
};

function loadCorpus(): ResearchCorpus {
  try {
    const raw = readFileSync(path.join(process.cwd(), "data", "research-corpus.json"), "utf8");
    const parsed = JSON.parse(raw) as ResearchCorpus;
    if (!Array.isArray(parsed.entries)) return EMPTY_CORPUS;
    return parsed;
  } catch {
    return EMPTY_CORPUS;
  }
}

const corpus = loadCorpus();

function normalize(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function queryTokens(query: string): string[] {
  const normalized = normalize(query);
  const tokens = normalized.split(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff]+/i).filter((t) => t.length >= 2);
  const japanese = normalized.match(/[\u3040-\u30ff\u3400-\u9fff]{2,}/g) ?? [];
  const bigrams: string[] = [];
  for (const chunk of japanese) {
    for (let i = 0; i < chunk.length - 1; i += 1) bigrams.push(chunk.slice(i, i + 2));
  }
  return Array.from(new Set([...tokens, ...bigrams])).slice(0, 24);
}

function scoreEntry(entry: CorpusEntry, tokens: string[]): number {
  const haystack = normalize(
    `${entry.title} ${entry.excerpt} ${entry.brand ?? ""} ${entry.queryTags.join(" ")}`,
  );
  let score = 0;
  for (const token of tokens) {
    if (entry.queryTags.some((tag) => normalize(tag).includes(token))) score += 4;
    if (haystack.includes(token)) score += 2;
  }
  if (entry.type === "competitor" && entry.observedPrice) score += 1;
  return score;
}

function toSearchResult(entry: CorpusEntry): SearchResult {
  return {
    title: entry.title,
    url: entry.url,
    snippet: entry.excerpt,
    domain: entry.domain,
    language: entry.language,
    provider: "local-corpus",
    retrievedAt: `${entry.observedAt}T00:00:00.000Z`,
    origin: "IMPORTED_LOCAL_RESEARCH",
    verificationStatus: entry.type === "official" ? "PARTIALLY_VERIFIED" : "IMPORTED_SNAPSHOT",
    observedPrice: entry.observedPrice ?? null,
    currency: entry.currency ?? null,
    imageUrl: entry.imageUrl ?? null,
    brand: entry.brand ?? null,
    rating: entry.rating ?? null,
    reviewCount: entry.reviewCount ?? null,
  };
}

function searchSync(query: string, options: SearchOptions = {}): SearchResponse {
  const tokens = queryTokens(query);
  const maxResults = options.maxResults ?? 8;
  const country = options.country;

  const pool = corpus.entries.filter(
    (entry) => !country || entry.countries.includes(country),
  );
  const ranked = pool
    .map((entry) => ({ entry, score: scoreEntry(entry, tokens) }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxResults);

  const usedFallback = ranked.length === 0 && pool.length > 0;
  const selected = usedFallback
    ? pool
        .filter((entry) => entry.type === "competitor")
        .slice(0, maxResults)
        .map((entry) => ({ entry, score: 0 }))
    : ranked;

  return {
    query,
    provider: "local-corpus",
    mode: "LOCAL_CORPUS",
    results: selected.map(({ entry }) => toSearchResult(entry)),
    notes: [
      corpus.note,
      `语料编译于 ${corpus.compiledAt}。条目是导入的观察记录，不是实时网络搜索。`,
      ...(usedFallback
        ? ["没有找到直接词法匹配；返回导入语料中的相关品类条目。"]
        : []),
      ...(corpus.entries.length === 0 ? ["本地语料为空。"] : []),
    ],
    searchedAt: new Date().toISOString(),
    cached: true,
  };
}

export const localCorpusSearch: SearchClient = {
  mode: "LOCAL_CORPUS",
  provider: "local-corpus",
  async search(query, options) {
    return searchSync(query, options);
  },
  async searchMany(queries, options) {
    return queries.map((query) => searchSync(query, options));
  },
};

export function getCorpusInfo(): {
  version: number;
  compiledAt: string;
  entries: number;
  note: string;
} {
  return {
    version: corpus.version,
    compiledAt: corpus.compiledAt,
    entries: corpus.entries.length,
    note: corpus.note,
  };
}

export function getCompetitorEntries(country: Country): CorpusEntry[] {
  return corpus.entries.filter(
    (entry) => entry.type === "competitor" && entry.countries.includes(country),
  );
}