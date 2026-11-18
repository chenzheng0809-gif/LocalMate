import type { AppDatabase } from "@/lib/db/client";
import { nowIso, parseJson, uid } from "@/lib/db/client";
import type { MatchAnalysis } from "@/types/domain";

export interface MatchRepository {
  save(productId: string, analysis: MatchAnalysis): MatchAnalysis;
  getLatest(productId: string): MatchAnalysis | null;
  listByProduct(productId: string, limit?: number): MatchAnalysis[];
}

export function createMatchRepository(db: AppDatabase): MatchRepository {
  return {
    save(productId, analysis) {
      db.prepare("INSERT INTO matches (id, product_id, data_json, created_at) VALUES (?, ?, ?, ?)").run(
        uid("mtc"),
        productId,
        JSON.stringify(analysis),
        nowIso(),
      );
      return analysis;
    },

    getLatest(productId) {
      const row = db
        .prepare("SELECT data_json FROM matches WHERE product_id = ? ORDER BY created_at DESC LIMIT 1")
        .get(productId) as { data_json: string } | undefined;
      return row ? parseJson<MatchAnalysis>(row.data_json, {} as MatchAnalysis) : null;
    },

    listByProduct(productId, limit = 10) {
      const rows = db
        .prepare("SELECT data_json FROM matches WHERE product_id = ? ORDER BY created_at DESC LIMIT ?")
        .all(productId, limit) as Array<{ data_json: string }>;
      return rows.map((row) => parseJson<MatchAnalysis>(row.data_json, {} as MatchAnalysis));
    },
  };
}