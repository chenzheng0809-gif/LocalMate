import type {
  Competitor,
  Country,
  PricingLineItem,
  PricingScenario,
  ProductDNA,
} from "@/types/domain";
import { COUNTRY_META } from "@/types/domain";
import { cnyToLocal, localToCny, type FxRates } from "@/lib/market/fx";
import { median } from "@/lib/market/metrics";
import { round } from "@/lib/utils/money";

const DUTY_ASSUMPTIONS: Record<Country, number> = {
  US: 0.034,
  JP: 0.039,
  DE: 0.065,
  UK: 0.065,
};

const PLATFORM_FEE = 0.15;
const PAYMENT_FEE = 0.02;
const TARGET_CONTRIBUTION_MARGIN = 0.3;

export function buildPricingScenario(input: {
  product: ProductDNA;
  country: Country;
  competitors: Competitor[];
  fx: FxRates;
  benchmarkEvidenceIds: string[];
  overrides?: {
    shippingCost?: number | null;
    dutyRatePct?: number | null;
    platformFeePct?: number | null;
    targetPrice?: number | null;
  };
  benchmarkSampleNote?: string;
}): PricingScenario {
  const { product, country, competitors, fx } = input;
  const currency = COUNTRY_META[country].currency;
  const prices = competitors
    .filter((competitor) => competitor.currency === currency)
    .map((competitor) => competitor.price)
    .filter((price): price is number => typeof price === "number" && price > 0);
  const benchmark = median(prices);
  const benchmarkCny = benchmark !== null ? localToCny(benchmark, currency, fx) : null;

  const priceCny = product.sourcing.priceCNY;
  const purchaseCost = priceCny ?? (benchmarkCny !== null ? round(benchmarkCny * 0.32, 2) : 0);
  const purchaseSource: PricingLineItem["source"] = priceCny
    ? "USER_INPUT"
    : benchmarkCny !== null
      ? "SCENARIO_ASSUMPTION"
      : "UNKNOWN";
  const weight = product.attributes.weight;
  const internationalShipping =
    input.overrides?.shippingCost !== undefined && input.overrides.shippingCost !== null
      ? round(input.overrides.shippingCost, 2)
      : weight
        ? round(30 + weight * 24, 2)
        : 55;
  const dutyRate =
    input.overrides?.dutyRatePct !== undefined && input.overrides.dutyRatePct !== null
      ? input.overrides.dutyRatePct / 100
      : DUTY_ASSUMPTIONS[country];
  const duty = round((purchaseCost + internationalShipping) * dutyRate, 2);
  const packaging = 8;
  const otherCosts = 12;
  const landedCost = round(purchaseCost + internationalShipping + duty + packaging + otherCosts, 2);

  const marginFloorCny =
    landedCost > 0
      ? landedCost / (1 - PLATFORM_FEE - PAYMENT_FEE - TARGET_CONTRIBUTION_MARGIN)
      : null;
  const marginFloorLocal = marginFloorCny !== null ? cnyToLocal(marginFloorCny, currency, fx) : null;
  let suggestedRetail =
    input.overrides?.targetPrice !== undefined && input.overrides.targetPrice !== null
      ? round(input.overrides.targetPrice, 2)
      : benchmark !== null
        ? round(Math.max(benchmark * 0.95, marginFloorLocal ?? 0), 1)
        : null;
  if (suggestedRetail === null && landedCost > 0) {
    const local = cnyToLocal(landedCost * 2.35, currency, fx);
    suggestedRetail = local !== null ? round(local, 1) : null;
  }
  const retailCny = suggestedRetail !== null ? localToCny(suggestedRetail, currency, fx) : null;
  const platformFeeRate =
    input.overrides?.platformFeePct !== undefined && input.overrides.platformFeePct !== null
      ? input.overrides.platformFeePct / 100
      : PLATFORM_FEE;
  const platformFees = retailCny !== null ? round(retailCny * platformFeeRate, 2) : 0;
  const paymentFees = retailCny !== null ? round(retailCny * PAYMENT_FEE, 2) : 0;
  const grossMarginPct =
    retailCny !== null && retailCny > 0
      ? round((retailCny - landedCost - platformFees - paymentFees) / retailCny, 3)
      : null;

  const lineItems: PricingLineItem[] = [
    {
      key: "purchase",
      label: "供应商采购成本",
      amount: purchaseCost,
      currency: "CNY",
      source: purchaseSource,
      note: priceCny ? "来自产品简报。" : "情景假设：取本地基准零售价的 32%。",
    },
    {
      key: "shipping",
      label: "国际运费（情景）",
      amount: internationalShipping,
      currency: "CNY",
      source: "SCENARIO_ASSUMPTION",
      note: weight
        ? `按 ${weight} kg 规划的启发式估算，不是承运商报价。`
        : "启发式规划；产品重量缺失，使用了默认值。",
    },
    {
      key: "duty",
      label: `进口关税（假设 ${(dutyRate * 100).toFixed(1)}%）`,
      amount: duty,
      currency: "CNY",
      source: "SCENARIO_ASSUMPTION",
      note: "仅为规划假设。正式税率取决于最终 HS 编码和海关裁定。",
    },
    { key: "packaging", label: "包装", amount: packaging, currency: "CNY", source: "SCENARIO_ASSUMPTION" },
    { key: "other", label: "其他到岸成本", amount: otherCosts, currency: "CNY", source: "SCENARIO_ASSUMPTION" },
    {
      key: "platform",
      label: `平台佣金（${(platformFeeRate * 100).toFixed(1)}%）`,
      amount: platformFees,
      currency: "CNY",
      source: "SCENARIO_ASSUMPTION",
    },
    {
      key: "payment",
      label: "支付手续费（2%）",
      amount: paymentFees,
      currency: "CNY",
      source: "SCENARIO_ASSUMPTION",
    },
  ];

  return {
    country,
    currency,
    purchaseCost,
    internationalShipping,
    duty,
    platformFees,
    paymentFees,
    packaging,
    otherCosts,
    landedCost,
    benchmarkRetail: benchmark,
    suggestedRetail,
    grossMarginPct,
    assumptions: [
      priceCny
        ? "供应商价格由用户提供，尚未经过独立核实。"
        : "供应商价格缺失，已用情景值（基准零售价的 32%）替代并明确标注。",
      "国际运费、关税、平台佣金和支付费率都是规划假设，不是报价。",
      "进口增值税 / 消费税和退货成本未完整建模。",
      ...(weight ? [] : ["产品重量缺失；国际运费使用 55 元人民币的默认规划值，不是承运商报价。"]),
      "建议零售价目标是在扣除平台佣金和支付手续费后至少保留 30% 贡献毛利；这是规划下限，不是定价建议。",
      ...(input.benchmarkSampleNote ? [input.benchmarkSampleNote] : []),
      ...(benchmark !== null && suggestedRetail !== null && suggestedRetail > benchmark * 1.05
        ? ["观察到的基准价低于建模的贡献毛利下限，因此建议价高于观察样本，必须向买家测试。"]
        : []),
      "汇率是每日参考价，未包含银行卡、平台和提现的换汇费用。",
      ...(input.overrides?.targetPrice !== undefined && input.overrides.targetPrice !== null
        ? ["What-if 目标零售价由用户输入，不是市场观察。"]
        : []),
      ...(input.overrides?.dutyRatePct !== undefined && input.overrides.dutyRatePct !== null
        ? ["What-if 关税率由用户输入，不是官方归类。"]
        : []),
      "所有数字都是用于优先级判断的情景估算，不是到岸成本审计。",
    ],
    lineItems,
    fxRate: fx.rates[currency] ?? null,
    fxSource: `${fx.source}${fx.isLive ? "" : "（规划备用值）"}`,
    isScenarioOnly: true,
    confidence: priceCny && benchmark !== null ? "MEDIUM" : "LOW",
    benchmarkEvidenceIds: input.benchmarkEvidenceIds,
  };
}
