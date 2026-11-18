import { getRepositories } from "@/lib/repositories";
import { buildMatchAnalysis } from "@/lib/matching/engine";
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
    const existing = repos.matches.getLatest(id);
    if (existing) return json({ match: existing, cached: true });
    const markets = repos.research.getByProduct(id);
    if (markets.length === 0) throw new AppError("请先运行研究，再进行匹配。", { status: 409 });
    const match = buildMatchAnalysis({
      product,
      markets,
      compliance: repos.compliance.getByProduct(id),
    });
    repos.matches.save(id, match);
    return json({ match, cached: false });
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
    const markets = repos.research.getByProduct(id);
    if (markets.length === 0) throw new AppError("请先运行研究，再进行匹配。", { status: 409 });
    const match = buildMatchAnalysis({
      product,
      markets,
      compliance: repos.compliance.getByProduct(id),
    });
    repos.matches.save(id, match);
    return json({ match });
  } catch (error) {
    return routeError(error);
  }
}
