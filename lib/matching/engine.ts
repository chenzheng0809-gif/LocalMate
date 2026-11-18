import type {
  ComplianceData,
  ComplianceGateOutcome,
  Country,
  CountryMatch,
  MarketRecommendation,
  MarketResearchData,
  MatchAnalysis,
  MetricKey,
  MetricValue,
  ProductDNA,
} from "@/types/domain";
import { COUNTRY_META, METRIC_META } from "@/types/domain";
import { clamp, round } from "@/lib/utils/money";

const SCORING_METRICS: MetricKey[] = [
  "demand",
  "productMarketFit",
  "competition",
  "marginPotential",
  "localizationEffort",
];

function gateFor(compliance: ComplianceData | null): {
  gate: ComplianceGateOutcome;
  score: number | null;
  note: string;
} {
  if (!compliance) {
    return {
      gate: "UNKNOWN",
      score: null,
      note: "尚未附加合规预检。市场分不能视为可发布。",
    };
  }
  if (compliance.status === "RESTRICTED" || compliance.status === "OUT_OF_SCOPE") {
    return {
      gate: "BLOCKED",
      score: 0,
      note: `合规门：${compliance.status}。${compliance.statusReason}`,
    };
  }
  if (compliance.status === "REVIEW_REQUIRED") {
    return {
      gate: "CAUTION",
      score: 45,
      note: `合规复核未完成：${compliance.statusReason}`,
    };
  }
  if (compliance.status === "ACTION_REQUIRED") {
    return {
      gate: "CAUTION",
      score: 60,
      note: `仍需完成合规动作：${compliance.statusReason}`,
    };
  }
  return {
    gate: "CLEAR",
    score: 90,
    note: `本范围的预检证据完整。${compliance.statusReason}`,
  };
}

function marketMetricScore(market: MarketResearchData, key: MetricKey): MetricValue {
  return market.metrics[key];
}

function numericMetrics(market: MarketResearchData, gateValue: MetricValue): Record<MetricKey, MetricValue> {
  return {
    ...market.metrics,
    entryFriction: gateValue,
  };
}

function scoreCountry(
  market: MarketResearchData,
  compliance: ComplianceData | null,
): {
  weightedScore: number | null;
  coverage: number;
  metrics: Record<MetricKey, MetricValue>;
  gate: ComplianceGateOutcome;
  gateNote: string;
  strengths: string[];
  risks: string[];
  missingData: string[];
} {
  const gate = gateFor(compliance);
  const gateMetric: MetricValue = {
    score: gate.score,
    confidence: compliance ? "MEDIUM" : "LOW",
    evidenceIds: compliance?.evidenceIds.slice(0, 12) ?? [],
    missingData: compliance ? [] : ["合规预检"],
    note: `${gate.note} 合规门仅供参考，不计入加权市场分。`,
  };
  const metrics = numericMetrics(market, gateMetric);
  const available = SCORING_METRICS.map((key) => ({ key, metric: marketMetricScore(market, key) })).filter(
    (item): item is { key: MetricKey; metric: MetricValue & { score: number } } =>
      typeof item.metric.score === "number",
  );
  const coverage = available.length / SCORING_METRICS.length;
  const missingData = Array.from(
    new Set([
      ...market.missingData,
      ...SCORING_METRICS.filter((key) => typeof market.metrics[key].score !== "number").map(
        (key) => `指标：${METRIC_META[key].label}`,
      ),
      ...(compliance ? [] : ["合规预检"]),
    ]),
  );

  const strengths: string[] = [];
  const risks: string[] = [];
  for (const key of SCORING_METRICS) {
    const value = market.metrics[key].score;
    if (value === null) continue;
    if (value >= 65) strengths.push(`${METRIC_META[key].label}: ${Math.round(value)}/100`);
    if (value < 40) risks.push(`${METRIC_META[key].label}：信号偏弱（${Math.round(value)}/100）`);
  }
  if (gate.gate === "BLOCKED") risks.unshift("合规门为 BLOCKED。");
  if (gate.gate === "CAUTION") risks.unshift("合规尚未放行；仍需复核或卖家动作。");
  if (gate.gate === "CLEAR") strengths.push("本范围的合规预检证据完整。");
  if (coverage < 0.6) risks.push(`市场分输入只有 ${Math.round(coverage * 100)}% 可用。`);

  if (gate.gate === "BLOCKED" || coverage < 0.6) {
    return {
      weightedScore: null,
      coverage: round(coverage, 2),
      metrics,
      gate: gate.gate,
      gateNote: gate.note,
      strengths,
      risks,
      missingData,
    };
  }

  const totalWeight = available.reduce((sum, item) => sum + METRIC_META[item.key].weight, 0);
  const score = available.reduce(
    (sum, item) => sum + item.metric.score * METRIC_META[item.key].weight,
    0,
  ) / totalWeight;
  return {
    weightedScore: round(clamp(score), 1),
    coverage: round(coverage, 2),
    metrics,
    gate: gate.gate,
    gateNote: gate.note,
    strengths,
    risks,
    missingData,
  };
}

function recommendationFor(input: {
  gate: ComplianceGateOutcome;
  score: number | null;
  rank: number | null;
  coverage: number;
}): MarketRecommendation {
  if (input.gate === "BLOCKED") return "BLOCKED";
  if (input.score === null) return "INSUFFICIENT_DATA";
  if (input.gate === "UNKNOWN") return "VALIDATE_FIRST";
  if (input.rank === 1 && input.score >= 55) return "PRIORITY_TEST";
  if (input.rank !== null && input.rank <= 2) return "SECONDARY_TEST";
  return "VALIDATE_FIRST";
}

function rationaleFor(input: {
  country: Country;
  gate: ComplianceGateOutcome;
  gateNote: string;
  score: number | null;
  rank: number | null;
  strengths: string[];
  risks: string[];
  coverage: number;
}): string {
  const meta = COUNTRY_META[input.country];
  if (input.gate === "BLOCKED") {
    return `${meta.name}无法参与排名：${input.gateNote}`;
  }
  if (input.score === null) {
    return `${meta.name}的可比证据不足以形成市场分（覆盖率 ${Math.round(input.coverage * 100)}%）。`;
  }
  const strengths = input.strengths.slice(0, 2).join("; ");
  const risks = input.risks.slice(0, 2).join("; ");
  return `${meta.name}在加权市场模型中得到 ${input.score}/100（排名 ${input.rank ?? "—"}；输入覆盖率 ${Math.round(input.coverage * 100)}%）。${
    strengths ? `优势：${strengths}。` : ""
  } ${risks ? `风险：${risks}。` : ""} 合规门：${input.gate}。${input.gateNote} 这是验证优先级，不是发布批准。`;
}

export function buildMatchAnalysis(input: {
  product: ProductDNA;
  markets: MarketResearchData[];
  compliance: ComplianceData[];
}): MatchAnalysis {
  const { product, markets, compliance } = input;
  const partial = markets.map((market) => {
    const check = compliance.find((item) => item.country === market.country) ?? null;
    return { market, check, ...scoreCountry(market, check) };
  });

  type PartialCountry = (typeof partial)[number];
  const rankable = (partial.filter((item) => item.weightedScore !== null) as Array<
    PartialCountry & { weightedScore: number }
  >).sort((a, b) => b.weightedScore - a.weightedScore);
  const rankByCountry = new Map<Country, number>();
  rankable.forEach((item, index) => rankByCountry.set(item.market.country, index + 1));

  const countries: CountryMatch[] = partial.map((item) => {
    const rank = rankByCountry.get(item.market.country) ?? null;
    return {
      country: item.market.country,
      complianceGate: item.gate,
      complianceStatus: item.check?.status ?? null,
      weightedScore: item.weightedScore,
      confidence:
        item.coverage >= 0.85 && rank !== null
          ? "MEDIUM"
          : item.coverage >= 0.6
            ? "LOW"
            : "LOW",
      coverage: item.coverage,
      rank,
      recommendation: recommendationFor({
        gate: item.gate,
        score: item.weightedScore,
        rank,
        coverage: item.coverage,
      }),
      metrics: item.metrics,
      strengths: item.strengths,
      risks: item.risks,
      missingData: item.missingData,
      evidenceIds: Array.from(
        new Set([
          ...item.market.evidenceIds,
          ...(item.check?.evidenceIds ?? []),
        ]),
      ).slice(0, 40),
      rationale: rationaleFor({
        country: item.market.country,
        gate: item.gate,
        gateNote: item.gateNote,
        score: item.weightedScore,
        rank,
        strengths: item.strengths,
        risks: item.risks,
        coverage: item.coverage,
      }),
    };
  });

  countries.sort((a, b) => {
    if (a.rank !== null && b.rank !== null) return a.rank - b.rank;
    if (a.rank !== null) return -1;
    if (b.rank !== null) return 1;
    return a.country.localeCompare(b.country);
  });

  const rankedCountries = rankable.map((item) => item.market.country);
  const eligible = countries.find(
    (country) => country.rank === 1 && country.complianceGate !== "BLOCKED",
  );
  const missingData = Array.from(
    new Set(countries.flatMap((country) => country.missingData)),
  ).slice(0, 18);

  if (rankedCountries.length === 0) {
    return {
      productId: product.id,
      status: "COMPARISON_INCOMPLETE",
      countries,
      rankedCountries: [],
      recommendedCountry: null,
      coverageSpread: 0,
      explanation:
        "没有市场具备足够的可比证据来形成加权分。请补充供应商成本/重量、重新研究或扩大证据集；应用不会用编造的完整度来排名。",
      missingData,
      generatedAt: new Date().toISOString(),
    };
  }

  const coverages = countries.map((country) => country.coverage);
  const spread = round(Math.max(...coverages) - Math.min(...coverages), 2);
  const top = countries.find((country) => country.rank === 1);
  const explanation = top
    ? `${COUNTRY_META[top.country].name}是当前验证优先市场，市场分 ${top.weightedScore}/100。${
        top.complianceGate === "CAUTION"
          ? "合规门仍为谨慎：不要把排名当成发布批准；请先关闭开放复核或完成卖家动作。"
          : top.complianceGate === "CLEAR"
            ? "本范围的合规预检已完成。正式归类和法律审查由进口商负责。"
            : "合规状态未知；在投入发布预算前先验证。"
      } 建议进行有边界的市场测试，而不是全面发布。`
    : "没有找到可排名的市场。";

  return {
    productId: product.id,
    status: "RANKED",
    countries,
    rankedCountries,
    recommendedCountry: eligible?.country ?? null,
    coverageSpread: spread,
    explanation,
    missingData,
    generatedAt: new Date().toISOString(),
  };
}

export function complianceGateLabel(gate: ComplianceGateOutcome): string {
  if (gate === "CLEAR") return "本次预检已完成";
  if (gate === "CAUTION") return "谨慎 — 仍有复核/动作未关闭";
  if (gate === "BLOCKED") return "Blocked";
  return "合规状态未知";
}
