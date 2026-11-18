import type { AppDatabase } from "@/lib/db/client";
import { nowIso, uid } from "@/lib/db/client";
import type { AIUsage } from "@/lib/ai/types";

export interface UsageRecord extends AIUsage {
  id: string;
  productId: string | null;
  createdAt: string;
}

export interface UsageRepository {
  record(productId: string | null, usage: AIUsage): void;
  listByProduct(productId: string, limit?: number): UsageRecord[];
  summary(productId: string): {
    calls: number;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export function createUsageRepository(db: AppDatabase): UsageRepository {
  return {
    record(productId, usage) {
      db.prepare(
        `INSERT INTO ai_usage (id, product_id, operation, provider, model, prompt_tokens,
          completion_tokens, total_tokens, latency_ms, request_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        uid("use"),
        productId,
        usage.operation,
        usage.provider,
        usage.model,
        usage.promptTokens,
        usage.completionTokens,
        usage.totalTokens,
        usage.latencyMs,
        usage.requestId,
        nowIso(),
      );
    },

    listByProduct(productId, limit = 100) {
      const rows = db
        .prepare("SELECT * FROM ai_usage WHERE product_id = ? ORDER BY created_at DESC LIMIT ?")
        .all(productId, limit) as Array<Record<string, unknown>>;
      return rows.map((row) => ({
        id: String(row.id),
        productId: row.product_id ? String(row.product_id) : null,
        operation: String(row.operation),
        provider: String(row.provider),
        model: String(row.model),
        promptTokens: Number(row.prompt_tokens),
        completionTokens: Number(row.completion_tokens),
        totalTokens: Number(row.total_tokens),
        latencyMs: Number(row.latency_ms),
        requestId: row.request_id ? String(row.request_id) : null,
        createdAt: String(row.created_at),
      }));
    },

    summary(productId) {
      const row = db
        .prepare(
          `SELECT COUNT(*) AS calls, COALESCE(SUM(prompt_tokens),0) AS promptTokens,
            COALESCE(SUM(completion_tokens),0) AS completionTokens, COALESCE(SUM(total_tokens),0) AS totalTokens
           FROM ai_usage WHERE product_id = ?`,
        )
        .get(productId) as Record<string, unknown>;
      return {
        calls: Number(row.calls),
        promptTokens: Number(row.promptTokens),
        completionTokens: Number(row.completionTokens),
        totalTokens: Number(row.totalTokens),
      };
    },
  };
}