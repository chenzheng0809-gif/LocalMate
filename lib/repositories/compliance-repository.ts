import type { AppDatabase } from "@/lib/db/client";
import { nowIso, parseJson, uid } from "@/lib/db/client";
import type { ComplianceData, ComplianceStatus, Country } from "@/types/domain";

function mapRow(row: Record<string, unknown>): ComplianceData {
  return parseJson<ComplianceData>(row.data_json, {
    country: String(row.country) as Country,
    scopeStatus: "IN_SCOPE",
    status: String(row.status) as ComplianceStatus,
    statusReason: "",
    hsCandidates: [],
    requirements: [],
    importRequirements: [],
    marketRequirements: [],
    documentation: [],
    missingAttributes: [],
    issues: [],
    actionItems: [],
    officialSources: [],
    disclaimers: [],
    evidenceIds: [],
    researchedAt: String(row.updated_at),
    dataMode: "DEMO",
    agentTrace: [],
  });
}

export interface ComplianceRepository {
  upsert(input: { productId: string; country: Country; data: ComplianceData }): ComplianceData;
  get(productId: string, country: Country): ComplianceData | null;
  getByProduct(productId: string): ComplianceData[];
  deleteByProduct(productId: string): void;
}

export function createComplianceRepository(db: AppDatabase): ComplianceRepository {
  return {
    upsert(input) {
      const now = nowIso();
      db.prepare(
        `INSERT INTO compliance_checks (id, product_id, country, scope_status, status, data_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(product_id, country) DO UPDATE SET
           scope_status = excluded.scope_status, status = excluded.status,
           data_json = excluded.data_json, updated_at = excluded.updated_at`,
      ).run(
        uid("cmp"),
        input.productId,
        input.country,
        input.data.scopeStatus,
        input.data.status,
        JSON.stringify(input.data),
        now,
        now,
      );
      const stored = this.get(input.productId, input.country);
      if (!stored) throw new Error("Failed to persist compliance check.");
      return stored;
    },

    get(productId, country) {
      const row = db
        .prepare("SELECT * FROM compliance_checks WHERE product_id = ? AND country = ?")
        .get(productId, country) as Record<string, unknown> | undefined;
      return row ? mapRow(row) : null;
    },

    getByProduct(productId) {
      const rows = db
        .prepare("SELECT * FROM compliance_checks WHERE product_id = ? ORDER BY country ASC")
        .all(productId) as Array<Record<string, unknown>>;
      return rows.map(mapRow);
    },

    deleteByProduct(productId) {
      db.prepare("DELETE FROM compliance_checks WHERE product_id = ?").run(productId);
    },
  };
}