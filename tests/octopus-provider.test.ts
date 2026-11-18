import { afterEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { chatEndpoint } from "@/lib/ai/endpoint";
import { createAIProvider } from "@/lib/ai/factory";
import { takeDailySlot } from "@/lib/ai/limits";
import { createTestDb } from "@/lib/db/client";

afterEach(() => vi.unstubAllGlobals());

describe("Octopus compatible transport", () => {
  const apiKey = "mock-server-key";
  const model = "mock-model";

  it("blocks public HTTP and credential-bearing URLs before sending the key", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const ai = createAIProvider({ baseUrl: "http://gateway.example/v1", apiKey, model });
    await expect(ai.generateText({ prompt: "hello" })).rejects.toMatchObject({ code: "AI_INSECURE_ENDPOINT" });
    expect(chatEndpoint("https://bob:password@gateway.example/v1")).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it("sends native JSON requests without redirects and records token usage", async () => {
    const fetch = vi.fn().mockResolvedValue(Response.json({
      choices: [{ message: { content: '{"ok":true}' } }],
      usage: { prompt_tokens: 2, completion_tokens: 3, total_tokens: 5 },
    }));
    vi.stubGlobal("fetch", fetch);
    const ai = createAIProvider({ baseUrl: "https://gateway.example/v1", apiKey, model });
    const usage = vi.fn();
    await expect(ai.generateStructured({
      prompt: "Reply JSON", schemaName: "Probe", schemaHint: '{"ok":boolean}',
      schema: z.object({ ok: z.boolean() }), usage,
    })).resolves.toEqual({ ok: true });
    expect(fetch).toHaveBeenCalledWith("https://gateway.example/v1/chat/completions", expect.objectContaining({
      redirect: "error", headers: expect.objectContaining({ Authorization: `Bearer ${apiKey}` }),
    }));
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toMatchObject({ response_format: { type: "json_object" }, model });
    expect(usage).toHaveBeenCalledWith(expect.objectContaining({ totalTokens: 5 }));
  });

  it("does not disclose gateway error content", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: { message: apiKey } }, { status: 401 })));
    const ai = createAIProvider({ baseUrl: "https://gateway.example/v1", apiKey, model });
    await expect(ai.generateText({ prompt: "hello" })).rejects.toMatchObject({
      code: "AI_HTTP_ERROR", message: "AI 网关暂时无法完成请求（HTTP 401）。",
    });
  });

  it("admits no more than the configured daily quota per bucket", () => {
    const db = createTestDb();
    try {
      expect(takeDailySlot(db, "2026-11-17", "gateway", 1)).toBe(true);
      expect(takeDailySlot(db, "2026-11-17", "gateway", 1)).toBe(false);
      expect(takeDailySlot(db, "2026-11-17", "guest:first", 1)).toBe(true);
      expect(takeDailySlot(db, "2026-11-18", "gateway", 1)).toBe(true);
    } finally {
      db.close();
    }
  });
});
