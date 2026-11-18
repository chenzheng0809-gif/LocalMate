/**
 * Core domain types for Product Passport.
 *
 * This file is intentionally dependency-free so it can be imported by both
 * server and client code. Runtime validation lives in /schemas.
 */

export const COUNTRIES = ["US", "JP", "DE", "UK"] as const;
export type Country = (typeof COUNTRIES)[number];

export const COUNTRY_META: Record<
  Country,
  {
    name: string;
    localName: string;
    language: string;
    locale: string;
    currency: string;
    currencySymbol: string;
    flag: string;
    amazonHost: string;
    timezone: string;
    mapPosition: { x: number; y: number };
  }
> = {
  US: {
    name: "美国",
    localName: "United States",
    language: "英语",
    locale: "en-US",
    currency: "USD",
    currencySymbol: "$",
    flag: "US",
    amazonHost: "www.amazon.com",
    timezone: "America/New_York",
    mapPosition: { x: 22, y: 38 },
  },
  JP: {
    name: "日本",
    localName: "日本",
    language: "日语",
    locale: "ja-JP",
    currency: "JPY",
    currencySymbol: "¥",
    flag: "JP",
    amazonHost: "www.amazon.co.jp",
    timezone: "Asia/Tokyo",
    mapPosition: { x: 84, y: 40 },
  },
  DE: {
    name: "德国",
    localName: "Deutschland",
    language: "德语",
    locale: "de-DE",
    currency: "EUR",
    currencySymbol: "€",
    flag: "DE",
    amazonHost: "www.amazon.de",
    timezone: "Europe/Berlin",
    mapPosition: { x: 51, y: 31 },
  },
  UK: {
    name: "英国",
    localName: "United Kingdom",
    language: "英语",
    locale: "en-GB",
    currency: "GBP",
    currencySymbol: "£",
    flag: "GB",
    amazonHost: "www.amazon.co.uk",
    timezone: "Europe/London",
    mapPosition: { x: 47, y: 28 },
  },
};

export const COUNTRY_ORDER: Country[] = ["US", "JP", "DE", "UK"];

export type CountryLanguage = "en" | "ja" | "de";

export const COUNTRY_LANGUAGE: Record<Country, CountryLanguage> = {
  US: "en",
  JP: "ja",
  DE: "de",
  UK: "en",
};

export const PRODUCT_CATEGORIES = [
  "DESK_ORGANIZER",
  "STORAGE_BOX",
  "SHELF_RACK",
  "DECOR_STORAGE",
  "OTHER_HOME_ORGANIZATION",
  "OUT_OF_SCOPE",
] as const;

export type ProductCategory = (typeof PRODUCT_CATEGORIES)[number];

export const CATEGORY_LABELS: Record<ProductCategory, string> = {
  DESK_ORGANIZER: "桌面收纳盒",
  STORAGE_BOX: "非电动储物盒",
  SHELF_RACK: "非电动置物架",
  DECOR_STORAGE: "装饰性家居收纳",
  OTHER_HOME_ORGANIZATION: "其他家居收纳",
  OUT_OF_SCOPE: "超出范围",
};

export const SUPPORTED_CATEGORIES: ProductCategory[] = [
  "DESK_ORGANIZER",
  "STORAGE_BOX",
  "SHELF_RACK",
  "DECOR_STORAGE",
  "OTHER_HOME_ORGANIZATION",
];

export type SourcePlatform = "1688" | "TAOBAO" | "MANUAL" | "IMAGE" | "DEMO";

export type FieldProvenance =
  | "SOURCE_EXTRACTED"
  | "AI_INFERRED"
  | "USER_CONFIRMED"
  | "UNKNOWN";

export type ExtractionStatus = "COMPLETE" | "PARTIAL" | "NEEDS_REVIEW";

export type ProductMode = "LIVE" | "DEMO";

export interface ProductAttributes {
  material: string | null;
  dimensions: string | null;
  packagingDimensions: string | null;
  weight: number | null;
  color: string | null;
  intendedUse: string | null;
  electrical: boolean | null;
  /**
   * Structured supplier attributes (商品属性) captured verbatim from the source
   * page or from image recognition. Keys and values are kept in the source
   * language so nothing is silently rewritten. Empty when the source exposed
   * no attribute table.
   */
  specifications?: Record<string, string> | null;
}

export interface ProductSourcing {
  priceCNY: number | null;
  MOQ: number | null;
  supplier: string | null;
}

export interface ProductDNA {
  id: string;
  sourcePlatform: SourcePlatform;
  sourceUrl?: string | null;
  name: string;
  category: ProductCategory;
  description?: string | null;
  images: string[];
  attributes: ProductAttributes;
  sourcing: ProductSourcing;
  /** field path (e.g. "attributes.material") -> provenance */
  provenance: Record<string, FieldProvenance>;
  missingFields: string[];
  extractionStatus: ExtractionStatus;
  confirmed: boolean;
  confirmedAt?: string | null;
  mode: ProductMode;
  createdAt: string;
  updatedAt: string;
}

export const EVIDENCE_TYPES = [
  "PRODUCT_LISTING",
  "RETAIL_PRICE",
  "RATING_SIGNAL",
  "OFFICIAL_REGULATION",
  "OFFICIAL_TARIFF",
  "OFFICIAL_GUIDANCE",
  "MARKET_REPORT",
  "AI_HYPOTHESIS",
  "USER_INPUT",
] as const;
export type EvidenceType = (typeof EVIDENCE_TYPES)[number];

export const VERIFICATION_STATUSES = [
  "VERIFIED",
  "PARTIALLY_VERIFIED",
  "UNVERIFIED",
  "IMPORTED_SNAPSHOT",
] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const EVIDENCE_ORIGINS = [
  "LIVE_SEARCH",
  "LIVE_FETCH",
  "RETAIL_PROBE",
  "IMPORTED_LOCAL_RESEARCH",
  "OFFICIAL_SOURCE",
  "USER_INPUT",
  "MODEL_INFERENCE",
] as const;
export type EvidenceOrigin = (typeof EVIDENCE_ORIGINS)[number];

export interface Evidence {
  id: string;
  productId: string;
  country: Country | null;
  kind: "MARKET" | "COMPLIANCE";
  sourceUrl: string | null;
  sourceTitle: string;
  sourceDomain: string;
  retrievedAt: string;
  relevantExcerpt: string;
  evidenceType: EvidenceType;
  claimSupported: string;
  verificationStatus: VerificationStatus;
  origin: EvidenceOrigin;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export type MarketDataStatus =
  | "COMPLETE"
  | "PARTIAL"
  | "INSUFFICIENT_EVIDENCE"
  | "FAILED";

export type Confidence = "HIGH" | "MEDIUM" | "LOW";

export interface MetricValue {
  /** null means no evidence — never silently substitute 50. */
  score: number | null;
  confidence: Confidence;
  evidenceIds: string[];
  missingData: string[];
  note?: string;
}

export interface Competitor {
  name: string;
  productType: string;
  price: number | null;
  currency: string | null;
  brand: string | null;
  keySellingPoints: string[];
  url: string;
  imageUrl?: string | null;
  rating?: number | null;
  reviewCount?: number | null;
  priceObservedAt?: string | null;
  sourceEvidenceId: string;
  dataOrigin: EvidenceOrigin;
}

export interface CustomerNeeds {
  focusAttributes: string[];
  purchaseReasons: string[];
  potentialGaps: string[];
  hypotheses: Array<{
    statement: string;
    basis: string;
    evidenceIds: string[];
    status: "HYPOTHESIS";
  }>;
  evidenceIds: string[];
  note: string;
}

export interface DemandSignals {
  level: "STRONG" | "MODERATE" | "WEAK" | "NOT_ENOUGH_DATA";
  indicators: Array<{
    label: string;
    value: number | string | null;
    evidenceId: string | null;
  }>;
  summary: string;
  confidence: Confidence;
  evidenceIds: string[];
}

export interface CompetitionAnalysis {
  level: "HIGH" | "MEDIUM" | "LOW" | "NOT_ENOUGH_DATA";
  positioningPatterns: string[];
  differentiationOpportunities: string[];
  summary: string;
  evidenceIds: string[];
}

export interface PricingLineItem {
  key: string;
  label: string;
  amount: number;
  currency: string;
  source: "USER_INPUT" | "SCENARIO_ASSUMPTION" | "BENCHMARK" | "UNKNOWN";
  note?: string;
}

export interface PricingScenario {
  country: Country;
  currency: string;
  purchaseCost: number;
  internationalShipping: number;
  duty: number;
  platformFees: number;
  paymentFees: number;
  packaging: number;
  otherCosts: number;
  landedCost: number;
  benchmarkRetail: number | null;
  suggestedRetail: number | null;
  grossMarginPct: number | null;
  assumptions: string[];
  lineItems: PricingLineItem[];
  fxRate: number | null;
  fxSource: string;
  isScenarioOnly: true;
  confidence: Confidence;
  benchmarkEvidenceIds: string[];
}

export interface MarketResearchData {
  country: Country;
  status: MarketDataStatus;
  dataMode: "LIVE" | "LOCAL_EVIDENCE" | "DEMO";
  searchMode: "LIVE_SEARCH" | "LOCAL_CORPUS" | "RETAIL_PROBE" | "NONE";
  competitors: Competitor[];
  customerNeeds: CustomerNeeds;
  demandSignals: DemandSignals;
  competition: CompetitionAnalysis;
  pricing: PricingScenario;
  metrics: {
    demand: MetricValue;
    productMarketFit: MetricValue;
    competition: MetricValue;
    marginPotential: MetricValue;
    localizationEffort: MetricValue;
    entryFriction: MetricValue;
  };
  narrative: {
    landscapeSummary: string;
    positioningPatterns: string[];
    differentiationOpportunities: string[];
    localizationNotes: string[];
    risks: string[];
  };
  evidenceIds: string[];
  warnings: string[];
  missingData: string[];
  researchedAt: string;
  coverage: number;
  agentTrace: AgentTraceStep[];
}

export interface AgentTraceStep {
  step: string;
  status: "OK" | "DEGRADED" | "FAILED" | "SKIPPED";
  detail: string;
  durationMs?: number;
}

export type ComplianceStatus =
  | "RESTRICTED"
  | "ACTION_REQUIRED"
  | "REVIEW_REQUIRED"
  | "PRECHECK_COMPLETE"
  | "OUT_OF_SCOPE";

export type ComplianceTopic =
  | "HS_CLASSIFICATION"
  | "IMPORT_RESTRICTIONS"
  | "PRODUCT_SAFETY"
  | "LABELING"
  | "PACKAGING"
  | "TARIFF"
  | "DOCUMENTATION"
  | "CHEMICAL"
  | "SUSTAINABILITY"
  | "MARKET_SURVEILLANCE";

export interface ComplianceIssue {
  id: string;
  type:
    | "MISSING_ATTRIBUTE"
    | "MISSING_EVIDENCE"
    | "ACTION_REQUIRED"
    | "AMBIGUOUS_CLASSIFICATION"
    | "RESTRICTION_FOUND"
    | "OUT_OF_SCOPE"
    | "UNVERIFIED_CLAIM";
  field?: string;
  topic?: ComplianceTopic;
  severity: "HIGH" | "MEDIUM" | "LOW" | "INFO";
  action: string;
  verified: boolean;
  evidenceIds: string[];
}

export interface ComplianceRequirement {
  id: string;
  topic: ComplianceTopic;
  title: string;
  requirement: string;
  appliesTo: "IMPORT" | "MARKET" | "BOTH" | "UNCERTAIN";
  status: "APPLIES" | "POSSIBLE" | "NEEDS_REVIEW" | "NOT_IDENTIFIED";
  evidenceIds: string[];
  verified: boolean;
  actionItems: string[];
}

export interface HSCandidate {
  code: string;
  description: string;
  rationale: string;
  confidence: Confidence;
  verified: boolean;
  verificationNote: string;
  evidenceIds: string[];
  countrySpecificNote?: string;
}

export interface ComplianceData {
  country: Country;
  scopeStatus: "IN_SCOPE" | "OUT_OF_SCOPE";
  status: ComplianceStatus;
  statusReason: string;
  hsCandidates: HSCandidate[];
  requirements: ComplianceRequirement[];
  importRequirements: ComplianceRequirement[];
  marketRequirements: ComplianceRequirement[];
  documentation: string[];
  missingAttributes: string[];
  issues: ComplianceIssue[];
  actionItems: string[];
  officialSources: Array<{
    title: string;
    url: string;
    domain: string;
    retrievedAt: string;
    status: "FETCHED" | "FETCH_FAILED" | "NOT_FETCHED";
    evidenceId: string | null;
  }>;
  disclaimers: string[];
  evidenceIds: string[];
  researchedAt: string;
  dataMode: "LIVE" | "LOCAL_EVIDENCE" | "DEMO";
  agentTrace: AgentTraceStep[];
}

export type MetricKey =
  | "demand"
  | "productMarketFit"
  | "competition"
  | "marginPotential"
  | "localizationEffort"
  | "entryFriction";

export const METRIC_META: Record<
  MetricKey,
  { label: string; weight: number; description: string; inverse?: boolean }
> = {
  demand: {
    label: "需求信号",
    weight: 0.22,
    description: "基于公开评分、评论数量和市场信号推导。",
  },
  productMarketFit: {
    label: "产品市场匹配",
    weight: 0.22,
    description: "与已观察竞品定位的功能重合度。",
  },
  competition: {
    label: "竞争空间",
    weight: 0.15,
    description: "分数越高，竞争越不拥挤、差异化空间越大。",
    inverse: true,
  },
  marginPotential: {
    label: "利润潜力",
    weight: 0.2,
    description: "扣除到岸成本和平台费用后的情景毛利率。",
  },
  localizationEffort: {
    label: "本地化准备度",
    weight: 0.1,
    description: "本地语言素材和市场适配需求的证据。",
  },
  entryFriction: {
    label: "进入阻力",
    weight: 0.11,
    description: "合规门槛与单证摩擦（分数越高越顺畅）。",
  },
};

export type MarketRecommendation =
  | "PRIORITY_TEST"
  | "SECONDARY_TEST"
  | "VALIDATE_FIRST"
  | "BLOCKED"
  | "INSUFFICIENT_DATA";

export type ComplianceGateOutcome = "CLEAR" | "CAUTION" | "BLOCKED" | "UNKNOWN";

export interface CountryMatch {
  country: Country;
  complianceGate: ComplianceGateOutcome;
  complianceStatus: ComplianceStatus | null;
  weightedScore: number | null;
  confidence: Confidence;
  coverage: number;
  rank: number | null;
  recommendation: MarketRecommendation;
  metrics: Record<MetricKey, MetricValue>;
  strengths: string[];
  risks: string[];
  missingData: string[];
  evidenceIds: string[];
  rationale: string;
}

export interface MatchAnalysis {
  productId: string;
  status:
    | "RANKED"
    | "COMPARISON_INCOMPLETE"
    | "NO_COMPARABLE_MARKETS"
    | "BLOCKED";
  countries: CountryMatch[];
  rankedCountries: Country[];
  recommendedCountry: Country | null;
  coverageSpread: number;
  explanation: string;
  missingData: string[];
  generatedAt: string;
}

export interface ResearchJob {
  id: string;
  productId: string;
  status: "PENDING" | "RUNNING" | "COMPLETED" | "PARTIAL" | "FAILED";
  countries: Country[];
  progress: number;
  currentStage: string | null;
  error: string | null;
  attempts: number;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
}

export interface ResearchJobEvent {
  id: string;
  jobId: string;
  country: Country | null;
  level: "INFO" | "SUCCESS" | "WARN" | "ERROR";
  phase: string;
  message: string;
  meta?: Record<string, unknown>;
  createdAt: string;
}

export interface LaunchPageContent {
  country: Country;
  language: string;
  currency: string;
  headline: string;
  subheadline: string;
  description: string;
  features: Array<{ title: string; description: string }>;
  targetAudience: string[];
  price: number | null;
  priceNote: string;
  complianceChecklist: Array<{ item: string; status: "OPEN" | "DONE" | "VERIFY"; sourceUrl?: string }>;
  supplierQuestions: string[];
  ctaLabel: string;
  generatedBy: "AI" | "TEMPLATE";
  model?: string;
  generatedAt: string;
  evidenceIds: string[];
}

export interface SimulationOverrides {
  name?: string;
  material?: string | null;
  dimensions?: string | null;
  weight?: number | null;
  supplierCostCNY?: number | null;
  shippingCost?: number | null;
  dutyRatePct?: number | null;
  platformFeePct?: number | null;
  targetPrice?: number | null;
  intendedUse?: string | null;
}

export interface SimulationImpact {
  module:
    | "PRODUCT_DNA"
    | "PRICING"
    | "MARKET_MATCH"
    | "COMPLIANCE"
    | "LAUNCH_PAGE";
  changed: boolean;
  action: "RECOMPUTED" | "INVALIDATED" | "UNCHANGED" | "REQUIRES_RERUN";
  detail: string;
}

export interface SimulationResult {
  id: string;
  productId: string;
  label: string;
  overrides: SimulationOverrides;
  impacts: SimulationImpact[];
  before: {
    product: ProductDNA;
    match: MatchAnalysis | null;
    compliance: ComplianceData[];
    /** Present in newer simulations; kept optional for stored snapshots. */
    markets?: MarketResearchData[];
  };
  after: {
    product: ProductDNA;
    match: MatchAnalysis | null;
    compliance: ComplianceData[];
    /** Present in newer simulations; kept optional for stored snapshots. */
    markets?: MarketResearchData[];
  };
  createdAt: string;
}

export interface PassportSnapshot {
  passportId: string;
  version: number;
  product: ProductDNA;
  job: ResearchJob | null;
  markets: MarketResearchData[];
  compliance: ComplianceData[];
  match: MatchAnalysis | null;
  launchPage: LaunchPageContent | null;
  evidence: Evidence[];
  nextActions: string[];
  generatedAt: string;
  dataMode: "LIVE" | "LOCAL_EVIDENCE" | "DEMO";
  disclaimer: string;
}

export interface AppModeInfo {
  appMode: "LIVE" | "DEMO";
  ai: {
    configured: boolean;
    provider: string;
    model: string;
    vision: boolean;
  };
  search: {
    provider: string;
    configured: boolean;
    mode: "LIVE_SEARCH" | "LOCAL_CORPUS" | "NONE";
    note: string;
  };
  database: {
    driver: "node:sqlite";
    path: string;
  };
}