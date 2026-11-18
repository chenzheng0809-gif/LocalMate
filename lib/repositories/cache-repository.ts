import type { AppDatabase } from "@/lib/db/client";
import { nowIso, parseJson } from "@/lib/db/client";
import type { SearchResponse } from "@/lib/search/types";

export interface FetchCacheRow {
  url: string;
  status: number;
  contentText: string;
  contentTitle: string | null;
  fetchedAt: string;
  expiresAt: string;
  error: string | null;
}

export interface CacheRepository {
  getSearch(cacheKey: string): SearchResponse | null;
  setSearch(cacheKey: string, provider: string, query: string, response: SearchResponse, ttlMs: number): void;
  getFetch(url: string): FetchCacheRow | null;
  setFetch(row: FetchCacheRow): void;
  clearExpired(): void;
}

export function createCacheRepository(db: AppDatabase): CacheRepository {
  return {
    getSearch(cacheKey) {
      const row = db
        .prepare("SELECT response_json, expires_at FROM search_cache WHERE cache_key = ?")
        .get(cacheKey) as { response_json: string; expires_at: string } | undefined;
      if (!row) return null;
      if (new Date(row.expires_at).getTime() < Date.now()) {
        db.prepare("DELETE FROM search_cache WHERE cache_key = ?").run(cacheKey);
        return null;
      }
      return parseJson<SearchResponse>(row.response_json, null as unknown as SearchResponse);
    },

    setSearch(cacheKey, provider, query, response, ttlMs) {
      const now = new Date();
      db.prepare(
        `INSERT OR REPLACE INTO search_cache (cache_key, provider, query, response_json, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(
        cacheKey,
        provider,
        query,
        JSON.stringify(response),
        now.toISOString(),
        new Date(now.getTime() + ttlMs).toISOString(),
      );
    },

    getFetch(url) {
      const row = db.prepare("SELECT * FROM fetch_cache WHERE url = ?").get(url) as
        | Record<string, unknown>
        | undefined;
      if (!row) return null;
      if (new Date(String(row.expires_at)).getTime() < Date.now()) {
        db.prepare("DELETE FROM fetch_cache WHERE url = ?").run(url);
        return null;
      }
      return {
        url: String(row.url),
        status: Number(row.status),
        contentText: String(row.content_text),
        contentTitle: row.content_title ? String(row.content_title) : null,
        fetchedAt: String(row.fetched_at),
        expiresAt: String(row.expires_at),
        error: row.error ? String(row.error) : null,
      };
    },

    setFetch(row) {
      db.prepare(
        `INSERT OR REPLACE INTO fetch_cache (url, status, content_text, content_title, fetched_at, expires_at, error)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        row.url,
        row.status,
        row.contentText,
        row.contentTitle,
        row.fetchedAt,
        row.expiresAt,
        row.error,
      );
    },

    clearExpired() {
      const now = nowIso();
      db.prepare("DELETE FROM search_cache WHERE expires_at < ?").run(now);
      db.prepare("DELETE FROM fetch_cache WHERE expires_at < ?").run(now);
    },
  };
}