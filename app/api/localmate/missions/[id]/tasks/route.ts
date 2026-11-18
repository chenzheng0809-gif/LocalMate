import { enforceGuestLimit } from "@/lib/ai/guest";
import { z } from "zod";
import { json, readJson, routeError, routeParam } from "@/lib/api/respond";
import { getDb } from "@/lib/db/client";
import { workerOnline } from "@/lib/workflow/worker-lease";
import { AppError } from "@/lib/errors";
import { getRepositories } from "@/lib/repositories";
import { planInstruction } from "@/lib/localmate/team-workflow";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
type Context = { params: Promise<{ id: string }> };

const commandInput = z.discriminatedUnion("type", [
  z.object({ type: z.literal("dispatch"), requestId: z.string().uuid(), instruction: z.string().trim().min(2).max(1000),
    method: z.object({ id: z.string().max(100), revision: z.number().int().nonnegative() }).optional() }),
  z.object({ type: z.literal("retry"), id: z.string() }),
]);

export async function GET(request: Request, context: Context) {
  try {
    const id = await routeParam(context, "id");
    const repos = getRepositories();
    const mission = repos.missions.get(id);
    if (!mission) throw new AppError("未找到项目。", { status: 404 });
    const fileId = new URL(request.url).searchParams.get("file");
    if (fileId) {
      const file = repos.team.file(id, fileId);
      if (!file) throw new AppError("未找到附件。", { status: 404 });
      const bytes = Uint8Array.from(Buffer.from(file.data.split(",")[1], "base64"));
      return new Response(bytes, { headers: {
        "content-type": "application/octet-stream", "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(file.name)}`,
        "x-content-type-options": "nosniff", "cache-control": "no-store",
      } });
    }
    return json({ tasks: repos.team.list(id), budget: repos.team.budget(id), workerOnline: workerOnline(getDb()), updatedAt: mission.updatedAt },
      { headers: { "cache-control": "no-store" } });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const id = await routeParam(context, "id");
    const repos = getRepositories();
    const mission = repos.missions.get(id);
    if (!mission) throw new AppError("未找到项目。", { status: 404 });
    const command = commandInput.parse(await readJson(request));
    if (command.type === "dispatch") {
      const { instruction, requestId } = command;
      const existing = repos.team.instruction(id, requestId);
      if (existing) {
        if (existing.instruction !== instruction || existing.method?.id !== command.method?.id ||
          existing.method?.revision !== command.method?.revision) {
          throw new AppError("请求编号已绑定另一条指令。", { status: 409 });
        }
      } else {
        const plan = planInstruction(mission, instruction);
        if (!plan.markets.length) plan.markets = [...new Set(repos.team.list(id).flatMap(task => task.markets))].slice(0, 4);
        const method = command.method && repos.methods.get(command.method.id);
        if (command.method && (!method?.enabled || method.revision !== command.method.revision)) {
          throw new AppError("做法已停用或更新，请刷新后重新选择。", { status: 409 });
        }
        const snapshot = method && { id: method.id, revision: method.revision, name: method.name,
          scope: method.scope, instructions: method.instructions };
        await enforceGuestLimit(request);
        repos.team.dispatch(id, { ...plan, instruction, requestId, method: snapshot });
      }
    } else if (command.type === "retry") {
      await enforceGuestLimit(request);
      repos.team.retry(id, command.id);
    }
    return json({ tasks: repos.team.list(id), budget: repos.team.budget(id) }, { status: 202 });
  } catch (error) {
    return routeError(error);
  }
}
