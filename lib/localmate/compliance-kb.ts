import { execFile } from "node:child_process";
import { homedir } from "node:os";
import path from "node:path";
import { z } from "zod";
import { AppError } from "@/lib/errors";
import { sanitizeSourceUrl } from "@/lib/search/source-validator";
import type { ProductDNA } from "@/types/domain";

const citation = z.object({
  source_id: z.string(), title: z.string(), url: z.string(), locator: z.string().nullish(),
  locator_type: z.string().nullish(), version: z.string().nullish(), retrieved_at: z.string().nullish(),
  effective_from: z.string().nullish(), excerpt: z.string().nullish(),
});

const result = z.object({
  schema_version: z.literal("1.0.0"),
  query: z.object({
    country: z.literal("GB"), category: z.literal("non_electric_adult_desktop_storage"), channel: z.literal("amazon_uk"),
  }),
  as_of: z.string().date(),
  sku_id: z.string().nullish(),
  synthetic_sku: z.literal(false).optional(),
  status: z.enum(["insufficient_scope", "insufficient_data", "pending_verification", "not_applicable"]),
  answer: z.string(),
  rule_results: z.array(z.object({
    rule_id: z.string(), title: z.string(),
    classification: z.enum(["insufficient_scope", "insufficient_data", "source_pending", "pending_human_review", "not_applicable"]),
    next_step: z.string().nullish(),
  })),
  missing_facts: z.array(z.object({ rule_id: z.string(), fact: z.string(), question: z.string() })),
  missing_evidence: z.array(z.object({ rule_id: z.string(), evidence_id: z.string(), description: z.string().nullish() })),
  source_issues: z.array(z.object({ rule_id: z.string(), source_id: z.string().optional(), status: z.string(), reason: z.string() })).default([]),
  citations: z.array(citation),
  channel_policy_status: z.enum(["loaded", "not_loaded"]).optional(),
  policy: z.object({ compliance_pass: z.literal(false), writes: z.literal(false), human_review_required: z.literal(true) }),
});

const response = z.object({
  ok: z.literal(true), action: z.literal("compliance_query"), bridge_version: z.string(), data: result,
});

export type CompliancePrecheck = z.infer<typeof result> & { productId: string; productUpdatedAt: string; engineVersion: string };

export function supportsGbPrecheck(product: ProductDNA) {
  return product.mode === "LIVE" && product.confirmed && product.category === "DESK_ORGANIZER" && product.attributes.electrical !== true;
}

function queryBridge(request: object): Promise<string> {
  const engine = path.resolve(process.env.LOCALMATE_COMPLIANCE_ENGINE_DIR?.trim() ||
    path.join(homedir(), "Documents", "deepseek-harness", "default-workspace", "localmate"));
  const python = process.env.LOCALMATE_COMPLIANCE_PYTHON?.trim() || "python3";
  return new Promise((resolve, reject) => {
    const child = execFile(python, ["tools/codex_bridge.py", "--compact"], {
      cwd: engine,
      env: { NODE_ENV: process.env.NODE_ENV, PATH: process.env.PATH, PYTHONUTF8: "1", PYTHONDONTWRITEBYTECODE: "1" },
      timeout: 15_000,
      killSignal: "SIGKILL",
      maxBuffer: 1024 * 1024,
      encoding: "utf8",
    }, (error, stdout) => {
      if (error) reject(new AppError("合规知识库暂不可用。请检查 Worker 的 Python 和 DeepSeekHarness 路径后重试。", { status: 503 }));
      else resolve(stdout);
    });
    // The callback reports launch failures even if the process closes stdin early.
    child.stdin?.on("error", () => {});
    child.stdin?.end(JSON.stringify(request));
  });
}

export async function runGbPrecheck(product: ProductDNA): Promise<CompliancePrecheck> {
  if (!supportsGbPrecheck(product)) throw new AppError("当前知识库覆盖英国 Amazon UK 的非电动成人桌面收纳用品。", { status: 422 });
  const asOf = new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Shanghai", dateStyle: "short" }).format(new Date());
  const facts: Record<string, boolean | string[]> = {};
  const { electrical, material } = product.attributes;
  if (electrical !== null && product.provenance["attributes.electrical"] === "USER_CONFIRMED") facts.is_electric = electrical;
  if (material?.trim() && product.provenance["attributes.material"] === "USER_CONFIRMED") facts.materials = [material.trim()];

  const raw = await queryBridge({
    action: "compliance_query", country: "GB", category: "non_electric_adult_desktop_storage",
    channel: "amazon_uk", as_of: asOf, sku_file: { sku_id: product.id, facts },
  });
  let envelope: z.infer<typeof response>;
  try {
    envelope = response.parse(JSON.parse(raw));
    if (envelope.data.as_of !== asOf ||
        (envelope.data.status !== "insufficient_scope" && envelope.data.sku_id !== product.id)) {
      throw new Error("Unexpected assessment date or product");
    }
  } catch {
    throw new AppError("合规知识库返回了不兼容的响应。请检查 DeepSeekHarness 版本后重试。", { status: 502 });
  }
  return {
    ...envelope.data,
    citations: envelope.data.citations.flatMap(item => {
      const url = sanitizeSourceUrl(item.url);
      return url ? [{ ...item, url }] : [];
    }),
    productId: product.id, productUpdatedAt: product.updatedAt, engineVersion: envelope.bridge_version,
  };
}
