import { enforceGuestLimit } from "@/lib/ai/guest";
import { AppError } from "@/lib/errors";
import { AIError } from "@/lib/ai/types";
import { getRepositories } from "@/lib/repositories";
import { json, routeError } from "@/lib/api/respond";
import { reportMarkdown, reportSummary, reportTasks } from "@/lib/localmate/report-view";
import { commandSchema, fileKinds } from "@/lib/localmate/handoff-model";
import { attachment, fileData, findFile, getHandoff, getListingVariants, HandoffError, saveHandoff, saveListingVariants } from "@/lib/localmate/handoff-store";
import { documentText, runHandoffCommand, smtpReady } from "@/lib/localmate/handoff-actions";
import { channelFile, costFile, deliveryZip, excelMime, filledTemplate, inquiryFile, missingFile, quotePdf, quoteSources, replyComparison, withOriginals } from "@/lib/localmate/handoff-files";
import { listingDraft } from "@/lib/localmate/handoff-agent";
import { getAIProvider } from "@/lib/ai/factory";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
type Params = { params: Promise<{ id: string }> };

async function context(request: Request, { params }: Params) {
  const { id } = await params;
  const search = new URL(request.url).searchParams;
  const run = search.get("run");
  if (!run) throw new HandoffError("请选择一个报告。", 404);
  const report = reportSummary(reportTasks(getRepositories().team.list(id), run));
  const market = report?.markets.find(item => item.code === search.get("market"));
  if (!report?.done || !market) throw new HandoffError("该报告或市场无法交付。", 404);
  const scope = JSON.stringify([id, run, market.code]);
  const state = getHandoff(scope, report.input.category ?? "");
  const listingLines = market.outputs.find(item => item.agent === "Localizer")?.section?.lines ?? [];
  return { id, search, scope, state, report, input: report.input, market, listingLines };
}

function replyError(error: unknown) {
  if (error instanceof AppError || error instanceof AIError) return routeError(error);
  if (error instanceof HandoffError) return json({ error: error.message }, { status: error.status });
  console.error("[localmate handoff]", error instanceof Error ? error.name : "Unknown");
  return json({ error: "处理文件或请求失败。请检查资料格式后重试。" }, { status: 422 });
}

function download(data: Buffer | string, mime: string, name: string) {
  return new Response(typeof data === "string" ? data : new Uint8Array(data), { headers: {
    "Content-Type": mime, "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name).replace(/['()]/g, character => `%${character.charCodeAt(0).toString(16)}`)}`,
    "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
  } });
}

export async function GET(request: Request, params: Params) {
  try {
    const { id, search, scope, state, report, input, market, listingLines } = await context(request, params);
    const sources = market.outputs.find(item => item.agent === "Guard")?.evidence ?? [];
    const assets = search.get("export");
    const suffix = market.code;
    switch (assets) {
      case null: return json({
        state, smtp: smtpReady(), ai: Boolean(getAIProvider()), sources, options: getListingVariants(scope),
        draft: listingLines.filter(line => /^(标题|首屏文案)：/.test(line)),
        suggestedListing: listingDraft(input, market.code, listingLines),
      }, { headers: { "Cache-Control": "no-store" } });
      case "channel": return download(await channelFile(state, input, market.code), excelMime, `渠道跟进-${suffix}.xlsx`);
      case "rfq": return download(await inquiryFile(state, input, market.code), excelMime, `RFQ-${state.rfq?.id}.xlsx`);
      case "comparison": return download(await replyComparison(state), excelMime, `报价对照-${suffix}.xlsx`);
      case "originals": return download(await withOriginals(scope, await replyComparison(state), "报价对照.xlsx", "原始回单", state.files.filter(item => item.kind === "reply")), "application/zip", `报价对照和原始回单-${suffix}.zip`);
      case "quote": return download(await quotePdf(state), "application/pdf", `Buyer-Quote-${state.quote?.id}.pdf`);
      case "trace": return download(await quoteSources(state), excelMime, `买家报价追溯-${suffix}.xlsx`);
      case "missing": return download(await missingFile(state, market.code, sources, input), excelMime, `材料和补件-${suffix}.xlsx`);
      case "materials": return download(await withOriginals(scope, await missingFile(state, market.code, sources, input), "材料和补件.xlsx", "材料原件", state.files.filter(item => item.kind === "material")), "application/zip", `准入材料包-${suffix}.zip`);
      case "template": {
        if (!state.template) throw new HandoffError("请上传原模板并设置字段。", 409);
        const file = findFile(state, state.template.file, "template");
        return download(await filledTemplate(fileData(scope, file), state, input), file.mime, `已填-${suffix}-${file.name}`);
      }
      case "copy-draft": {
        const listing = state.agent?.listing;
        if (!listing?.title || !listing.description) throw new HandoffError("请先让 Agent 准备可核对的商品文案。", 409);
        return download(`${listing.title}\n\n${listing.description}`, "text/plain; charset=utf-8", `商品文案草稿-${suffix}.txt`);
      }
      case "listing-json":
      case "delivery-zip": {
        if (assets === "listing-json" && market.channel.id !== "mercado_libre") {
          throw new HandoffError("该站点未提供此格式的上架包。", 404);
        }
        const listing = state.listing;
        if (!listing) throw new HandoffError("请先确认本地商品文案和商家 SKU。", 409);
        const guard = market.outputs.find(item => item.agent === "Guard")?.section;
        const draft = {
          schemaVersion: 1,
          status: "draft",
          marketplace: market.channel.id,
          market: market.code,
          ...(market.channel.id === "mercado_libre" ? { locale: "es-MX" } : {}),
          category: state.channel?.category || null,
          product: {
            id: input.productId, snapshotAt: input.productUpdatedAt, name: input.name,
            dimensions: input.dimensions, packagingDimensions: input.packagingDimensions, packagedWeightKg: input.weightKg,
          },
          listing,
          review: {
            status: guard?.releaseHold ? "review_required" : "pending_review",
            reasons: guard?.lines ?? [],
            sources,
          },
        };
        const draftJson = JSON.stringify(draft, null, 2);
        if (assets === "listing-json") {
          return download(draftJson, "application/json; charset=utf-8", `Mercado-Libre-${suffix}-draft.json`);
        }

        const repos = getRepositories();
        const mission = repos.missions.get(id);
        const currentProduct = mission?.productId ? repos.products.getById(mission.productId) : null;
        const matchesProduct = currentProduct?.id === input.productId && currentProduct.updatedAt === input.productUpdatedAt;
        const cost = matchesProduct ? repos.missions.costs(id).find(item => item.market === market.code) : undefined;
        const [channelSheet, complianceSheet, costSheet] = await Promise.all([
          channelFile(state, input, market.code),
          missingFile(state, market.code, sources, input),
          cost ? costFile(cost) : undefined,
        ]);
        const bundle = await deliveryZip({
          "00-交付说明.txt": [
            `${input.name} · ${market.name} · ${market.channel.name}`,
            "上架草稿供内部核对，上传前请完成对应站点准入、类目和材料核验。",
            cost ? `单件测算取该项目、该市场最新已保存的记录（V${cost.version}）。`
              : matchesProduct ? "该市场尚无已保存测算，交付包未包含测算表。"
                : "此报告使用旧商品版本，交付包未合并当前商品的测算表。",
          ].join("\n"),
          "01-出海研究报告.md": reportMarkdown({ ...report, markets: [market] }),
          "02-渠道跟进.xlsx": channelSheet,
          "03-准入材料核对.xlsx": complianceSheet,
          "04-上架草稿.json": draftJson,
          "05-商品文案.txt": `${listing.title}\n\n${listing.description}\n\nSKU ${listing.sku}`,
          ...(costSheet ? { "06-单件测算.xlsx": costSheet } : {}),
        });
        return download(bundle, "application/zip", `LocalMate-${suffix}-交付包.zip`);
      }
      case "copy": {
        if (!state.listing) throw new HandoffError("请确认本地商品文案。", 409);
        const { title, description, sku, gtin, brand } = state.listing;
        return download([title, "", description, "", `SKU ${sku}`, brand && `Brand ${brand}`, gtin && `GTIN ${gtin}`].filter((line, index) => line || index === 1 || index === 3).join("\n"), "text/plain; charset=utf-8", `商品文案-${suffix}.txt`);
      }
      case "original": {
        const file = findFile(state, search.get("file") ?? "");
        return download(fileData(scope, file), file.mime, file.name);
      }
      case "excerpt": return json({ excerpt: await documentText(scope, state, search.get("file") ?? "") }, { headers: { "Cache-Control": "no-store" } });
      default: throw new HandoffError("找不到相应文件。", 404);
    }
  } catch (error) { return replyError(error); }
}

export async function POST(request: Request, params: Params) {
  try {
    if (request.headers.get("sec-fetch-site") === "cross-site") throw new HandoffError("请在当前项目内提交。", 403);
    const { scope, state, input, market, listingLines } = await context(request, params);
    const type = request.headers.get("content-type");
    const length = Number(request.headers.get("content-length") ?? 0);
    if (length > 10_600_000) throw new HandoffError("单份文件最多 10 MB。", 413);
    if (type?.startsWith("multipart/form-data")) {
      const form = await request.formData();
      const file = form.get("file");
      const kind = fileKinds.find(value => value === form.get("kind"));
      if (!kind || !(file instanceof File) || !file.size || file.size > 10_485_760) throw new HandoffError("请选择一份不超过 10 MB 的原件。", 413);
      if (String(form.get("version")) !== String(state.version)) throw new HandoffError("交付数据已更新，请刷新后重新上传。", 409);
      const bytes = Buffer.from(await file.arrayBuffer());
      const info = attachment(state, kind, String(form.get("rfqId") ?? ""), file, bytes);
      const saved = saveHandoff(scope, { ...state, files: [...state.files, info] }, { id: info.id, bytes });
      return json({ state: saved, file: info });
    }
    if (!type?.startsWith("application/json")) throw new HandoffError("请求格式无效。", 415);
    const inputData = await request.json();
    const result = commandSchema.safeParse(inputData);
    if (!result.success) {
      const issue = result.error.issues[0];
      throw new HandoffError(`请检查必填字段和格式（${issue.path.join(".")}）。`);
    }
    const command = result.data;
    if (command.type === "draft-copy" && command.automatic) {
      const cached = getListingVariants(scope);
      if (cached) return json({ options: cached });
    }
    if (command.type !== "draft-copy" && inputData?.version !== state.version) {
      throw new HandoffError("交付数据已更新，请刷新后重试。", 409);
    }
    if (["prepare", "draft-copy", "extract", "scan-rules"].includes(command.type)) await enforceGuestLimit(request);
    const outcome = await runHandoffCommand(scope, state, command, input, market.code, market.outputs.find(item => item.agent === "Guard")?.evidence ?? [], listingLines);
    return json(command.type === "draft-copy" && outcome.options
      ? { ...outcome, options: saveListingVariants(scope, outcome.options, command.automatic === true) }
      : outcome);
  } catch (error) { return replyError(error); }
}
