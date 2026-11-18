import { enforceGuestLimit } from "@/lib/ai/guest";
import { getAIProvider } from "@/lib/ai/factory";
import { getRepositories } from "@/lib/repositories";
import { analyzeImages, createManualProduct, importProductFromUrl } from "@/lib/product/service";
import { saveImages } from "@/lib/product/uploads";
import { ProductImportRequestSchema } from "@/schemas/product";
import { AppError } from "@/lib/errors";
import { json, readJson, routeError } from "@/lib/api/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const input = ProductImportRequestSchema.parse(await readJson(request));
    const repos = getRepositories();
    await enforceGuestLimit(request);
    const ai = getAIProvider();

    if (input.manual?.name) {
      const product = await createManualProduct(repos, {
        ...input.manual,
        name: input.manual.name,
        mode: input.manual.mode ?? input.mode,
      });
      return json({ product, warnings: [], source: "manual" }, { status: 201 });
    }

    if (input.sourceUrl) {
      const result = await importProductFromUrl(repos, ai, input.sourceUrl, input.mode);
      return json({ product: result.product, warnings: result.warnings, source: "url", fetched: result.fetched }, { status: 201 });
    }

    if (input.images && input.images.length > 0) {
      const { aiImages, storedImages } = saveImages(input.images);
      const result = await analyzeImages(repos, ai, aiImages, input.mode, storedImages);
      return json({ product: result.product, warnings: result.warnings, source: "image" }, { status: 201 });
    }

    throw new AppError("请提供 1688 链接、手动产品简报，或至少一张图片。", {
      status: 422,
      code: "EMPTY_IMPORT",
    });
  } catch (error) {
    return routeError(error);
  }
}
