import type { Country, EvidenceOrigin, VerificationStatus } from "@/types/domain";

export type SearchProviderName = "tavily" | "exa" | "serper" | "local" | "none";

export type SearchMode = "LIVE_SEARCH" | "LOCAL_CORPUS" | "RETAIL_PROBE" | "NONE";

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  domain: string;
  language?: string;
  publishedAt?: string | null;
  provider: string;
  retrievedAt: string;
  origin: EvidenceOrigin;
  verificationStatus: VerificationStatus;
  observedPrice?: number | null;
  currency?: string | null;
  imageUrl?: string | null;
  brand?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
}

export interface SearchResponse {
  query: string;
  provider: string;
  mode: SearchMode;
  results: SearchResult[];
  notes: string[];
  searchedAt: string;
  cached: boolean;
}

export interface SearchOptions {
  country?: Country;
  market?: string;
  language?: "en" | "ja" | "de";
  maxResults?: number;
  includeDomains?: string[];
  signal?: AbortSignal;
}

export interface SearchClient {
  readonly mode: SearchMode;
  readonly provider: string;
  search(query: string, options?: SearchOptions): Promise<SearchResponse>;
  searchMany(queries: string[], options?: SearchOptions): Promise<SearchResponse[]>;
}

export interface FetchResult {
  ok: boolean;
  url: string;
  finalUrl: string;
  status: number;
  title: string | null;
  text: string;
  html: string | null;
  contentType: string | null;
  bytes: number;
  fetchedAt: string;
  cached: boolean;
  error: string | null;
}

export interface CorpusEntry {
  id: string;
  countries: Country[];
  language: "en" | "ja" | "de";
  type: "competitor" | "market_signal" | "official";
  title: string;
  url: string;
  domain: string;
  excerpt: string;
  queryTags: string[];
  brand?: string | null;
  observedPrice?: number | null;
  currency?: string | null;
  imageUrl?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  observedAt: string;
  sourceNote: string;
}

export interface ResearchCorpus {
  version: number;
  compiledAt: string;
  note: string;
  entries: CorpusEntry[];
}