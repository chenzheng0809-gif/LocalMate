import type { AppDatabase } from "@/lib/db/client";
import { nowIso, parseJson, uid } from "@/lib/db/client";
import type { PassportSnapshot } from "@/types/domain";

export interface PassportRecord {
  id: string;
  productId: string;
  version: number;
  snapshot: PassportSnapshot;
  createdAt: string;
}

function mapRow(row: Record<string, unknown>): PassportRecord {
  return {
    id: String(row.id),
    productId: String(row.product_id),
    version: Number(row.version),
    snapshot: parseJson<PassportSnapshot>(row.snapshot_json, {} as PassportSnapshot),
    createdAt: String(row.created_at),
  };
}

export interface PassportRepository {
  create(productId: string, snapshot: PassportSnapshot): PassportRecord;
  getLatest(productId: string): PassportRecord | null;
  listByProduct(productId: string): PassportRecord[];
  getByVersion(productId: string, version: number): PassportRecord | null;
  getById(id: string): PassportRecord | null;
}

export function createPassportRepository(db: AppDatabase): PassportRepository {
  return {
    create(productId, snapshot) {
      const max = db
        .prepare("SELECT COALESCE(MAX(version), 0) AS version FROM passports WHERE product_id = ?")
        .get(productId) as { version: number };
      const version = Number(max.version) + 1;
      const id = uid("ppt");
      db.prepare(
        "INSERT INTO passports (id, product_id, version, snapshot_json, created_at) VALUES (?, ?, ?, ?, ?)",
      ).run(
        id,
        productId,
        version,
        JSON.stringify({ ...snapshot, passportId: id, version }),
        nowIso(),
      );
      const record = this.getById(id);
      if (!record) throw new Error("Failed to persist passport.");
      return record;
    },

    getLatest(productId) {
      const row = db
        .prepare("SELECT * FROM passports WHERE product_id = ? ORDER BY version DESC LIMIT 1")
        .get(productId) as Record<string, unknown> | undefined;
      return row ? mapRow(row) : null;
    },

    listByProduct(productId) {
      const rows = db
        .prepare("SELECT * FROM passports WHERE product_id = ? ORDER BY version DESC")
        .all(productId) as Array<Record<string, unknown>>;
      return rows.map(mapRow);
    },

    getByVersion(productId, version) {
      const row = db
        .prepare("SELECT * FROM passports WHERE product_id = ? AND version = ?")
        .get(productId, version) as Record<string, unknown> | undefined;
      return row ? mapRow(row) : null;
    },

    getById(id) {
      const row = db.prepare("SELECT * FROM passports WHERE id = ?").get(id) as
        | Record<string, unknown>
        | undefined;
      return row ? mapRow(row) : null;
    },
  };
}