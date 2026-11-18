import nextEnv from "@next/env";

nextEnv.loadEnvConfig(process.cwd());
const [{ config }, { getDb, resetDbSingleton }, { utcDay }] = await Promise.all([
  import("@/lib/config"), import("@/lib/db/client"), import("@/lib/ai/limits"),
]);

const day = process.argv[2] ?? utcDay();
if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Use YYYY-MM-DD (UTC).");

const inputRate = Number(process.env.AI_INPUT_PRICE_PER_MILLION ?? NaN);
const outputRate = Number(process.env.AI_OUTPUT_PRICE_PER_MILLION ?? NaN);
const currency = process.env.AI_COST_CURRENCY;
const hasRates = currency && [inputRate, outputRate].every(rate => Number.isFinite(rate) && rate >= 0);

const db = getDb();
try {
  type UsageRow = { provider: string; model: string; responses: number; promptTokens: number; completionTokens: number; totalTokens: number; avgLatencyMs: number };
  const rows = db.prepare(`
    SELECT provider, model, COUNT(*) AS responses, SUM(prompt_tokens) AS promptTokens,
      SUM(completion_tokens) AS completionTokens, SUM(total_tokens) AS totalTokens,
      ROUND(AVG(latency_ms)) AS avgLatencyMs
    FROM ai_usage WHERE substr(created_at, 1, 10) = ? GROUP BY provider, model
  `).all(day) as unknown as UsageRow[];
  const requests = db.prepare("SELECT used FROM ai_daily_limits WHERE day = ? AND bucket = 'gateway'").get(day)?.used ?? 0;
  console.log(JSON.stringify({
    day,
    gatewayAttempts: requests,
    gatewayDailyLimit: config.ai.dailyGatewayLimit,
    gatewayBilledAmount: null,
    models: rows.map(row => ({
      ...row,
      estimatedCost: hasRates && row.provider === config.ai.provider && row.model === config.ai.model
        ? { currency, amount: (row.promptTokens * inputRate + row.completionTokens * outputRate) / 1_000_000 }
        : null,
    })),
  }, null, 2));
} finally {
  resetDbSingleton();
}
