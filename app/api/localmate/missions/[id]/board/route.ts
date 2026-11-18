import { z } from "zod";
import { json, readJson, routeError } from "@/lib/api/respond";
import { AppError } from "@/lib/errors";
import { pilotReviewMarkdown, shopifyDraftCsv } from "@/lib/localmate/launch";
import { shopifyDraftClient, shopifyTestShop } from "@/lib/localmate/shopify";
import { getRepositories } from "@/lib/repositories";

const command = z.discriminatedUnion("type", [
  z.object({ type: z.literal("generate"), market: z.string().regex(/^[A-Z]{2}$/) }).strict(),
  z.object({ type: z.literal("approve"), proposalId: z.string().max(80), hash: z.string().regex(/^[a-f0-9]{64}$/) }).strict(),
  z.object({ type: z.literal("draft_start"), approvalId: z.string().max(80) }).strict(),
  z.object({ type: z.literal("draft"), approvalId: z.string().max(80),
    title: z.string().trim().min(2).max(160).refine(value => !/^[=+@-]/.test(value)),
    description: z.string().trim().min(2).max(5000).refine(value => !/^[=+@-]/.test(value)),
  }).strict(),
  z.object({ type: z.enum(["shopify_create", "shopify_check"]), draftId: z.string().max(80), shop: z.string().max(90) }).strict(),
  z.object({ type: z.literal("complete"), taskId: z.string().max(80) }).strict(),
]);

export const runtime = "nodejs";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    const sameOrigin = host ? `${new URL(request.url).protocol}//${host}` : new URL(request.url).origin;
    if (origin && origin !== sameOrigin) throw new AppError("请在当前工作台操作。", { status: 403 });
    const input = command.parse(await readJson(request));
    const { id } = await context.params;
    const { board } = getRepositories();
    if (input.type === "generate") return json({ proposal: board.generate(id, input.market) });
    if (input.type === "approve") return json({ approval: board.approve(id, input.proposalId, input.hash) });
    if (input.type === "draft_start") return json({ draft: board.startDraft(id, input.approvalId) });
    if (input.type === "draft") return json({ draft: board.saveDraft(id, input.approvalId, input.title, input.description) });
    if (input.type === "shopify_create" || input.type === "shopify_check") {
      const shop = shopifyTestShop();
      if (!shop || shop !== input.shop) throw new AppError("请核对当前配置的 Shopify 开发店。", { status: 409 });
      const draft = board.draft(id, input.draftId);
      if (!draft) throw new AppError("未找到该项目的草稿。", { status: 404 });
      const client = shopifyDraftClient(shop, process.env.LOCALMATE_SHOPIFY_ADMIN_TOKEN!);
      await client.assertTestShop();
      const handle = `localmate-${draft.id.replaceAll("_", "-")}`;
      const { write, record } = board.reserveShopify(id, draft.id, shop, input.type === "shopify_create");
      const created = write ? await client.create(draft, handle) : null;
      const product = await client.read(handle, created?.id ?? record.remoteId ?? undefined);
      if (!product || product.handle !== handle || product.status !== "DRAFT") {
        throw new AppError("尚未回读到匹配的 Shopify 草稿，请在开发店检查状态。", { status: 409 });
      }
      return json({ shopify: board.verifyShopify(draft.id, shop, product.id) });
    }
    if (input.type !== "complete") throw new AppError("未知操作。", { status: 422 });
    board.complete(id, input.taskId);
    return json({ completed: true });
  } catch (error) {
    return routeError(error);
  }
}


export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const query = new URL(request.url).searchParams;
    const board = getRepositories().board;
    const review = query.get("review");
    if (review) {
      const { proposal, approval, current } = board.pilotReview(id, review);
      return new Response(pilotReviewMarkdown(proposal, approval, current), {
        headers: {
          "content-type": "text/markdown; charset=utf-8",
          "content-disposition": `attachment; filename="pilot-review-${proposal.id}.md"`,
          "cache-control": "no-store",
        },
      });
    }
    const draftId = query.get("draft");
    const draft = draftId ? board.draft(id, draftId) : null;
    if (!draft) throw new AppError("未找到该项目的草稿。", { status: 404 });
    return new Response(shopifyDraftCsv(draft), {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="shopify-${draft.id}.csv"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    return routeError(error);
  }
}
