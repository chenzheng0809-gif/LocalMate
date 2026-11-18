import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { createTestDb } from "@/lib/db/client";
import { AppError } from "@/lib/errors";
import { createRepositories } from "@/lib/repositories";
import { seedProduct } from "./fixtures";

it("blocks stale proposals, creates a version from updated costs and dispatches a single internal checklist", () => {
  const db = createTestDb();
  try {
    const repos = createRepositories(db);
    const { board, missions, products } = repos;
    const product = seedProduct(repos, { mode: "LIVE" });
    const mission = missions.create({
      requestId: randomUUID(), direction: "product_to_market", goal: "收纳产品试卖准备",
      productId: product.id, markets: ["MX"],
    });
    const first = board.generate(mission.id, "MX");
    expect(first.snapshot.evidence).toEqual([]);
    expect(first.snapshot.cost).toBeNull();
    expect(board.generate(mission.id, "MX").id).toBe(first.id);
    missions.command(mission.id, {
      type: "save_cost", revision: 0, market: "MX", price: "40.5", procurement: "30",
      logistics: "15", channelFees: "5", taxes: "0", acquisition: "0", source: "测试报价",
    });
    expect(() => board.approve(mission.id, first.id, first.hash)).toThrow(AppError);
    const second = board.generate(mission.id, "MX");
    expect(second.version).toBe(2);
    expect(second.snapshot.cost?.contributionMinor).toBe(-950);
    expect(second.snapshot.tasks.find(task => task.owner === "Margin")?.title).toContain("亏损");
    expect(() => board.approve(mission.id, second.id, first.hash)).toThrow(AppError);
    const approval = board.approve(mission.id, second.id, second.hash);
    expect(approval.scope).toBe("internal_preparation");
    expect(board.approve(mission.id, second.id, second.hash).id).toBe(approval.id);
    expect(approval.tasks).toHaveLength(4);
    expect(() => board.complete("another_mission", approval.tasks[0].id)).toThrow(AppError);
    board.complete(mission.id, approval.tasks[0].id);
    expect(board.approvals(mission.id)[0].tasks[0].status).toBe("done");

    products.update(product.id, { name: "修订后的收纳商品" });
    expect(() => board.generate(mission.id, "MX")).toThrow(AppError);
    products.update(product.id, { confirm: true });
    const third = board.generate(mission.id, "MX");
    expect(third.version).toBe(3);
    expect(third.snapshot.productName).toBe("修订后的收纳商品");
    expect(board.list(mission.id)).toHaveLength(3);
    expect(board.approvals(mission.id)).toHaveLength(1);
  } finally {
    db.close();
  }
});

it("requires dated FX for foreign scopes and saves an approved es-MX draft version for a single Shopify write", async () => {
  const { missionCommand, calculateCost } = await import("@/lib/localmate/mission-model");
  const { shopifyDraftCsv, launchGate } = await import("@/lib/localmate/launch");
  const { shopifyDraftClient } = await import("@/lib/localmate/shopify");
  const db = createTestDb();
  try {
    const repos = createRepositories(db);
    const product = seedProduct(repos, { mode: "LIVE" });
    const mission = repos.missions.create({
      requestId: randomUUID(), direction: "product_to_market", goal: "墨西哥草稿测试",
      productId: product.id, markets: ["MX", "BR"],
    });
    const base = { type: "save_cost", revision: 0, market: "MX", price: "150", procurement: "70",
      logistics: "20", channelFees: "10", taxes: "20", acquisition: "0", source: "隔离测试" };
    const cost = missionCommand.parse({ ...base, valuation: { currency: "MXN", fxToCny: "0.3625",
      fxAt: "2025-01-01T00:00:00Z", fxSource: "测试汇率", lowPrice: "130", highPrice: "180" } });
    expect(() => repos.missions.command(mission.id, missionCommand.parse({ ...base, valuation: { currency: "MXN" } }))).toThrow();
    if (cost.type !== "save_cost") throw new Error("invalid fixture");
    expect(calculateCost(cost).valuation).toMatchObject({ contributionCnyMinor: 1088, lowContributionMinor: 1000, highContributionMinor: 6000 });
    repos.missions.command(mission.id, cost);
    const proposal = repos.board.generate(mission.id, "MX");
    expect(proposal.snapshot.pilotGate?.status).toBe("NEEDS_REVIEW");
    expect(launchGate({ market: "MX", contribution: 100, lowContribution: null, complianceStatus: "RESTRICTED", missing: [], sourceCount: 2 }).status).toBe("BLOCKED");
    expect(launchGate({ market: "MX", contribution: 100, lowContribution: 10, complianceStatus: "PRECHECK_COMPLETE", missing: [], sourceCount: 2 }).status).toBe("READY_FOR_PILOT");
    const approval = repos.board.approve(mission.id, proposal.id, proposal.hash);
    const draft = repos.board.saveDraft(mission.id, approval.id, 'Organizador compacto', 'Caja <compacta>.');
    expect(shopifyDraftCsv(draft)).toContain('"Caja &lt;compacta&gt;.","draft"');
    const shop = "sample-dev.myshopify.com";
    expect(repos.board.reserveShopify(mission.id, draft.id, shop, true).write).toBe(true);
    expect(repos.board.reserveShopify(mission.id, draft.id, shop, true).write).toBe(false);
    const client = shopifyDraftClient(shop, "fixture", async (_url, init) => {
      const payload = JSON.parse(String(init?.body));
      if (payload.query.includes("partnerDevelopment")) return Response.json({ data: { shop: { plan: { partnerDevelopment: true } } } });
      expect(payload.variables.product.status).toBe("DRAFT");
      expect(payload.variables.product.descriptionHtml).toBe("Caja &lt;compacta&gt;.");
      return Response.json({ data: { productCreate: { userErrors: [], product: { id: "gid://shopify/Product/1", handle: "fixture", status: "DRAFT" } } } });
    });
    await client.assertTestShop();
    const remote = await client.create(draft, "fixture");
    expect(repos.board.verifyShopify(draft.id, shop, remote.id)?.state).toBe("verified");
    expect(repos.board.approvals(mission.id)[0]).toMatchObject({ draft: { id: draft.id }, shopify: { state: "verified" } });
  } finally {
    db.close();
  }
});
