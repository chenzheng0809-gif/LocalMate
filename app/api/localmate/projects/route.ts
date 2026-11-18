import { enforceGuestLimit } from "@/lib/ai/guest";
import { createHash } from "node:crypto";
import { z } from "zod";
import { intakeFromAgent } from "@/lib/agent/intake";
import { findSupplierProductUrl } from "@/lib/agent/product-url";
import { getAIProvider } from "@/lib/ai/factory";
import { json, readJson, routeError } from "@/lib/api/respond";
import { AppError } from "@/lib/errors";
import { createManualProduct } from "@/lib/product/service";
import { getRepositories } from "@/lib/repositories";
import { createMissionInput, marketCodes, type Mission } from "@/lib/localmate/mission-model";
import { agents } from "@/lib/localmate/team-model";
import { mentionedMarkets, planInstruction } from "@/lib/localmate/team-workflow";

export const runtime = "nodejs";
export const maxDuration = 300;

const projectInput = z.object({
  requestId: z.string().uuid(),
  direction: z.literal("product_to_market"),
  goal: z.string().trim().min(3).max(1000),
  deferResearch: z.boolean().optional(),
  target: z.enum(agents).optional(),
  productId: z.string().max(100).optional(),
  sourceUrl: z.string().trim().min(3).max(2048).optional(),
  markets: z.array(z.string().refine(code => marketCodes.includes(code))).max(4).optional(),
  file: z.object({
    name: z.string().min(1).max(180),
    data: z.string().max(7_000_000).regex(/^data:[\w/.+-]*;base64,[A-Za-z0-9+/]+={0,2}$/),
  }).optional(),
}).strict();

const requests = new Map<string, { fingerprint: string; project: Promise<Mission> }>();

async function create(input: z.infer<typeof projectInput>) {
  const repos = getRepositories();
  const prior = repos.missions.byRequest(input.requestId);
  const scope = [...new Set(input.markets?.length ? input.markets : mentionedMarkets(input.goal))].slice(0, 4);
  const sourceUrl = findSupplierProductUrl(input.sourceUrl ?? input.goal) ?? undefined;
  if (input.sourceUrl && (!sourceUrl || input.productId)) {
    throw new AppError("商品优先项目请选择公开的 1688、淘宝或天猫链接，或关联已有商品。", { status: 422 });
  }
  let productId = input.productId ?? prior?.productId;
  if (!productId) {
    const file = input.file;
    const image = file?.data.match(/^data:image\/(?:png|jpeg|webp|gif);base64,/) ? file.data : undefined;
    const fileText = file && /\.(?:txt|csv|md|json)$/i.test(file.name)
      ? Buffer.from(file.data.split(",")[1], "base64").toString("utf8").slice(0, 2000) : "";
    const brief = input.goal.replace(/https?:\/\/\S+/g, "").replace(/^我(?:手头)?有(?:一款|一件|一个)?/, "").trim();
    const text = [/^(?:核对附件 |.+ · 待补项目资料$)/.test(brief) ? "" : brief, fileText].filter(Boolean).join("\n");
    const ai = getAIProvider();
    const canInspectImage = image && ai?.analyzeImage && ai.info.capabilities.vision;
    if (sourceUrl || canInspectImage) {
      ({ product: { id: productId } } = await intakeFromAgent({ repos, ai, message: text, sourceUrl, images: image ? [image] : undefined }));
    } else {
      const fallback = "待确认商品";
      try {
        if (text.length < 3 || text === fallback) throw new AppError(fallback);
        ({ product: { id: productId } } = await intakeFromAgent({ repos, ai, message: text }));
      } catch (error) {
        if (!(error instanceof AppError) || error.status === 429) throw error;
        const url = input.goal.match(/https?:\/\/[^\s，。]+/)?.[0];
        const product = await createManualProduct(repos, { name: fallback, description: text.slice(0, 1800), sourceUrl: url, mode: "LIVE" });
        productId = product.id;
      }
    }
  }
  const fields = { requestId: input.requestId, goal: input.goal };
  const payload = createMissionInput.parse({ ...fields, direction: "product_to_market", productId, markets: scope });
  return repos.missions.create(payload, mission => {
    const taskScope = scope;
    const plan = planInstruction({ ...mission, markets: [] }, input.goal, input.target);
    repos.team.enqueue(mission.id, { ...plan, agents: input.deferResearch ? [] : plan.agents, markets: taskScope,
      requestId: input.requestId, instruction: input.goal, file: input.file, sourceUrl: input.sourceUrl ? sourceUrl : undefined });
  });
}

export async function POST(request: Request) {
  try {
    if (Number(request.headers.get("content-length")) > 7_100_000) throw new AppError("附件超过 5 MB。", { status: 413 });
    const input = projectInput.parse(await readJson(request));
    const fingerprint = createHash("sha256").update(JSON.stringify(input)).digest("hex");
    let pending = requests.get(input.requestId);
    if (pending && pending.fingerprint !== fingerprint) throw new AppError("该请求已用于另一个项目。", { status: 409 });
    if (!pending) {
      const project = (async () => {
        if (!getRepositories().missions.byRequest(input.requestId)) await enforceGuestLimit(request);
        return create(input);
      })().finally(() => requests.delete(input.requestId));
      pending = { fingerprint, project };
      requests.set(input.requestId, pending);
    }
    const mission = await pending.project;
    return json({ mission }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
