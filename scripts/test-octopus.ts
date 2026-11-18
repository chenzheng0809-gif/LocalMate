import { config as loadEnv } from "dotenv";
import { z } from "zod";

loadEnv({ path: ".env.local", override: true });

const [{ createAIProvider }, { config }] = await Promise.all([
  import("@/lib/ai/factory"),
  import("@/lib/config"),
]);

if (!config.ai.configured) {
  console.error("AI is not configured. Configure OCTOPUS_API_KEY and OCTOPUS_BASE_URL in .env.local.");
  process.exit(1);
}

const ai = createAIProvider({
  provider: config.ai.provider,
  baseUrl: config.ai.baseUrl,
  apiKey: config.ai.apiKey,
  model: config.ai.model,
  visionModel: config.ai.visionModel,
  timeoutMs: 90_000,
  maxRetries: 0,
  jsonMode: config.ai.jsonMode,
  visionEnabled: config.ai.visionEnabled,
});

const results: Array<{ capability: string; ok: boolean; detail: string }> = [];

async function check(name: string, fn: () => Promise<string>) {
  const started = Date.now();
  try {
    const detail = await fn();
    results.push({ capability: name, ok: true, detail: `${detail} (${Date.now() - started} ms)` });
    console.log(`PASS  ${name} — ${detail} (${Date.now() - started} ms)`);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    results.push({ capability: name, ok: false, detail });
    console.error(`FAIL  ${name} — ${detail}`);
  }
}

await check("text completion", async () => {
  let tokenCount = 0;
  const text = await ai.generateText({
    system: "You are a concise test harness. Return plain text only.",
    prompt: "Reply with exactly: OK",
    temperature: 0,
    maxTokens: 20,
    operation: "capability-text",
    usage: (value) => { tokenCount = value.totalTokens; },
  });
  if (!/\bOK\b/i.test(text)) {
    throw new Error(`Unexpected text response: ${text.slice(0, 120)}`);
  }
  return `model=${ai.info.model}; tokens=${tokenCount || "n/a"}`;
});

await check("structured JSON", async () => {
  const schema = z.object({
    verdict: z.enum(["READY", "NOT_READY"]),
    reasons: z.array(z.string().min(3)).min(1).max(3),
  });
  let tokenCount = 0;
  const data = await ai.generateStructured({
    system: "You return compact JSON for a schema test. Never add markdown fences.",
    prompt: 'Return {"verdict":"READY","reasons":["schema validated"]}.',
    schema,
    schemaName: "CapabilityProbe",
    schemaHint: '{"verdict":"READY"|"NOT_READY","reasons":["..."]}',
    temperature: 0,
    maxTokens: 80,
    operation: "capability-json",
    usage: (value) => { tokenCount = value.totalTokens; },
  });
  if (data.verdict !== "READY" || data.reasons.length === 0) {
    throw new Error("JSON schema validation returned an unexpected object.");
  }
  return `schema=ok; tokens=${tokenCount || "n/a"}`;
});

if (ai.info.capabilities.vision) {
  console.log("SKIP  vision input — capability advertised; not exercised by this probe to avoid a product-specific schema.");
} else {
  console.log("SKIP  vision input — not advertised by the provider.");
}

const failed = results.filter((result) => !result.ok);
console.log(`\n${results.filter((result) => result.ok).length}/${results.length} text/JSON capabilities passed.`);
if (failed.length > 0) process.exit(1);
