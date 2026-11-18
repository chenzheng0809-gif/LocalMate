import { getRepositories } from "@/lib/repositories";
import { createManualProduct } from "@/lib/product/service";
import { ManualProductInputSchema } from "@/schemas/product";
import { json, readJson, routeError } from "@/lib/api/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const repos = getRepositories();
    return json({
      products: repos.products.listRecent(30).map((product) => ({
        id: product.id,
        name: product.name,
        category: product.category,
        sourcePlatform: product.sourcePlatform,
        confirmed: product.confirmed,
        extractionStatus: product.extractionStatus,
        mode: product.mode,
        missingFields: product.missingFields,
        createdAt: product.createdAt,
        updatedAt: product.updatedAt,
      })),
    });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request) {
  try {
    const input = ManualProductInputSchema.parse(await readJson(request));
    const product = await createManualProduct(getRepositories(), input);
    return json({ product }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
