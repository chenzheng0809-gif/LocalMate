import { json, readJson, routeError } from "@/lib/api/respond";
import { AppError } from "@/lib/errors";
import { missionCommand } from "@/lib/localmate/mission-model";
import { getRepositories } from "@/lib/repositories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const command = missionCommand.parse(await readJson(request));
    const mission = getRepositories().missions.command(id, command);
    return json({ mission });
  } catch (error) {
    return routeError(error);
  }
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const { missions } = getRepositories();
    const mission = missions.get(id);
    if (!mission) throw new AppError("未找到项目。", { status: 404, code: "MISSION_NOT_FOUND" });
    return json({ mission, plan: missions.plan(id), costs: missions.costs(id) });
  } catch (error) {
    return routeError(error);
  }
}
