import { enforceGuestLimit } from "@/lib/ai/guest";
import { z } from "zod";
import { json, readJson, routeError } from "@/lib/api/respond";
import { AppError } from "@/lib/errors";
import { defaultMexicoMarketplace, mexicoMarketplaces, reportDimensions, reportMarkets, type ReportInput } from "@/lib/localmate/report-model";
import { agents } from "@/lib/localmate/team-model";
import { projectPlanInput } from "@/lib/localmate/mission-model";
import { getAIProvider } from "@/lib/ai/factory";
import { findSupplierProductUrl } from "@/lib/agent/product-url";
import { createManualProduct, extractProductFromUrl } from "@/lib/product/service";
import { getRepositories } from "@/lib/repositories";

export const runtime = "nodejs";
export const maxDuration = 300;

const input = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("import_product"),
    revision: z.number().int().nonnegative(),
    sourceUrl: z.string().trim().min(3).max(2048),
    updateExisting: z.boolean().default(false),
  }).strict(),
  projectPlanInput.extend({
    requestId: z.string().uuid(),
    mexicoMarketplace: z.enum(mexicoMarketplaces).optional(),
    budget: z.number().positive().max(10_000_000).nullable(),
  }),
  z.object({
    type: z.literal("save_candidate"),
    revision: z.number().int().nonnegative(),
    name: z.string().trim().min(2).max(200),
    supplier: z.string().trim().max(200),
    priceCNY: z.number().nonnegative().max(1_000_000).nullable(),
  }).strict(),
]);

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const repos = getRepositories();
    const command = input.parse(await readJson(request));
    if (command.type === "import_product") {
      const existingUpdatedAt = repos.missions.requireImportable(id, command.revision, command.updateExisting);
      const existing = command.updateExisting ? repos.missions.get(id)?.productId : undefined;
      const sourceUrl = findSupplierProductUrl(command.sourceUrl);
      if (!sourceUrl) throw new AppError("请粘贴公开的 1688、淘宝或天猫商品链接。", { status: 422 });
      await enforceGuestLimit(request);
      const imported = await extractProductFromUrl(repos, getAIProvider(), sourceUrl);
      const extracted = imported.product;
      const mission = repos.missions.importProduct(id, command.revision, command.updateExisting, existingUpdatedAt, () => {
        if (!existing) return repos.products.create(extracted).id;
        const { dimensions, packagingDimensions, weight, specifications } = extracted.attributes;
        const updated = repos.products.update(existing, {
          sourceUrl: extracted.sourceUrl ?? undefined, sourcePlatform: extracted.sourcePlatform,
          dimensions: dimensions ?? undefined, packagingDimensions: packagingDimensions ?? undefined,
          weight: weight ?? undefined, priceCNY: extracted.sourcing.priceCNY ?? undefined,
          specifications: specifications ?? undefined,
          provenance: Object.fromEntries(["attributes.dimensions", "attributes.packagingDimensions", "attributes.weight", "sourcing.priceCNY"]
            .filter(key => extracted.provenance[key] && extracted.provenance[key] !== "UNKNOWN")
            .map(key => [key, extracted.provenance[key]])),
        });
        if (!updated) throw new AppError("商品已不存在。", { status: 404 });
        return updated.id;
      });
      return json({ mission, product: repos.products.getById(mission.productId!), warnings: imported.warnings });
    }
    if (command.type === "save_candidate") {
      const mission = repos.missions.createCandidate(id, command.revision, () => createManualProduct(repos, {
        name: command.name, supplier: command.supplier || undefined, priceCNY: command.priceCNY ?? undefined,
      }).id);
      return json({ mission });
    }

    const current = repos.missions.get(id);
    if (!current) throw new AppError("未找到项目。", { status: 404 });
    const { requestId, budget, mexicoMarketplace, ...plan } = command;
    const productFirst = current.direction === "product_to_market";
    const prior = repos.team.instruction(id, requestId);
    let report: ReportInput | undefined = prior?.report;
    if (mexicoMarketplace && (!productFirst || !plan.markets.includes("MX"))) {
      throw new AppError("选择墨西哥作为研究市场后才能指定墨西哥站点。", { status: 422 });
    }
    if (productFirst && !prior) {
      const product = current.productId ? repos.products.getById(current.productId) : null;
      if (!product?.confirmed) throw new AppError("请先确认商品参数。", { status: 409 });
      if (budget === null || product.sourcing.priceCNY == null || !product.attributes.weight ||
          !reportDimensions(product.attributes.dimensions) || !reportDimensions(product.attributes.packagingDimensions)) {
        throw new AppError("请填写商品和单品包装的长、宽、高、采购价、含包装重量和试卖预算。", { status: 422 });
      }
      if (plan.markets.some(code => !reportMarkets.some(market => market === code))) {
        throw new AppError("请选择首批开放的六个研究市场。", { status: 422 });
      }
      report = {
        mexicoMarketplace: plan.markets.includes("MX") ? mexicoMarketplace ?? defaultMexicoMarketplace(current.goal) : undefined,
        productId: product.id, category: product.category, productUpdatedAt: product.updatedAt, name: product.name,
        dimensions: product.attributes.dimensions!, packagingDimensions: product.attributes.packagingDimensions!,
        weightKg: product.attributes.weight, purchaseCNY: product.sourcing.priceCNY, budgetCNY: budget };
    }
    const instruction = current.direction === "product_to_market"
      ? "生成完整出海研究报告"
      : ["@Scout 查找当地可验证的商品机会和可比商品。", plan.sourcing && `供货方向：${plan.sourcing}。`,
        plan.procurementLimit !== null && `单件采购价上限：人民币 ${plan.procurementLimit} 元。`].filter(Boolean).join(" ");
    const budgetMinor = budget === null ? undefined : Math.round(budget * 100);
    if (prior && ((mexicoMarketplace && (prior.report?.mexicoMarketplace ?? "amazon") !== mexicoMarketplace) ||
      prior.instruction !== instruction || prior.budgetMinor !== budgetMinor || prior.budgetCleared !== (budget === null) ||
      JSON.stringify(prior.markets) !== JSON.stringify(plan.markets))) {
      throw new AppError("请求编号已用于另一项研究。", { status: 409 });
    }
    if (!prior) await enforceGuestLimit(request);
    const mission = prior ? current : repos.missions.command(id, plan, () => {
      repos.team.enqueue(id, { requestId, instruction, markets: plan.markets, agents: report ? [...agents] : ["Scout"], budgetMinor, budgetCleared: budget === null, report });
    });
    return json({ mission, reportId: report ? requestId : undefined }, { status: 202 });
  } catch (error) {
    return routeError(error);
  }
}
