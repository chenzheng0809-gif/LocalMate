import type { AIProvider } from "@/lib/ai/types";
import { config } from "@/lib/config";
import { nowIso } from "@/lib/db/client";
import type { Repositories } from "@/lib/repositories";
import { assertInScope } from "@/lib/product/service";
import { getSearchClient } from "@/lib/search";
import type { SearchClient } from "@/lib/search/types";
import { mapLimit } from "@/lib/utils/async";
import { researchMarket } from "@/lib/market/service";
import { runComplianceCheck } from "@/lib/compliance/service";
import { buildMatchAnalysis } from "@/lib/matching/engine";
import { COUNTRY_META, COUNTRY_ORDER } from "@/types/domain";
import type {
  ComplianceData,
  Country,
  MarketResearchData,
  MetricKey,
  MetricValue,
  ProductDNA,
  ResearchJob,
} from "@/types/domain";
import { AppError } from "@/lib/errors";

function nullMetric(note: string): MetricValue {
  return { score: null, confidence: "LOW", evidenceIds: [], missingData: ["研究未完成"], note };
}

function failedMarket(product: ProductDNA, country: Country, error: string): MarketResearchData {
  const metrics: Record<MetricKey, MetricValue> = {
    demand: nullMetric(error),
    productMarketFit: nullMetric(error),
    competition: nullMetric(error),
    marginPotential: nullMetric(error),
    localizationEffort: nullMetric(error),
    entryFriction: nullMetric(error),
  };
  return {
    country,
    status: "FAILED",
    dataMode: product.mode === "DEMO" ? "DEMO" : "LOCAL_EVIDENCE",
    searchMode: "NONE",
    competitors: [],
    customerNeeds: {
      focusAttributes: [],
      purchaseReasons: [],
      potentialGaps: [],
      hypotheses: [],
      evidenceIds: [],
      note: "研究失败；不提出客户需求陈述。",
    },
    demandSignals: {
      level: "NOT_ENOUGH_DATA",
      indicators: [],
      summary: "研究未完成。",
      confidence: "LOW",
      evidenceIds: [],
    },
    competition: {
      level: "NOT_ENOUGH_DATA",
      positioningPatterns: [],
      differentiationOpportunities: [],
      summary: "研究未完成。",
      evidenceIds: [],
    },
    pricing: {
      country,
      currency: "USD",
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
      assumptions: ["研究失败；未生成定价情景。"],
      lineItems: [],
      fxRate: null,
      fxSource: "unavailable",
      isScenarioOnly: true,
      confidence: "LOW",
      benchmarkEvidenceIds: [],
    },
    metrics,
    narrative: {
      landscapeSummary: `Market research failed for ${country}: ${error}`,
      positioningPatterns: [],
      differentiationOpportunities: [],
      localizationNotes: [],
      risks: ["没有收集到可用证据。"],
    },
    evidenceIds: [],
    warnings: [error],
    missingData: ["All market evidence"],
    researchedAt: nowIso(),
    coverage: 0,
    agentTrace: [
      { step: "market-research", status: "FAILED", detail: error },
    ],
  };
}

export interface ResearchWorkflowDeps {
  repos: Repositories;
  ai: AIProvider | null;
  search?: SearchClient;
  assertOwnership?: () => void;
  onEvent?: (event: { level: "INFO" | "SUCCESS" | "WARN" | "ERROR"; phase: string; message: string; country?: Country | null; meta?: Record<string, unknown> }) => void;
}

export function enqueueResearchJob(
  deps: Pick<ResearchWorkflowDeps, "repos">,
  input: { productId: string; countries: Country[]; force?: boolean },
): ResearchJob {
  const product = deps.repos.products.getById(input.productId);
  if (!product) throw new AppError("产品不存在。", { status: 404 });
  assertInScope(product);
  if (!product.confirmed) {
    throw new AppError(
      "开始研究前请确认产品简报，避免把 AI 推断字段当成事实。",
      { status: 409, code: "PRODUCT_NOT_CONFIRMED" },
    );
  }
  const countries = COUNTRY_ORDER.filter(country => !input.countries.length || input.countries.includes(country));
  const latest = deps.repos.jobs.getLatestByProduct(product.id);
  if (!input.force && latest && (latest.status === "PENDING" || latest.status === "RUNNING") &&
    countries.length === latest.countries.length && countries.every(country => latest.countries.includes(country))) {
    return latest;
  }
  const job = deps.repos.jobs.create(product.id, countries);
  deps.repos.jobs.addEvent({
    jobId: job.id,
    level: "INFO",
    phase: "queued",
    message: `研究已排队：${countries.map((country) => COUNTRY_META[country].name).join("、")}。`,
  });
  return job;
}

export async function executeResearchJob(deps: ResearchWorkflowDeps, jobId: string): Promise<ResearchJob> {
  const { repos } = deps;
  const guard = deps.assertOwnership ?? (() => {});
  guard();
  const job = repos.jobs.claim(jobId);
  if (!job) {
    const existing = repos.jobs.getById(jobId);
    if (!existing) throw new AppError("研究任务不存在。", { status: 404 });
    return existing;
  }
  const product = repos.products.getById(job.productId);
  if (!product) throw new AppError("产品不存在。", { status: 404 });
  const ai = deps.ai;
  const search = deps.search ?? getSearchClient();
  const startedAt = job.startedAt ?? nowIso();
  const totalSteps = job.countries.length * 2 + 1;
  let completed = 0;

  const emit = (
    level: "INFO" | "SUCCESS" | "WARN" | "ERROR",
    phase: string,
    message: string,
    country?: Country | null,
    meta?: Record<string, unknown>,
  ) => {
    guard();
    repos.jobs.addEvent({ jobId: job.id, level, phase, message, country: country ?? null, meta });
    deps.onEvent?.({ level, phase, message, country: country ?? null, meta });
  };

  const progress = (stage: string) => {
    guard();
    const value = Math.min(99, Math.round((completed / totalSteps) * 100));
    repos.jobs.update(job.id, { status: "RUNNING", progress: value, currentStage: stage, startedAt });
  };

  try {
    assertInScope(product);
    if (!product.confirmed) throw new AppError("产品简报已更新，请重新确认后重试。", { status: 409 });
    const validateProduct = () => {
      guard();
      const current = repos.products.getById(product.id);
      if (!current?.confirmed || current.updatedAt !== product.updatedAt) {
        throw new AppError("研究期间产品简报已更新，请重新确认后重试。", { status: 409 });
      }
    };
    progress("开始研究");
    emit("INFO", "start", `已开始研究：${product.name}。`, null, {
      countries: job.countries,
      searchMode: search.mode,
      aiConfigured: Boolean(ai),
    });

    const marketResults: MarketResearchData[] = [];
    await mapLimit(job.countries, config.maxResearchConcurrency, async (country) => {
      emit("INFO", "market", `正在研究${COUNTRY_META[country].name}的需求、竞品和价格。`, country);
      try {
        const result = await researchMarket({
          product,
          country,
          repos,
          ai,
          search,
          onStep: (message, meta) => emit("INFO", "market", message, country, meta),
        });
        validateProduct();
        repos.evidence.insertMany(result.evidence);
        const stored = repos.research.upsert({
          jobId: job.id,
          productId: product.id,
          country,
          status: result.data.status,
          data: result.data,
        });
        marketResults.push(stored);
        emit(
          result.data.status === "COMPLETE" ? "SUCCESS" : "WARN",
          "market",
          `${COUNTRY_META[country].name}：${result.data.competitors.length} 个可比商品；${result.data.status}。`,
          country,
          { coverage: result.data.coverage, searchMode: result.data.searchMode },
        );
      } catch (error) {
        validateProduct();
        const message = error instanceof Error ? error.message : "Unknown market research failure";
        const fallback = failedMarket(product, country, message);
        repos.research.upsert({
          jobId: job.id,
          productId: product.id,
          country,
          status: "FAILED",
          data: fallback,
        });
        marketResults.push(fallback);
        emit("ERROR", "market", `${COUNTRY_META[country].name}：${message}`, country);
      } finally {
        completed += 1;
        progress(`市场研究 ${completed}/${job.countries.length}`);
      }
    });

    const complianceResults: ComplianceData[] = [];
    await mapLimit(job.countries, config.maxResearchConcurrency, async (country) => {
      emit("INFO", "compliance", `正在对${COUNTRY_META[country].name}执行官方来源合规预检。`, country);
      try {
        const result = await runComplianceCheck({
          product,
          country,
          ai,
          repos,
          onStep: (message, meta) => emit("INFO", "compliance", message, country, meta),
        });
        validateProduct();
        repos.evidence.insertMany(result.evidence);
        const stored = repos.compliance.upsert({ productId: product.id, country, data: result.data });
        complianceResults.push(stored);
        emit(
          result.data.status === "REVIEW_REQUIRED" ? "WARN" : "SUCCESS",
          "compliance",
          `${COUNTRY_META[country].name}：${result.data.status} — ${result.data.statusReason}`,
          country,
          { status: result.data.status },
        );
      } catch (error) {
        emit(
          "ERROR",
          "compliance",
          `${COUNTRY_META[country].name}：合规预检失败（${error instanceof Error ? error.message : "未知错误"}）。`,
          country,
        );
      } finally {
        completed += 1;
        progress(`合规预检 ${completed - job.countries.length}/${job.countries.length}`);
      }
    });

    validateProduct();
    const storedMarkets = repos.research.getByProduct(product.id);
    const storedCompliance = repos.compliance.getByProduct(product.id);
    const match = buildMatchAnalysis({ product, markets: storedMarkets, compliance: storedCompliance });
    repos.matches.save(product.id, match);
    completed += 1;
    repos.jobs.update(job.id, {
      status: marketResults.every(market => market.status === "COMPLETE") && complianceResults.length === job.countries.length
        ? "COMPLETED"
        : marketResults.some(market => market.status !== "FAILED")
          ? "PARTIAL"
          : "FAILED",
      progress: 100,
      currentStage: "完成",
      finishedAt: nowIso(),
      error: null,
    });
    emit(
      "SUCCESS",
      "match",
      match.recommendedCountry
        ? `排序完成。优先验证市场：${COUNTRY_META[match.recommendedCountry].name}。`
        : "排序完成，但没有市场达到可比证据门槛。",
      null,
      { status: match.status, recommendedCountry: match.recommendedCountry },
    );
    return repos.jobs.getById(job.id) ?? job;
  } catch (error) {
    guard();
    repos.jobs.update(job.id, {
      status: "FAILED",
      error: error instanceof Error ? error.message : "Unknown workflow failure",
      finishedAt: nowIso(),
    });
    emit("ERROR", "fatal", error instanceof Error ? error.message : "Unknown workflow failure");
    throw error;
  }
}

export async function runResearchSynchronously(
  deps: ResearchWorkflowDeps,
  input: { productId: string; countries: Country[]; force?: boolean },
): Promise<ResearchJob> {
  const job = enqueueResearchJob(deps, input);
  return executeResearchJob(deps, job.id);
}
