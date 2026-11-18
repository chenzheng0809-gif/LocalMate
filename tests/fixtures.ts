import type { Repositories } from "@/lib/repositories";
import type {
  ComplianceData,
  Country,
  MarketResearchData,
  MetricValue,
  ProductDNA,
} from "@/types/domain";
import type { SearchClient, SearchResponse, SearchResult } from "@/lib/search/types";
import type { FxRates } from "@/lib/market/fx";
import { COUNTRY_META } from "@/types/domain";

let sequence = 0;
const now = () => new Date().toISOString();

export function makeProduct(overrides: Partial<ProductDNA> = {}): ProductDNA {
  sequence += 1;
  const base: ProductDNA = {
    id: `prod_test_${sequence}`,
    sourcePlatform: "MANUAL",
    sourceUrl: null,
    name: "Walnut Desk Organizer with Drawer",
    category: "DESK_ORGANIZER",
    description: "Compact wooden desktop organizer with a pull-out drawer.",
    images: [],
    attributes: {
      material: "Walnut wood",
      dimensions: "32 × 18 × 12 cm",
      packagingDimensions: "34 × 20 × 14 cm",
      weight: 1.2,
      color: "Natural walnut",
      intendedUse: "Desktop organization",
      electrical: false,
    },
    sourcing: { priceCNY: 68, MOQ: 50, supplier: "Test supplier" },
    provenance: { name: "USER_CONFIRMED", "attributes.material": "USER_CONFIRMED" },
    missingFields: [],
    extractionStatus: "COMPLETE",
    confirmed: true,
    confirmedAt: now(),
    mode: "DEMO",
    createdAt: now(),
    updatedAt: now(),
  };
  return {
    ...base,
    ...overrides,
    attributes: { ...base.attributes, ...(overrides.attributes ?? {}) },
    sourcing: { ...base.sourcing, ...(overrides.sourcing ?? {}) },
    provenance: { ...base.provenance, ...(overrides.provenance ?? {}) },
  };
}

export function seedProduct(repos: Repositories, overrides: Partial<ProductDNA> = {}): ProductDNA {
  return repos.products.create(makeProduct(overrides));
}

function metric(score: number | null, evidenceIds: string[] = []): MetricValue {
  return {
    score,
    confidence: score === null ? "LOW" : "MEDIUM",
    evidenceIds,
    missingData: score === null ? ["Evidence"] : [],
    note: score === null ? "INSUFFICIENT_EVIDENCE" : "Test metric",
  };
}

export function makeMarket(country: Country, overrides: Partial<MarketResearchData> = {}): MarketResearchData {
  const meta = COUNTRY_META[country];
  const evidence = [`ev_${country}_1`, `ev_${country}_2`];
  const price = country === "JP" ? 2999 : country === "UK" ? 32 : country === "DE" ? 34 : 39;
  const base: MarketResearchData = {
    country,
    status: "COMPLETE",
    dataMode: "LOCAL_EVIDENCE",
    searchMode: "LOCAL_CORPUS",
    competitors: [1, 2, 3].map((index) => ({
      name: `Observed organizer ${country} ${index}`,
      productType: "Desk organizer",
      price: price + index,
      currency: meta.currency,
      brand: "Test",
      keySellingPoints: ["wood", "storage", "desk"],
      url: `https://www.ikea.com/${country.toLowerCase()}/test-${index}`,
      rating: 4.2 + index / 10,
      reviewCount: 100 * index,
      priceObservedAt: "2026-11-13",
      sourceEvidenceId: `ev_${country}_${index}`,
      dataOrigin: "RETAIL_PROBE",
    })),
    customerNeeds: {
      focusAttributes: ["wood", "desk"],
      purchaseReasons: ["observed listing emphasis"],
      potentialGaps: ["material not named"],
      hypotheses: [],
      evidenceIds: evidence,
      note: "Hypotheses only.",
    },
    demandSignals: {
      level: "MODERATE",
      indicators: [{ label: "Median rating count", value: 200, evidenceId: evidence[0] }],
      summary: "Observed ratings are a cumulative proxy, not sales.",
      confidence: "LOW",
      evidenceIds: evidence,
    },
    competition: {
      level: "MEDIUM",
      positioningPatterns: ["wood storage"],
      differentiationOpportunities: ["material story"],
      summary: "Small sample.",
      evidenceIds: evidence,
    },
    pricing: {
      country,
      currency: meta.currency,
      purchaseCost: 68 * 0.1407,
      internationalShipping: 58,
      duty: 2,
      platformFees: 6,
      paymentFees: 1,
      packaging: 0,
      otherCosts: 0,
      landedCost: 80,
      benchmarkRetail: price,
      suggestedRetail: price,
      grossMarginPct: 0.42,
      assumptions: ["Scenario only."],
      lineItems: [],
      fxRate: 0.1407,
      fxSource: "test",
      isScenarioOnly: true,
      confidence: "LOW",
      benchmarkEvidenceIds: evidence,
    },
    metrics: {
      demand: metric(80, evidence),
      productMarketFit: metric(78, evidence),
      competition: metric(65, evidence),
      marginPotential: metric(72, evidence),
      localizationEffort: metric(60, evidence),
      entryFriction: metric(null),
    },
    narrative: {
      landscapeSummary: "Observed comparable listings.",
      positioningPatterns: ["wood storage"],
      differentiationOpportunities: ["material story"],
      localizationNotes: ["local-language review needed"],
      risks: ["narrow sample"],
    },
    evidenceIds: evidence,
    warnings: ["Narrow public sample, not a market-wide scan."],
    missingData: ["Market-wide sales data"],
    researchedAt: now(),
    coverage: 0.95,
    agentTrace: [],
  };
  return { ...base, ...overrides, metrics: { ...base.metrics, ...(overrides.metrics ?? {}) } };
}

export function makeCompliance(country: Country, status: ComplianceData["status"] = "PRECHECK_COMPLETE"): ComplianceData {
  return {
    country,
    scopeStatus: "IN_SCOPE",
    status,
    statusReason: status === "PRECHECK_COMPLETE" ? "Evidence complete for this precheck." : "Evidence is incomplete.",
    hsCandidates: [
      {
        code: "3924.90",
        description: "Other household articles of plastics",
        rationale: "Test candidate",
        confidence: "LOW",
        verified: false,
        verificationNote: "Candidate only.",
        evidenceIds: [],
      },
    ],
    requirements: [
      {
        id: "test_rule",
        topic: "LABELING",
        title: "Country of origin marking",
        requirement: "Mark the country of origin.",
        appliesTo: "IMPORT",
        status: "APPLIES",
        evidenceIds: ["ev_test"],
        verified: status === "PRECHECK_COMPLETE",
        actionItems: ["Add origin marking to packaging artwork."],
      },
    ],
    importRequirements: [],
    marketRequirements: [],
    documentation: ["Commercial invoice"],
    missingAttributes: [],
    issues: [],
    actionItems: status === "ACTION_REQUIRED" ? ["Add origin marking."] : [],
    officialSources: [
      {
        title: "Test official source",
        url: "https://www.cbp.gov/test",
        domain: "cbp.gov",
        retrievedAt: now(),
        status: "FETCHED",
        evidenceId: "ev_test",
      },
    ],
    disclaimers: ["Not legal advice."],
    evidenceIds: ["ev_test"],
    researchedAt: now(),
    dataMode: "LOCAL_EVIDENCE",
    agentTrace: [],
  };
}

export function makeFx(): FxRates {
  return {
    base: "CNY",
    rates: { CNY: 1, USD: 0.1407, JPY: 21.9, EUR: 0.1215, GBP: 0.1072 },
    source: "test",
    fetchedAt: now(),
    isLive: false,
    note: "Test planning FX.",
  };
}

function searchResult(country: Country, index: number): SearchResult {
  const meta = COUNTRY_META[country];
  const price = country === "JP" ? 2999 + index * 100 : country === "UK" ? 32 + index : country === "DE" ? 34 + index : 39 + index;
  return {
    title: `Observed ${country} desk organizer ${index}`,
    url: `https://www.ikea.com/${country.toLowerCase()}/test-${index}`,
    snippet: "A wooden desk organizer with open storage and a drawer.",
    domain: "ikea.com",
    language: country === "JP" ? "ja" : country === "DE" ? "de" : "en",
    provider: "test",
    retrievedAt: now(),
    origin: "IMPORTED_LOCAL_RESEARCH",
    verificationStatus: "IMPORTED_SNAPSHOT",
    observedPrice: price,
    currency: meta.currency,
    rating: 4.3,
    reviewCount: 200 + index * 100,
  };
}

export function makeSearchClient(): SearchClient {
  const search = async (query: string, options?: { country?: Country }): Promise<SearchResponse> => {
    const country = options?.country ?? "US";
    return {
      query,
      provider: "test",
      mode: "LOCAL_CORPUS",
      results: [0, 1, 2, 3].map((index) => searchResult(country, index)),
      notes: ["Test corpus."],
      searchedAt: now(),
      cached: true,
    };
  };
  return {
    mode: "LOCAL_CORPUS",
    provider: "test",
    search,
    async searchMany(queries, options) {
      return Promise.all(queries.map((query) => search(query, options)));
    },
  };
}
