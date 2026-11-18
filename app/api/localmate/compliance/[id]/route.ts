import { z } from "zod";
import { enforceGuestLimit } from "@/lib/ai/guest";
import { json, readJson, routeError } from "@/lib/api/respond";
import { AppError } from "@/lib/errors";
import { runComplianceReview } from "@/lib/localmate/compliance-review";
import { mexicoMarketplaces, reportMarkets } from "@/lib/localmate/report-model";
import { getRepositories } from "@/lib/repositories";

export const runtime = "nodejs";
const input = z.object({ market: z.enum(reportMarkets), marketplace: z.enum(mexicoMarketplaces).optional() }).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const product = getRepositories().products.getById((await params).id);
    if (!product) throw new AppError("商品档案不存在。", { status: 404 });
    if (!product.confirmed) throw new AppError("请先确认商品资料。", { status: 409 });
    const { market, marketplace } = input.parse(await readJson(request));
    try {
      await enforceGuestLimit(request);
    } catch (error) {
      if (error instanceof AppError && error.code === "AI_GUEST_LIMIT") return json(await runComplianceReview(product, market, marketplace, false));
      throw error;
    }
    return json(await runComplianceReview(product, market, marketplace));
  } catch (error) {
    return routeError(error);
  }
}
