import type { AppDatabase } from "@/lib/db/client";
import { nowIso, parseJson, uid } from "@/lib/db/client";
import type { Country, MarketDataStatus, MarketResearchData } from "@/types/domain";

function mapRow(row: Record<string, unknown>): MarketResearchData {
  return parseJson<MarketResearchData>(row.data_json, {
    country: String(row.country) as Country,
    status: String(row.status) as MarketDataStatus,
    dataMode: "DEMO",
    searchMode: "NONE",
    competitors: [],
    customerNeeds: {
      focusAttributes: [],
      purchaseReasons: [],
      potentialGaps: [],
      hypotheses: [],
      evidenceIds: [],
      note: "",
    },
    demandSignals: {
      level: "NOT_ENOUGH_DATA",
      indicators: [],
      summary: "",
      confidence: "LOW",
      evidenceIds: [],
    },
    competition: {
      level: "NOT_ENOUGH_DATA",
      positioningPatterns: [],
      differentiationOpportunities: [],
      summary: "",
      evidenceIds: [],
    },
    pricing: {
      country: String(row.country) as Country,
      currency: "",
      purchaseCost: 0,
      internationalShipping: 0,
      duty: 0,
      platformFees: 0,
      paymentFees: 0,
      packaging: 0,
      otherCosts: 0,
      landedCost: 0,
      benchmarkRetail: null,
      suggestedRetail: null,
      grossMarginPct: null,
      assumptions: [],
      lineItems: [],
      fxRate: null,
      fxSource: "",
      isScenarioOnly: true,
      confidence: "LOW",
      benchmarkEvidenceIds: [],
    },
    metrics: {
      demand: { score: null, confidence: "LOW", evidenceIds: [], missingData: [] },
      productMarketFit: { score: null, confidence: "LOW", evidenceIds: [], missingData: [] },
      competition: { score: null, confidence: "LOW", evidenceIds: [], missingData: [] },
      marginPotential: { score: null, confidence: "LOW", evidenceIds: [], missingData: [] },
      localizationEffort: { score: null, confidence: "LOW", evidenceIds: [], missingData: [] },
      entryFriction: { score: null, confidence: "LOW", evidenceIds: [], missingData: [] },
    },
    narrative: {
      landscapeSummary: "",
      positioningPatterns: [],
      differentiationOpportunities: [],
      localizationNotes: [],
      risks: [],
    },
    evidenceIds: [],
    warnings: [],
    missingData: [],
    researchedAt: String(row.updated_at),
    coverage: 0,
    agentTrace: [],
  });
}

export interface ResearchRepository {
  upsert(input: {
    jobId: string | null;
    productId: string;
    country: Country;
    status: MarketDataStatus;
    data: MarketResearchData;
  }): MarketResearchData;
  get(productId: string, country: Country): MarketResearchData | null;
  getByProduct(productId: string): MarketResearchData[];
  listByJob(jobId: string): MarketResearchData[];
  deleteByProduct(productId: string): void;
}

export function createResearchRepository(db: AppDatabase): ResearchRepository {
  return {
    upsert(input) {
      const now = nowIso();
      const id = uid("mkt");
      db.prepare(
        `INSERT INTO market_research (id, job_id, product_id, country, status, data_json, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(product_id, country) DO UPDATE SET
           job_id = excluded.job_id, status = excluded.status, data_json = excluded.data_json,
           updated_at = excluded.updated_at`,
      ).run(
        id,
        input.jobId,
        input.productId,
        input.country,
        input.status,
        JSON.stringify(input.data),
        now,
        now,
      );
      const stored = this.get(input.productId, input.country);
      if (!stored) throw new Error("Failed to persist market research.");
      return stored;
    },

    get(productId, country) {
      const row = db
        .prepare("SELECT * FROM market_research WHERE product_id = ? AND country = ?")
        .get(productId, country) as Record<string, unknown> | undefined;
      return row ? mapRow(row) : null;
    },

    getByProduct(productId) {
      const rows = db
        .prepare("SELECT * FROM market_research WHERE product_id = ? ORDER BY country ASC")
        .all(productId) as Array<Record<string, unknown>>;
      return rows.map(mapRow);
    },

    listByJob(jobId) {
      const rows = db
        .prepare("SELECT * FROM market_research WHERE job_id = ? ORDER BY country ASC")
        .all(jobId) as Array<Record<string, unknown>>;
      return rows.map(mapRow);
    },

    deleteByProduct(productId) {
      db.prepare("DELETE FROM market_research WHERE product_id = ?").run(productId);
    },
  };
}