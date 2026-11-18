import { json, readJson, routeError } from "@/lib/api/respond";
import { AppError } from "@/lib/errors";
import { createMissionInput } from "@/lib/localmate/mission-model";
import { getRepositories } from "@/lib/repositories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const input = createMissionInput.parse(await readJson(request));
    if (input.direction !== "product_to_market") throw new AppError("新项目仅支持从商品找市场。", { status: 422 });
    return json({ mission: getRepositories().missions.create(input) }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
