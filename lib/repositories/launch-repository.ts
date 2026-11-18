import type { AppDatabase } from "@/lib/db/client";
import { nowIso, parseJson, uid } from "@/lib/db/client";
import type { Country, LaunchPageContent } from "@/types/domain";

export interface LaunchRepository {
  upsert(input: { productId: string; country: Country; content: LaunchPageContent }): LaunchPageContent;
  get(productId: string, country: Country): LaunchPageContent | null;
  getLatestByProduct(productId: string): LaunchPageContent | null;
  listByProduct(productId: string): LaunchPageContent[];
}

export function createLaunchRepository(db: AppDatabase): LaunchRepository {
  return {
    upsert(input) {
      const now = nowIso();
      db.prepare(
        `INSERT INTO launch_pages (id, product_id, country, content_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?)
         ON CONFLICT(product_id, country) DO UPDATE SET content_json = excluded.content_json, updated_at = excluded.updated_at`,
      ).run(uid("lnc"), input.productId, input.country, JSON.stringify(input.content), now, now);
      const stored = this.get(input.productId, input.country);
      if (!stored) throw new Error("Failed to persist launch page.");
      return stored;
    },

    get(productId, country) {
      const row = db
        .prepare("SELECT content_json FROM launch_pages WHERE product_id = ? AND country = ?")
        .get(productId, country) as { content_json: string } | undefined;
      return row ? parseJson<LaunchPageContent>(row.content_json, {} as LaunchPageContent) : null;
    },

    getLatestByProduct(productId) {
      const row = db
        .prepare("SELECT content_json FROM launch_pages WHERE product_id = ? ORDER BY updated_at DESC LIMIT 1")
        .get(productId) as { content_json: string } | undefined;
      return row ? parseJson<LaunchPageContent>(row.content_json, {} as LaunchPageContent) : null;
    },

    listByProduct(productId) {
      const rows = db
        .prepare("SELECT content_json FROM launch_pages WHERE product_id = ? ORDER BY updated_at DESC")
        .all(productId) as Array<{ content_json: string }>;
      return rows.map((row) => parseJson<LaunchPageContent>(row.content_json, {} as LaunchPageContent));
    },
  };
}