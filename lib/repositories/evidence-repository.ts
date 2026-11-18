import type { AppDatabase } from "@/lib/db/client";
import { parseJson } from "@/lib/db/client";
import type { Country, Evidence, EvidenceOrigin, EvidenceType, VerificationStatus } from "@/types/domain";

function mapRow(row: Record<string, unknown>): Evidence {
  return {
    id: String(row.id),
    productId: String(row.product_id),
    country: row.country ? (String(row.country) as Country) : null,
    kind: String(row.kind) as Evidence["kind"],
    sourceUrl: row.source_url ? String(row.source_url) : null,
    sourceTitle: String(row.source_title),
    sourceDomain: String(row.source_domain),
    retrievedAt: String(row.retrieved_at),
    relevantExcerpt: String(row.relevant_excerpt),
    evidenceType: String(row.evidence_type) as EvidenceType,
    claimSupported: String(row.claim_supported),
    verificationStatus: String(row.verification_status) as VerificationStatus,
    origin: String(row.origin) as EvidenceOrigin,
    metadata: row.metadata_json
      ? parseJson<Record<string, unknown>>(row.metadata_json, {})
      : undefined,
    createdAt: String(row.created_at),
  };
}

export interface EvidenceRepository {
  insertMany(items: Evidence[]): void;
  getById(id: string): Evidence | null;
  getByIds(ids: string[]): Evidence[];
  listByProduct(productId: string, limit?: number): Evidence[];
  listByCountry(productId: string, country: Country, kind?: Evidence["kind"]): Evidence[];
  deleteByProduct(productId: string): void;
}

export function createEvidenceRepository(db: AppDatabase): EvidenceRepository {
  return {
    insertMany(items) {
      const statement = db.prepare(
        `INSERT OR REPLACE INTO evidence (
          id, product_id, country, kind, source_url, source_title, source_domain, retrieved_at,
          relevant_excerpt, evidence_type, claim_supported, verification_status, origin,
          metadata_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      );
      for (const item of items) {
        statement.run(
          item.id,
          item.productId,
          item.country ?? null,
          item.kind,
          item.sourceUrl ?? null,
          item.sourceTitle,
          item.sourceDomain,
          item.retrievedAt,
          item.relevantExcerpt,
          item.evidenceType,
          item.claimSupported,
          item.verificationStatus,
          item.origin,
          item.metadata ? JSON.stringify(item.metadata) : null,
          item.createdAt,
        );
      }
    },

    getById(id) {
      const row = db.prepare("SELECT * FROM evidence WHERE id = ?").get(id) as
        | Record<string, unknown>
        | undefined;
      return row ? mapRow(row) : null;
    },

    getByIds(ids) {
      if (ids.length === 0) return [];
      const unique = Array.from(new Set(ids));
      const placeholders = unique.map(() => "?").join(",");
      const rows = db
        .prepare(`SELECT * FROM evidence WHERE id IN (${placeholders})`)
        .all(...unique) as Array<Record<string, unknown>>;
      return rows.map(mapRow);
    },

    listByProduct(productId, limit = 200) {
      const rows = db
        .prepare("SELECT * FROM evidence WHERE product_id = ? ORDER BY created_at DESC LIMIT ?")
        .all(productId, limit) as Array<Record<string, unknown>>;
      return rows.map(mapRow);
    },

    listByCountry(productId, country, kind) {
      const rows = kind
        ? (db
            .prepare("SELECT * FROM evidence WHERE product_id = ? AND country = ? AND kind = ? ORDER BY created_at DESC")
            .all(productId, country, kind) as Array<Record<string, unknown>>)
        : (db
            .prepare("SELECT * FROM evidence WHERE product_id = ? AND country = ? ORDER BY created_at DESC")
            .all(productId, country) as Array<Record<string, unknown>>);
      return rows.map(mapRow);
    },

    deleteByProduct(productId) {
      db.prepare("DELETE FROM evidence WHERE product_id = ?").run(productId);
    },
  };
}