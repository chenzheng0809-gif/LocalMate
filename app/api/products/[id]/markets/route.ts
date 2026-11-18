import { getRepositories } from "@/lib/repositories";
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
    return json({
      product,
      markets: repos.research.getByProduct(id),
      compliance: repos.compliance.getByProduct(id),
      match: repos.matches.getLatest(id),
      job: repos.jobs.getLatestByProduct(id),
    });
  } catch (error) {
    return routeError(error);
  }
}
