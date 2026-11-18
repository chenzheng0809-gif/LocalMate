import { getDb } from "@/lib/db/client";
import { createUsageRepository } from "@/lib/repositories/usage-repository";
import { reserveGatewayRequest } from "@/lib/ai/limits";
import { config } from "@/lib/config";
import { OpenAICompatibleProvider } from "@/lib/ai/openai-compatible";
import type { AIProvider } from "@/lib/ai/types";

let singleton: AIProvider | null = null;

export function getAIProvider(): AIProvider | null {
  if (!config.ai.configured) return null;
  if (!singleton) {
    singleton = new OpenAICompatibleProvider({
      provider: config.ai.provider,
      baseUrl: config.ai.baseUrl,
      apiKey: config.ai.apiKey,
      model: config.ai.model,
      visionModel: config.ai.visionModel,
      timeoutMs: config.ai.requestTimeoutMs,
      maxRetries: config.ai.maxRetries,
      jsonMode: config.ai.jsonMode,
      visionEnabled: config.ai.visionEnabled,
      beforeRequest: reserveGatewayRequest,
      defaultUsage: (usage) => createUsageRepository(getDb()).record(null, usage),
    });
  }
  return singleton;
}

/** For tests and scripts. */
export function createAIProvider(overrides: {
  provider?: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  visionModel?: string;
  timeoutMs?: number;
  maxRetries?: number;
  jsonMode?: boolean;
  visionEnabled?: boolean;
}): AIProvider {
  return new OpenAICompatibleProvider({
    provider: overrides.provider ?? "custom",
    baseUrl: overrides.baseUrl,
    apiKey: overrides.apiKey,
    model: overrides.model,
    visionModel: overrides.visionModel ?? overrides.model,
    timeoutMs: overrides.timeoutMs ?? 60_000,
    maxRetries: overrides.maxRetries ?? 1,
    jsonMode: overrides.jsonMode ?? true,
    visionEnabled: overrides.visionEnabled ?? true,
  });
}

export function requireAIProvider(): AIProvider {
  const provider = getAIProvider();
  if (!provider) {
    throw new Error(
      "AI provider is not configured. Configure the selected provider and its HTTPS endpoint in .env.local.",
    );
  }
  return provider;
}