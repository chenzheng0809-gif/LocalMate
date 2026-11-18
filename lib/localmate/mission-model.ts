import { z } from "zod";
import atlas from "./market-atlas.json";
import { COUNTRIES, type Country } from "@/types/domain";

export const marketCodes = atlas.map(({ code }) => code);
const displayNames = new Intl.DisplayNames("zh-CN", { type: "region" });
export const markets = atlas.map(({ code, name }) => ({ code, name: displayNames.of(code) ?? name }));

export function legacyCountry(code: string): Country | null {
  const legacy = code === "GB" ? "UK" : code;
  return COUNTRIES.find(item => item === legacy) ?? null;
}

const marketCode = z.string().refine(code => marketCodes.includes(code), "请选择可用市场");
const base = {
  requestId: z.string().uuid(),
  goal: z.string().trim().min(3).max(1000),
};
export const createMissionInput = z.discriminatedUnion("direction", [
  z.object({
    ...base,
    direction: z.literal("product_to_market"),
    productId: z.string().trim().min(1).max(100),
    markets: z.array(marketCode).max(4).refine(items => new Set(items).size === items.length),
  }).strict(),
  z.object({
    ...base,
    direction: z.literal("market_to_product"),
    market: marketCode.optional(),
    markets: z.array(marketCode).min(1).max(6).refine(items => new Set(items).size === items.length).optional(),
  }).strict(),
]);

const minor = z.string().regex(/^(?:0|[1-9]\d{0,6})(?:\.\d{1,2})?$/, "填写至多两位小数的人民币金额");
export const currencies = ["CNY", "USD", "MXN", "BRL", "EUR", "GBP", "IDR"] as const;
export const costAmounts = z.object({
  price: minor,
  procurement: minor,
  logistics: minor,
  channelFees: minor,
  taxes: minor,
  acquisition: minor,
});

const valuation = z.object({
  currency: z.enum(currencies),
  fxToCny: z.string().regex(/^\d{1,5}(?:\.\d{1,8})?$/).refine(value => Number(value) > 0).optional(),
  fxAt: z.string().datetime({ offset: true }).optional(),
  fxSource: z.string().trim().min(2).max(240).optional(),
  lowPrice: minor.optional(),
  highPrice: minor.optional(),
  fixedCost: minor.optional(),
}).strict();
export const projectPlanInput = z.object({
  type: z.literal("save_plan"),
  revision: z.number().int().nonnegative(),
  markets: z.array(marketCode).min(1).max(6).refine(items => new Set(items).size === items.length),
  sourcing: z.string().trim().max(200).default(""),
  procurementLimit: z.number().nonnegative().max(1_000_000).nullable().default(null),
}).strict();

export const missionCommand = z.discriminatedUnion("type", [
  projectPlanInput,
  z.object({ type: z.literal("attach_product"), revision: z.number().int().nonnegative(), productId: z.string().trim().min(1).max(100) }).strict(),
  z.object({
    type: z.literal("save_cost"),
    revision: z.number().int().nonnegative(),
    market: marketCode,
    ...costAmounts.shape,
    source: z.string().trim().min(2).max(500),
    valuation: valuation.optional(),
  }).strict(),
]);

export type CreateMission = z.infer<typeof createMissionInput>;
export type ProjectPlan = { sourcing: string; procurementLimit: number | null };
export type MissionCommand = z.infer<typeof missionCommand>;
export type MissionStatus = "awaiting_product" | "research_ready";
export type Mission = {
  id: string;
  direction: CreateMission["direction"];
  goal: string;
  markets: string[];
  productId: string | null;
  status: MissionStatus;
  revision: number;
  createdAt: string;
  updatedAt: string;
};
export type CostCheck = {
  missionId: string;
  version: number;
  market: string;
  currency: typeof currencies[number];
  valuation: CostValuation;
  inputMinor: { price: number; procurement: number; logistics: number; channelFees: number; taxes: number; acquisition: number };
  contributionMinor: number;
  benchmark?: { url: string; selectedAt: string };
  source: string;
  createdAt: string;
};

export type CostValuation = {
  currency: typeof currencies[number];
  contributionCnyMinor: number;
  lowContributionMinor: number | null;
  highContributionMinor: number | null;
  fixedCostMinor?: number;
  breakEvenUnits?: number | null;
  fxToCny: string | null;
  fxAt: string | null;
  fxSource: string | null;
};

function cents(value: string) {
  const [whole, fraction = ""] = value.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export function calculateContribution(input: z.infer<typeof costAmounts>) {
  const amounts = {
    price: cents(input.price),
    procurement: cents(input.procurement),
    logistics: cents(input.logistics),
    channelFees: cents(input.channelFees),
    taxes: cents(input.taxes),
    acquisition: cents(input.acquisition),
  };
  const spend = amounts.procurement + amounts.logistics + amounts.channelFees + amounts.taxes + amounts.acquisition;
  return { amounts, spend, contributionMinor: amounts.price - spend };
}

export function breakEvenUnits(fixedCostMinor: number, contributionMinor: number) {
  return contributionMinor > 0 ? Math.ceil(fixedCostMinor / contributionMinor) : null;
}

export function calculateCost(input: Extract<MissionCommand, { type: "save_cost" }>): Pick<CostCheck, "inputMinor" | "contributionMinor" | "valuation"> {
  const { amounts, spend, contributionMinor } = calculateContribution(input);
  const currency = input.valuation?.currency ?? "CNY";
  const { fxToCny, fxAt, fxSource, lowPrice, highPrice } = input.valuation ?? {};
  if (currency !== "CNY" && (!fxToCny || !fxAt || !fxSource || Date.parse(fxAt) > Date.now())) {
    throw new Error("非人民币口径需填写有效的汇率、时间和来源。");
  }
  const fixedCostMinor = input.valuation?.fixedCost === undefined ? undefined : cents(input.valuation.fixedCost);
  const low = lowPrice === undefined ? null : cents(lowPrice);
  const high = highPrice === undefined ? null : cents(highPrice);
  if ((low !== null && low > amounts.price) || (high !== null && high < amounts.price)) {
    throw new Error("成交价应处于低价和高价情景范围内。");
  }
  let contributionCnyMinor = contributionMinor;
  if (currency !== "CNY" && fxToCny) {
    const [whole, fractional = ""] = fxToCny.split(".");
    const denominator = BigInt(10) ** BigInt(fractional.length);
    const numerator = BigInt(whole + fractional) * BigInt(Math.abs(contributionMinor));
    const rounded = (numerator * BigInt(2) + denominator) / (denominator * BigInt(2));
    contributionCnyMinor = Number(rounded) * Math.sign(contributionMinor);
  }
  return {
    inputMinor: amounts, contributionMinor,
    valuation: {
      currency, contributionCnyMinor,
      lowContributionMinor: low === null ? null : low - spend,
      highContributionMinor: high === null ? null : high - spend,
      ...(fixedCostMinor === undefined ? {} : { fixedCostMinor, breakEvenUnits: breakEvenUnits(fixedCostMinor, contributionMinor) }),
      fxToCny: currency === "CNY" ? null : fxToCny ?? null,
      fxAt: currency === "CNY" ? null : fxAt ?? null,
      fxSource: currency === "CNY" ? null : fxSource ?? null,
    },
  };
}
