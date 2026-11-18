import { getRepositories } from "@/lib/repositories";
import { updateProduct } from "@/lib/product/service";
import { ProductPatchSchema } from "@/schemas/product";
import { AppError } from "@/lib/errors";
import { json, readJson, routeError, routeParam } from "@/lib/api/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<Record<string, string>> }) {
  try {
    const id = await routeParam(context, "id");
    const product = getRepositories().products.getById(id);
    if (!product) throw new AppError("产品不存在。", { status: 404 });
    return json({ product });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<Record<string, string>> }) {
  try {
    const id = await routeParam(context, "id");
    const patch = ProductPatchSchema.parse(await readJson(request));
    const product = updateProduct(getRepositories(), id, patch);
    return json({ product });
  } catch (error) {
    return routeError(error);
  }
}
