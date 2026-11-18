import { getRepositories } from "@/lib/repositories";
import { COUNTRY_ORDER, type Country } from "@/types/domain";
import { AppError } from "@/lib/errors";
import { json, routeError, routeParam } from "@/lib/api/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<Record<string, string>> }) {
  try {
    const id = await routeParam(context, "id");
    const rawCountry = (await routeParam(context, "country")).toUpperCase();
    if (!COUNTRY_ORDER.includes(rawCountry as Country)) {
      throw new AppError("市场必须是 US、JP、DE 或 UK。", { status: 422 });
    }
    const check = getRepositories().compliance.get(id, rawCountry as Country);
    if (!check) throw new AppError("该市场还没有合规检查。", { status: 404 });
    return json({ compliance: check });
  } catch (error) {
    return routeError(error);
  }
}
