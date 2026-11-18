import { enforceGuestLimit } from "@/lib/ai/guest";
import { getAIProvider } from "@/lib/ai/factory";
import { getRepositories } from "@/lib/repositories";
import { analyzeImages, importProductFromUrl } from "@/lib/product/service";
import { saveImages } from "@/lib/product/uploads";
import { ProductImportRequestSchema } from "@/schemas/product";
import { AppError } from "@/lib/errors";
import { json, readJson, routeError } from "@/lib/api/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

/**
 * Extraction endpoint. It returns the normalized product plus provenance.
 * In this version the extracted product is persisted so the user can review
 * and patch it; confirmation is still a separate explicit step.
 */
export async function POST(request: Request) {
  try {
    const input = ProductImportRequestSchema.parse(await readJson(request));
    const repos = getRepositories();
    await enforceGuestLimit(request);
    const ai = getAIProvider();
    if (input.sourceUrl) {
      const result = await importProductFromUrl(repos, ai, input.sourceUrl, input.mode);
      return json({
        product: result.product,
        warnings: result.warnings,
        provenance: result.product.provenance,
        requiresConfirmation: true,
      }, { status: 201 });
    }
    if (input.images && input.images.length > 0) {
      const { aiImages, storedImages } = saveImages(input.images);
      const result = await analyzeImages(repos, ai, aiImages, input.mode, storedImages);
      return json({
        product: result.product,
        warnings: result.warnings,
        provenance: result.product.provenance,
        requiresConfirmation: true,
      }, { status: 201 });
    }
    throw new AppError("请提供 1688 链接或图片用于提取。", { status: 422 });
  } catch (error) {
    return routeError(error);
  }
}
