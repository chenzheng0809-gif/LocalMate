import { getRepositories } from "@/lib/repositories";
import { createPassport } from "@/lib/passport/service";
import { AppError } from "@/lib/errors";
import { json, routeError, routeParam } from "@/lib/api/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<Record<string, string>> }) {
  try {
    const id = await routeParam(context, "id");
    const repos = getRepositories();
    const product = repos.products.getById(id);
    if (!product) throw new AppError("产品不存在。", { status: 404 });
    const latest = repos.passports.getLatest(id);
    return json({
      passport: latest?.snapshot ?? null,
      versions: repos.passports.listByProduct(id).map((record) => ({
        version: record.version,
        createdAt: record.createdAt,
        passportId: record.id,
      })),
    });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(_request: Request, context: { params: Promise<Record<string, string>> }) {
  try {
    const id = await routeParam(context, "id");
    const repos = getRepositories();
    const product = repos.products.getById(id);
    if (!product) throw new AppError("产品不存在。", { status: 404 });
    if (!product.confirmed) throw new AppError("签发护照前，请先确认产品简报。", { status: 409, code: "PRODUCT_NOT_CONFIRMED" });
    const passport = createPassport({ repos, productId: id });
    return json({ passport }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
