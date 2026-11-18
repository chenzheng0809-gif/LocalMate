import type {
  CompetitionAnalysis,
  Competitor,
  Confidence,
  DemandSignals,
  MetricValue,
  ProductDNA,
} from "@/types/domain";
import { clamp, round } from "@/lib/utils/money";

export function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function average(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function demandMetric(
  competitors: Competitor[],
  evidenceIds: string[],
): { metric: MetricValue; signals: Omit<DemandSignals, "summary"> } {
  const observed = competitors.filter(
    (c) => typeof c.rating === "number" && typeof c.reviewCount === "number" && c.reviewCount >= 0,
  );
  const reviewCounts = observed.map((c) => c.reviewCount as number);
  const ratings = observed.map((c) => c.rating as number);
  const medianReviews = median(reviewCounts);
  const avgRating = average(ratings);

  if (observed.length < 2 || medianReviews === null || avgRating === null) {
    return {
      metric: {
        score: null,
        confidence: "LOW",
        evidenceIds,
        missingData: [
          "至少两个有公开评分和评论数的竞品",
          "市场级搜索量或销售数据",
        ],
        note: "INSUFFICIENT_EVIDENCE：不会根据单一商品或缺失的评分给需求打分。",
      },
      signals: {
        level: "NOT_ENOUGH_DATA",
        indicators: [
          { label: "有评分数据的商品", value: observed.length, evidenceId: null },
        ],
        confidence: "LOW",
        evidenceIds,
      },
    };
  }

  const reviewScore = clamp((Math.log10(medianReviews + 1) / 4) * 100);
  const ratingScore = clamp(((avgRating - 3.5) / 1.5) * 100);
  const score = round(0.65 * reviewScore + 0.35 * ratingScore, 1);
  const confidence: Confidence = observed.length >= 4 ? "MEDIUM" : "LOW";
  const level: DemandSignals["level"] =
    score >= 65 ? "STRONG" : score >= 40 ? "MODERATE" : "WEAK";

  return {
    metric: {
      score,
      confidence,
      evidenceIds,
      missingData: [
        "全市场搜索量",
        "真实销量或营收数据",
        "复购或季节性数据",
      ],
      note: `基于 ${observed.length} 个已观察商品的需求代理分：评分数量中位数 ${Math.round(medianReviews)}，平均评分 ${avgRating.toFixed(1)}★。评论数是累计的平台信号。`,
    },
    signals: {
      level,
      indicators: [
        { label: "有评分的已观察商品", value: observed.length, evidenceId: evidenceIds[0] ?? null },
        { label: "评分数量中位数", value: Math.round(medianReviews), evidenceId: evidenceIds[0] ?? null },
        { label: "平均评分", value: round(avgRating, 2), evidenceId: evidenceIds[0] ?? null },
      ],
      confidence,
      evidenceIds,
    },
  };
}

export function competitionMetric(
  competitors: Competitor[],
  evidenceIds: string[],
): { metric: MetricValue; analysis: Omit<CompetitionAnalysis, "summary"> } {
  if (competitors.length < 2) {
    return {
      metric: {
        score: null,
        confidence: "LOW",
        evidenceIds,
        missingData: ["至少两个可比商品的竞品集"],
        note: "INSUFFICIENT_EVIDENCE：可比商品不足，无法判断竞争空间。",
      },
      analysis: {
        level: "NOT_ENOUGH_DATA",
        positioningPatterns: [],
        differentiationOpportunities: [],
        evidenceIds,
      },
    };
  }

  const reviews = competitors
    .map((c) => c.reviewCount)
    .filter((value): value is number => typeof value === "number");
  const medianReviews = median(reviews) ?? 0;
  const score = clamp(100 - competitors.length * 9 - Math.log10(medianReviews + 1) * 9);
  const level: CompetitionAnalysis["level"] =
    score >= 60 ? "LOW" : score >= 35 ? "MEDIUM" : "HIGH";
  const confidence: Confidence = competitors.length >= 4 ? "MEDIUM" : "LOW";

  return {
    metric: {
      score: round(score, 1),
      confidence,
      evidenceIds,
      missingData: ["全市场份额数据", "广告投入", "完整竞品池"],
      note: `差异化空间代理分：${competitors.length} 个已观察可比商品，评分数量中位数 ${Math.round(medianReviews)}。小样本零售观察无法证明市场集中度。`,
    },
    analysis: {
      level,
      positioningPatterns: [],
      differentiationOpportunities: [],
      evidenceIds,
    },
  };
}

const STOP_WORDS = new Set([
  "the", "and", "with", "for", "from", "this", "that", "your", "our", "desk", "organizer",
  "organiser", "storage", "box", "white", "grey", "gray", "black", "cm", "inch", "set", "of",
  "a", "an", "in", "on", "to", "x",
]);

export function tokenizeTitle(title: string): string[] {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !STOP_WORDS.has(token));
}

export function productMarketFitMetric(
  product: ProductDNA,
  competitors: Competitor[],
  evidenceIds: string[],
): MetricValue {
  if (competitors.length === 0) {
    return {
      score: null,
      confidence: "LOW",
      evidenceIds,
      missingData: ["可比竞品商品"],
      note: "INSUFFICIENT_EVIDENCE：没有可比较的竞品文案。",
    };
  }
  const productTokens = new Set(
    tokenizeTitle(
      `${product.name} ${product.attributes.material ?? ""} ${product.attributes.color ?? ""} ${product.description ?? ""}`,
    ),
  );
  const competitorTokens = new Set(competitors.flatMap((c) => tokenizeTitle(`${c.name} ${c.keySellingPoints.join(" ")}`)));
  const overlap = Array.from(productTokens).filter((token) => competitorTokens.has(token));
  const categoryMatch = competitors.some((c) =>
    /organi[sz]er|storage|rack|box|desk|shelf|収納|オーガナイザー|aufbewahrung|regal/i.test(c.name),
  );
  const material = product.attributes.material?.toLowerCase() ?? "";
  const materialMatch = material
    ? competitors.some((c) => c.name.toLowerCase().includes(material.split(" ")[0] ?? ""))
    : false;
  const raw = 35 + (categoryMatch ? 25 : 0) + (materialMatch ? 10 : 0) + Math.min(30, overlap.length * 6);
  return {
    score: clamp(round(raw, 1)),
    confidence: "LOW",
    evidenceIds,
    missingData: ["已观察转化或销量", "买家偏好调研"],
    note: `透明的关键词重合启发式（${overlap.length} 个共享有效词；材质${materialMatch ? "出现" : "未出现"}在已观察商品标题中）。这是假设，不是实测转化率。`,
  };
}

export function localizationMetric(
  competitors: Competitor[],
  country: "US" | "JP" | "DE" | "UK",
  evidenceIds: string[],
): MetricValue {
  const nonLatin = /[\u3040-\u30ff\u3400-\u9fff]/;
  const german = /[äöüß]/i;
  const local =
    country === "JP"
      ? competitors.filter((c) => nonLatin.test(c.name)).length
      : country === "DE"
        ? competitors.filter((c) => german.test(c.name) || /schreibtisch|aufbewahrung|regal|box/i.test(c.name)).length
        : competitors.filter((c) => /[a-z]/i.test(c.name)).length;
  const ratio = competitors.length > 0 ? local / competitors.length : 0;
  const base = 45 + ratio * 45 - (country === "JP" || country === "DE" ? 15 : 0);
  return {
    score: competitors.length > 0 ? clamp(round(base, 1)) : null,
    confidence: "LOW",
    evidenceIds,
    missingData: ["母语者文案审核", "本地关键词搜索量"],
    note: `已观察本地语言商品占比：${Math.round(ratio * 100)}%。这是准备度启发式，不是翻译质量评估。`,
  };
}

export function keywordHighlights(competitors: Competitor[], limit = 6): string[] {
  const counts = new Map<string, number>();
  for (const competitor of competitors) {
    for (const token of tokenizeTitle(`${competitor.name} ${competitor.keySellingPoints.join(" ")}`)) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([token]) => token);
}
