import { z } from "zod";
import { json, readJson, routeError } from "@/lib/api/respond";
import { AppError } from "@/lib/errors";
import { comparablesFor } from "@/lib/localmate/benchmarks";
import { getRepositories } from "@/lib/repositories";

const input = z.object({
  market: z.string().regex(/^[A-Z]{2}$/),
  comparableId: z.string().min(1).max(100),
  notes: z.string().trim().max(1000).default(""),
}).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const command = input.parse(await readJson(request));
    const { id } = await params;
    const repos = getRepositories();
    const mission = repos.missions.get(id);
    if (!mission) throw new AppError("未找到项目。", { status: 404 });
    if (!mission.markets.includes(command.market)) throw new AppError("请选择项目当前的目标市场。", { status: 422 });
    const comparable = comparablesFor(repos, mission, command.market).find(item => item.id === command.comparableId);
    if (!comparable) throw new AppError("该竞品已不在本市场的候选列表中，请刷新后重选。", { status: 409 });
    return json({ benchmark: repos.benchmarks.save(mission, command.market, comparable, command.notes) });
  } catch (error) {
    return routeError(error);
  }
}
