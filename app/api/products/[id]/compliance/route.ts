import { enforceGuestLimit } from "@/lib/ai/guest";
import { getAIProvider } from "@/lib/ai/factory";
import { getRepositories } from "@/lib/repositories";
import { runComplianceCheck } from "@/lib/compliance/service";
import { ComplianceCheckRequestSchema } from "@/schemas/research";
import { mapLimit } from "@/lib/utils/async";
import { AppError } from "@/lib/errors";
import { json, routeError, routeParam } from "@/lib/api/respond";
import { config } from "@/lib/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(_request: Request, context: { params: Promise<Record<string, string>> }) {
  try {
    const id = await routeParam(context, "id");
    const repos = getRepositories();
    const product = repos.products.getById(id);
    if (!product) throw new AppError("产品不存在。", { status: 404 });
    return json({ compliance: repos.compliance.getByProduct(id), product });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request, context: { params: Promise<Record<string, string>> }) {
  try {
    const id = await routeParam(context, "id");
    const raw = await request.json().catch(() => ({}));
    const parsed = ComplianceCheckRequestSchema.parse({ ...(raw as object), productId: id });
    const repos = getRepositories();
    const product = repos.products.getById(id);
    if (!product) throw new AppError("产品不存在。", { status: 404 });
    if (!product.confirmed) throw new AppError("合规预检前，请先确认产品简报。", { status: 409, code: "PRODUCT_NOT_CONFIRMED" });
    await enforceGuestLimit(request);
    const ai = getAIProvider();
    const countries = parsed.countries ?? (["US", "JP", "DE", "UK"] as const);
    const results = await mapLimit([...countries], config.maxAiConcurrency, async (country) => {
      const result = await runComplianceCheck({ product, country, ai, repos });
      repos.evidence.insertMany(result.evidence);
      return repos.compliance.upsert({ productId: id, country, data: result.data });
    });
    return json({ compliance: results });
  } catch (error) {
    return routeError(error);
  }
}
