import { enforceGuestLimit } from "@/lib/ai/guest";
import { getAIProvider } from "@/lib/ai/factory";
import { getRepositories } from "@/lib/repositories";
import { generateLaunchPage, updateLaunchPage } from "@/lib/launch/service";
import { LaunchGenerateRequestSchema, LaunchPageUpdateSchema } from "@/schemas/launch";
import type { Country } from "@/types/domain";
import { COUNTRY_ORDER } from "@/types/domain";
import { AppError } from "@/lib/errors";
import { json, readJson, routeError, routeParam } from "@/lib/api/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

function assertCountry(value: string | null): Country {
  const upper = (value ?? "").toUpperCase();
  if (!COUNTRY_ORDER.includes(upper as Country)) {
    throw new AppError("请指定发布市场：US、JP、DE 或 UK。", { status: 422 });
  }
  return upper as Country;
}

export async function GET(request: Request, context: { params: Promise<Record<string, string>> }) {
  try {
    const id = await routeParam(context, "id");
    const url = new URL(request.url);
    const countryParam = url.searchParams.get("country");
    const repos = getRepositories();
    const product = repos.products.getById(id);
    if (!product) throw new AppError("产品不存在。", { status: 404 });
    const launch = countryParam
      ? repos.launch.get(id, assertCountry(countryParam))
      : repos.launch.getLatestByProduct(id);
    return json({
      product,
      launch,
      versions: repos.launch.listByProduct(id),
      markets: repos.research.getByProduct(id),
      compliance: repos.compliance.getByProduct(id),
    });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request, context: { params: Promise<Record<string, string>> }) {
  try {
    const id = await routeParam(context, "id");
    const raw = await readJson(request);
    await enforceGuestLimit(request);
    const parsed = LaunchGenerateRequestSchema.parse({ ...(raw as object), productId: id });
    const repos = getRepositories();
    const product = repos.products.getById(id);
    if (!product) throw new AppError("产品不存在。", { status: 404 });
    if (!product.confirmed) throw new AppError("生成本地化验证页前，请先确认产品简报。", { status: 409, code: "PRODUCT_NOT_CONFIRMED" });
    const launch = await generateLaunchPage({
      product,
      country: parsed.country,
      market: repos.research.get(id, parsed.country),
      compliance: repos.compliance.get(id, parsed.country),
      tone: parsed.tone,
      ai: getAIProvider(),
      repos,
    });
    return json({ launch }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}

export async function PATCH(request: Request, context: { params: Promise<Record<string, string>> }) {
  try {
    const id = await routeParam(context, "id");
    const url = new URL(request.url);
    const country = assertCountry(url.searchParams.get("country"));
    const patch = LaunchPageUpdateSchema.parse(await readJson(request));
    const repos = getRepositories();
    const product = repos.products.getById(id);
    if (!product) throw new AppError("产品不存在。", { status: 404 });
    if (!product.confirmed) throw new AppError("编辑本地化验证页前，请先确认产品简报。", { status: 409, code: "PRODUCT_NOT_CONFIRMED" });
    const launch = updateLaunchPage({
      repos,
      productId: id,
      country,
      patch,
    });
    return json({ launch });
  } catch (error) {
    return routeError(error);
  }
}
