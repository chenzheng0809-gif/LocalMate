import { nowIso } from "@/lib/db/client";
import type { Repositories } from "@/lib/repositories";
import { buildPricingScenario } from "@/lib/market/pricing";
import { getFxRates } from "@/lib/market/fx";
import { productMarketFitMetric } from "@/lib/market/metrics";
import { buildMatchAnalysis } from "@/lib/matching/engine";
import { clamp, round } from "@/lib/utils/money";
import type {
  ComplianceData,
  Country,
  MarketResearchData,
  MetricValue,
  ProductDNA,
  SimulationImpact,
  SimulationOverrides,
  SimulationResult,
} from "@/types/domain";
import { COUNTRY_META } from "@/types/domain";
import type { PricingScenario } from "@/types/domain";
import { AppError } from "@/lib/errors";

function marginMetric(pricing: PricingScenario): MetricValue {
  if (pricing.grossMarginPct === null) {
    return {
      score: null,
      confidence: "LOW",
      evidenceIds: pricing.benchmarkEvidenceIds,
      missingData: ["利润输入"],
      note: "INSUFFICIENT_EVIDENCE：该情景无法计算利润。",
    };
  }
  return {
    score: round(clamp(((pricing.grossMarginPct - 0.1) / 0.5) * 100), 1),
    confidence: pricing.confidence,
    evidenceIds: pricing.benchmarkEvidenceIds,
    missingData: ["已核实的供应商报价", "实际平台费率表"],
    note: `What-if 情景毛利率 ${(pricing.grossMarginPct * 100).toFixed(1)}%。仅为情景。`,
  };
}

function applyOverrides(product: ProductDNA, overrides: SimulationOverrides): ProductDNA {
  return {
    ...product,
    name: overrides.name ?? product.name,
    attributes: {
      ...product.attributes,
      material: overrides.material !== undefined ? overrides.material : product.attributes.material,
      dimensions: overrides.dimensions !== undefined ? overrides.dimensions : product.attributes.dimensions,
      weight: overrides.weight !== undefined ? overrides.weight : product.attributes.weight,
      intendedUse: overrides.intendedUse !== undefined ? overrides.intendedUse : product.attributes.intendedUse,
    },
    sourcing: {
      ...product.sourcing,
      priceCNY:
        overrides.supplierCostCNY !== undefined ? overrides.supplierCostCNY : product.sourcing.priceCNY,
    },
    updatedAt: nowIso(),
  };
}

export async function runSimulation(input: {
  repos: Repositories;
  productId: string;
  overrides: SimulationOverrides;
  label?: string;
  countries?: Country[];
}): Promise<SimulationResult> {
  const { repos, productId, overrides } = input;
  const product = repos.products.getById(productId);
  if (!product) throw new AppError("产品不存在。", { status: 404 });
  const markets = repos.research.getByProduct(productId);
  const compliance = repos.compliance.getByProduct(productId);
  if (markets.length === 0) {
    throw new AppError("请先运行市场研究，再做 What-if 模拟。", { status: 409 });
  }
  const beforeMatch = repos.matches.getLatest(productId) ?? buildMatchAnalysis({ product, markets, compliance });
  const beforeLaunch = repos.launch.getLatestByProduct(productId);
  const afterProduct = applyOverrides(product, overrides);
  const selected = input.countries && input.countries.length > 0
    ? input.countries
    : markets.map((market) => market.country);
  const fx = await getFxRates();

  const materialChanged = overrides.material !== undefined && overrides.material !== product.attributes.material;
  const dimensionsChanged = overrides.dimensions !== undefined && overrides.dimensions !== product.attributes.dimensions;
  const productChanged =
    materialChanged ||
    dimensionsChanged ||
    (overrides.weight !== undefined && overrides.weight !== product.attributes.weight) ||
    (overrides.name !== undefined && overrides.name !== product.name) ||
    (overrides.intendedUse !== undefined && overrides.intendedUse !== product.attributes.intendedUse);

  const afterMarkets: MarketResearchData[] = markets.map((market) => {
    if (!selected.includes(market.country)) return market;
    const pricing = buildPricingScenario({
      product: afterProduct,
      country: market.country,
      competitors: market.competitors,
      fx,
      benchmarkEvidenceIds: market.metrics.marginPotential.evidenceIds,
      overrides: {
        shippingCost: overrides.shippingCost,
        dutyRatePct: overrides.dutyRatePct,
        platformFeePct: overrides.platformFeePct,
        targetPrice: overrides.targetPrice,
      },
    });
    const evidenceIds = market.competitors.map((competitor) => competitor.sourceEvidenceId);
    const fit = productChanged
      ? productMarketFitMetric(afterProduct, market.competitors, evidenceIds)
      : market.metrics.productMarketFit;
    return {
      ...market,
      pricing,
      metrics: {
        ...market.metrics,
        marginPotential: marginMetric(pricing),
        productMarketFit: fit,
      },
    };
  });

  const afterCompliance: ComplianceData[] = compliance.map((check) => {
    if (!selected.includes(check.country)) return check;
    if (!materialChanged) return check;
    return {
      ...check,
      status: "REVIEW_REQUIRED",
      statusReason:
        "WHAT-IF 后失效：材质已变化，之前的官方证据可能不再适用。依赖此合规门前请重新运行预检。",
      issues: [
        ...check.issues,
        {
          id: "simulation_stale_compliance",
          type: "MISSING_EVIDENCE",
          severity: "HIGH",
          action: "修改材质后重新运行合规预检。",
          verified: false,
          evidenceIds: [],
        },
      ],
      researchedAt: nowIso(),
    };
  });

  const afterMatch = buildMatchAnalysis({ product: afterProduct, markets: afterMarkets, compliance: afterCompliance });
  const impacts: SimulationImpact[] = [
    {
      module: "PRODUCT_DNA",
      changed: productChanged,
      action: productChanged ? "RECOMPUTED" : "UNCHANGED",
      detail: productChanged
        ? "产品属性仅在本次情景中覆盖；已保存的产品未被修改。"
        : "产品属性没有变化。",
    },
    {
      module: "PRICING",
      changed: true,
      action: "RECOMPUTED",
      detail: `已重建定价情景，使用${fx.isLive ? "实时参考汇率" : "备用规划汇率"}${overrides.targetPrice ? "，以及用户目标价" : ""}。`,
    },
    {
      module: "COMPLIANCE",
      changed: materialChanged,
      action: materialChanged ? "REQUIRES_RERUN" : "UNCHANGED",
      detail: materialChanged
        ? "材质已变化，但未重新抓取官方来源证据，因此情景后的合规门保守设为 REVIEW_REQUIRED。"
        : "本次情景没有改变合规输入。",
    },
    {
      module: "MARKET_MATCH",
      changed: true,
      action: "RECOMPUTED",
      detail: `已重新计算 ${selected.map((country) => COUNTRY_META[country].name).join("、")} 的排名；加权分不含合规门。`,
    },
    {
      module: "LAUNCH_PAGE",
      changed: Boolean(beforeLaunch && (productChanged || overrides.targetPrice !== undefined || overrides.supplierCostCNY !== undefined)),
      action: beforeLaunch && (productChanged || overrides.targetPrice !== undefined || overrides.supplierCostCNY !== undefined)
        ? "INVALIDATED"
        : "UNCHANGED",
      detail: beforeLaunch
        ? "现有发布文案可能引用了过时的产品或价格事实；发布前请重新生成。"
        : "还没有发布页。",
    },
  ];

  return repos.simulations.create({
    productId,
    label: input.label ?? `What-if 场景 ${new Date().toISOString().slice(0, 16).replace("T", " ")}`,
    overrides,
    impacts,
    before: { product, match: beforeMatch, compliance, markets },
    after: { product: afterProduct, match: afterMatch, compliance: afterCompliance, markets: afterMarkets },
  });
}
