import type { Country } from "@/types/domain";
import { COUNTRY_META } from "@/types/domain";

export type AgentIntent =
  | "CONFIRM"
  | "RESEARCH"
  | "MARKETS"
  | "COMPLIANCE"
  | "SIMULATE_PRICE"
  | "LAUNCH"
  | "PASSPORT"
  | "OVERVIEW";

const COUNTRY_PATTERNS: Array<{ country: Country; pattern: RegExp }> = [
  { country: "US", pattern: /美国|美國|\bUSA?\b|united states/i },
  { country: "JP", pattern: /日本|\bJP\b|japan/i },
  { country: "DE", pattern: /德国|德國|\bDE\b|germany/i },
  { country: "UK", pattern: /英国|英國|\bUK\b|\bGB\b|united kingdom|britain/i },
];

export function detectCountry(text: string): Country | null {
  let best: { country: Country; index: number } | null = null;
  for (const item of COUNTRY_PATTERNS) {
    const match = item.pattern.exec(text);
    if (!match || match.index === undefined) continue;
    if (!best || match.index < best.index) best = { country: item.country, index: match.index };
  }
  return best?.country ?? null;
}

export function detectCountries(text: string): Country[] {
  return COUNTRY_PATTERNS.filter((item) => item.pattern.test(text)).map((item) => item.country);
}

export function parseSupplierPrice(text: string): number | null {
  const labelled = text.match(
    /(?:采购(?:单价|价|成本)|进货(?:单价|价)|拿货价|供应商价格|成本价|成本|price)[^\d]{0,14}(\d+(?:\.\d+)?)/i,
  );
  const amount = labelled?.[1];
  if (amount && Number.isFinite(Number(amount))) return Number(amount);
  const explicit = text.match(/(?:降到|降到|改成|改为|调整为|变成|到)\s*(\d+(?:\.\d+)?)\s*(?:元|块|rmb|cny)/i);
  if (explicit && Number.isFinite(Number(explicit[1]))) return Number(explicit[1]);
  const yuan = text.match(/(\d+(?:\.\d+)?)\s*(?:元|块)(?:\s*的)?(?:采购|成本|进货|拿货)/);
  return yuan && Number.isFinite(Number(yuan[1])) ? Number(yuan[1]) : null;
}

export function classifyAgentIntent(text: string): AgentIntent {
  const value = text.trim();
  if (/^(确认|正确|没问题|是的|对|可以|ok|yes)\b/i.test(value) && value.length <= 24) return "CONFIRM";
  if (/(确认|锁定).{0,8}(产品|简报|信息)/.test(value)) return "CONFIRM";
  if (/(护照|passport|导出|保存.{0,4}快照)/i.test(value)) return "PASSPORT";
  if (/(发布页|落地页|商品页面|商品页|文案|标题|landing page)/i.test(value)) return "LAUNCH";
  if (/(合规|认证|法规|监管|要求|限制|准入门槛|风险)/.test(value)) return "COMPLIANCE";
  if (
    /(采购价|进货价|成本|价格|降到|改成|what-if|what if|模拟|情景)/i.test(value) &&
    (parseSupplierPrice(value) !== null || /(会怎样|怎么样|影响|重算|重新计算|模拟)/.test(value))
  ) {
    return "SIMULATE_PRICE";
  }
  if (/(研究|调研|分析|跑一遍|开始).{0,12}(市场|四国|美国|日本|德国|英国)|四国|四个市场/.test(value)) return "RESEARCH";
  if (/(市场|比较|对比|并排|排名|哪个国家|哪一个国家|机会|出海)/.test(value)) return "MARKETS";
  return "OVERVIEW";
}

export function countryName(country: Country | null | undefined): string {
  return country ? COUNTRY_META[country].name : "目标市场";
}

export function priceText(value: number | null | undefined): string {
  return value === null || value === undefined ? "未提供" : `¥${value.toFixed(2)}`;
}
