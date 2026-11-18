import { config } from "@/lib/config";

export interface FxRates {
  base: "CNY";
  rates: Record<string, number>;
  source: string;
  fetchedAt: string;
  isLive: boolean;
  note: string;
}

const PLANNING_RATES: Record<string, number> = {
  USD: 0.1407,
  JPY: 21.9,
  EUR: 0.1215,
  GBP: 0.1072,
  CNY: 1,
};

let cached: { expiresAt: number; value: FxRates } | null = null;
const TTL_MS = 6 * 60 * 60 * 1000;

export async function getFxRates(): Promise<FxRates> {
  if (cached && cached.expiresAt > Date.now()) return cached.value;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.min(config.search.timeoutMs, 12_000));
    let response: Response;
    try {
      response = await fetch("https://open.er-api.com/v6/latest/CNY", {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
    } finally {
      clearTimeout(timer);
    }
    if (!response.ok) throw new Error(`FX HTTP ${response.status}`);
    const data = (await response.json()) as {
      result?: string;
      time_last_update_utc?: string;
      rates?: Record<string, number>;
    };
    if (data.result !== "success" || !data.rates) throw new Error("FX response invalid");
    const value: FxRates = {
      base: "CNY",
      rates: {
        CNY: 1,
        USD: data.rates.USD,
        JPY: data.rates.JPY,
        EUR: data.rates.EUR,
        GBP: data.rates.GBP,
        ...(Number.isFinite(data.rates.MXN) && data.rates.MXN > 0 ? { MXN: data.rates.MXN } : {}),
        ...(Number.isFinite(data.rates.BRL) && data.rates.BRL > 0 ? { BRL: data.rates.BRL } : {}),
      },
      source: "open.er-api.com",
      fetchedAt: data.time_last_update_utc
        ? new Date(data.time_last_update_utc).toISOString()
        : new Date().toISOString(),
      isLive: true,
      note: "每日参考汇率。不是交易汇率；银行卡和平台换汇费用另行计算。",
    };
    if (
      !value.rates.USD ||
      !value.rates.JPY ||
      !value.rates.EUR ||
      !value.rates.GBP
    ) {
      throw new Error("FX response missing required currencies");
    }
    cached = { expiresAt: Date.now() + TTL_MS, value };
    return value;
  } catch {
    const value: FxRates = {
      base: "CNY",
      rates: PLANNING_RATES,
      source: "planning fallback",
      fetchedAt: new Date().toISOString(),
      isLive: false,
      note: "实时汇率不可用。这里使用固定规划汇率，不是市场汇率；所有相关利润数字都只是情景。",
    };
    cached = { expiresAt: Date.now() + 10 * 60 * 1000, value };
    return value;
  }
}

export function convertCurrency(
  amount: number,
  from: string,
  to: string,
  rates: FxRates,
): number | null {
  const fromRate = rates.rates[from];
  const toRate = rates.rates[to];
  if (!fromRate || !toRate) return null;
  const cny = amount / fromRate;
  return cny * toRate;
}

export function cnyToLocal(amountCNY: number, currency: string, rates: FxRates): number | null {
  const rate = rates.rates[currency];
  return rate ? amountCNY * rate : null;
}

export function localToCny(amount: number, currency: string, rates: FxRates): number | null {
  const rate = rates.rates[currency];
  return rate ? amount / rate : null;
}

export const fxPlanningRates = PLANNING_RATES;
