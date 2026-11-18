import { config } from "@/lib/config";
import { getDb, type AppDatabase } from "@/lib/db/client";
import { AppError } from "@/lib/errors";

export function takeDailySlot(db: AppDatabase, day: string, bucket: string, limit: number): boolean {
  return Boolean(db.prepare(`
    INSERT INTO ai_daily_limits (day, bucket, used) VALUES (?, ?, 1)
    ON CONFLICT (day, bucket) DO UPDATE SET used = used + 1
    WHERE used < ?
    RETURNING used
  `).get(day, bucket, limit));
}

export function utcDay() {
  return new Date().toISOString().slice(0, 10);
}

export function reserveGatewayRequest() {
  if (!takeDailySlot(getDb(), utcDay(), "gateway", config.ai.dailyGatewayLimit)) {
    throw new AppError("今日 AI 服务调用量已达上限，请明天再试。", { status: 429, code: "AI_GATEWAY_LIMIT" });
  }
}
