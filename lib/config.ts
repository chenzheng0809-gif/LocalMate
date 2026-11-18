import path from "node:path";
import { chatEndpoint } from "@/lib/ai/endpoint";

/**
 * Server-side configuration. Never import this module from a client component.
 * Secrets are only read from the process environment and are never exposed by
 * the public /api/system/status endpoint.
 */

function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}

function integerEnv(name: string, fallback: number, min: number, max: number): number {
  const value = Number(env(name));
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

const provider = (env("AI_PROVIDER") ?? "octopus").toLowerCase();
const baseUrl = provider === "octopus"
  ? env("OCTOPUS_BASE_URL") ?? env("AI_BASE_URL") ?? ""
  : env("AI_BASE_URL") ?? (provider === "deepseek" ? env("DEEPSEEK_BASE_URL") : undefined) ?? "";
const apiKey = (provider === "octopus" ? env("OCTOPUS_API_KEY") :
  provider === "deepseek" ? env("DEEPSEEK_API_KEY") : env("AI_API_KEY")) ?? "";

const model = env("AI_MODEL") ?? "deepseek-v4.1-flash";
const visionModel = env("AI_VISION_MODEL") ?? model;

const searchProvider = (env("SEARCH_PROVIDER") ?? "local").toLowerCase();
const searchApiKey = env("SEARCH_API_KEY") ?? "";

const requestedMode = (env("APP_MODE") ?? "LIVE").toUpperCase();
const demoMode = env("DEMO_MODE") === "1" || requestedMode === "DEMO";
const aiConfigured = !demoMode && provider !== "none" && Boolean(apiKey && chatEndpoint(baseUrl));
const appMode: "LIVE" | "DEMO" = demoMode || !aiConfigured ? "DEMO" : "LIVE";

const databasePath = path.resolve(
  process.cwd(),
  env("DATABASE_PATH") ?? "data/product-passport.db",
);

const uploadDir = path.resolve(process.cwd(), env("UPLOAD_DIR") ?? "data/uploads");

export const config = {
  appMode,
  demoMode: demoMode || !aiConfigured,
  ai: {
    provider,
    baseUrl,
    apiKey,
    model,
    visionModel,
    configured: aiConfigured,
    requestTimeoutMs: integerEnv("AI_TIMEOUT_MS", 20_000, 100, 90_000),
    maxRetries: integerEnv("AI_MAX_RETRIES", 1, 0, 2),
    jsonMode: env("AI_JSON_MODE") !== "0",
    visionEnabled: env("AI_VISION_ENABLED") === "1",
    guestDailyLimit: integerEnv("AI_GUEST_DAILY_LIMIT", 60, 1, 10_000),
    dailyGatewayLimit: integerEnv("AI_DAILY_GATEWAY_LIMIT", 4000, 1, 100_000),
    trustedVisitorHeader: env("AI_TRUSTED_VISITOR_HEADER")?.toLowerCase(),
  },
  search: {
    provider: searchProvider,
    apiKey: searchApiKey,
    configured:
      searchProvider !== "local" && searchProvider !== "none" && searchApiKey.length > 0,
    timeoutMs: Number(env("SEARCH_TIMEOUT_MS") ?? 20_000),
    maxResults: Number(env("SEARCH_MAX_RESULTS") ?? 8),
  },
  fetch: {
    timeoutMs: Number(env("FETCH_TIMEOUT_MS") ?? 18_000),
    maxBytes: Number(env("FETCH_MAX_BYTES") ?? 2_500_000),
    maxChars: Number(env("FETCH_MAX_CHARS") ?? 45_000),
    cacheTtlMs: Number(env("FETCH_CACHE_TTL_MS") ?? 24 * 60 * 60 * 1000),
    userAgent:
      env("FETCH_USER_AGENT") ??
      "ProductPassportBot/1.0 (+research; contact: operator@example.com)",
    allowLiveRetailProbe: env("DISABLE_RETAIL_PROBE") !== "1",
  },
  databasePath,
  uploadDir,
  maxUploadBytes: Number(env("MAX_UPLOAD_BYTES") ?? 8 * 1024 * 1024),
  maxResearchConcurrency: Math.max(1, Number(env("RESEARCH_CONCURRENCY") ?? 2)),
  maxAiConcurrency: Math.max(1, Number(env("AI_CONCURRENCY") ?? 2)),
  minComparableCoverage: Number(env("MIN_COMPARABLE_COVERAGE") ?? 0.6),
} as const;

export function publicConfigInfo() {
  const searchMode =
    config.search.provider === "local"
      ? "LOCAL_CORPUS"
      : config.search.configured
        ? "LIVE_SEARCH"
        : "NONE";

  return {
    appMode: config.appMode,
    ai: {
      configured: config.ai.configured,
      provider: config.ai.provider,
      model: config.ai.model,
      vision: config.ai.visionEnabled,
    },
    search: {
      provider: config.search.provider,
      configured: config.search.configured,
      mode: searchMode as "LIVE_SEARCH" | "LOCAL_CORPUS" | "NONE",
      note:
        searchMode === "LIVE_SEARCH"
          ? `Live web search via ${config.search.provider}.`
          : searchMode === "LOCAL_CORPUS"
            ? "未配置搜索 API 密钥。研究使用随包导入的证据语料和实时官方来源抓取；这不是实时网络搜索。"
            : "未配置搜索服务。除非有本地证据，市场发现会返回 INSUFFICIENT_EVIDENCE。",
    },
    database: {
      driver: "node:sqlite" as const,
      path: path.relative(process.cwd(), config.databasePath),
    },
  };
}

export function hasLiveSearch(): boolean {
  return config.search.provider !== "local" && config.search.provider !== "none" && config.search.configured;
}