import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { AppError } from "@/lib/errors";
import { AINotConfiguredError, AIError } from "@/lib/ai/types";

export function json<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data, init);
}

export function routeError(error: unknown): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(
      { error: error.message, code: error.code, details: error.details ?? null },
      { status: error.status },
    );
  }
  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "请求校验失败。",
        code: "VALIDATION_ERROR",
        details: error.issues.map((issue) => ({ path: issue.path.join("."), message: issue.message })),
      },
      { status: 422 },
    );
  }
  if (error instanceof AINotConfiguredError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: 503 });
  }
  if (error instanceof AIError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: error.code === "AI_TIMEOUT" ? 504 : error.status === 429 ? 503 : 502 });
  }
  console.error("Unhandled API error", error);
  return NextResponse.json(
    { error: "Unexpected server error.", code: "INTERNAL_ERROR" },
    { status: 500 },
  );
}

export async function readJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new AppError("请求体必须是有效 JSON。", { status: 400, code: "INVALID_JSON" });
  }
}

export async function routeParam(context: { params: Promise<Record<string, string>> }, key: string): Promise<string> {
  const params = await context.params;
  const value = params[key];
  if (!value) throw new AppError(`缺少路由参数：${key}`, { status: 400 });
  return value;
}
