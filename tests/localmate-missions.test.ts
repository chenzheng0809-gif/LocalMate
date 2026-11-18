import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { createTestDb, openDatabase } from "@/lib/db/client";
import { createRepositories } from "@/lib/repositories";
import { createMissionInput, legacyCountry, missionCommand } from "@/lib/localmate/mission-model";
import { seedProduct } from "./fixtures";

it("creates both paths and resumes the market-first project with a real product and versioned calculation after reopening SQLite", () => {
  const directory = mkdtempSync(join(tmpdir(), "localmate-phase1-"));
  const path = join(directory, "test.sqlite");
  let db = openDatabase(path);
  try {
    let repos = createRepositories(db);
    const product = seedProduct(repos, { mode: "LIVE" });
    const first = repos.missions.create(createMissionInput.parse({
      requestId: randomUUID(), direction: "product_to_market", goal: "验证收纳商品", markets: ["GB"], productId: product.id,
    }));
    expect(first.status).toBe("research_ready");
    expect(legacyCountry(first.markets[0])).toBe("UK");
    const empty = createMissionInput.parse({
      requestId: randomUUID(), direction: "market_to_product", goal: "寻找目标类目", market: "MX",
    });
    const waiting = repos.missions.create(empty);
    expect(repos.missions.create(empty).id).toBe(waiting.id);
    expect(() => repos.missions.create({ ...empty, goal: "另一个目标" })).toThrow();
    expect(waiting.status).toBe("awaiting_product");
    const linked = repos.missions.command(waiting.id, { type: "attach_product", revision: 0, productId: product.id });
    expect(linked.markets).toEqual(["MX"]);
    const costs = missionCommand.parse({
      type: "save_cost", revision: 1, market: "MX", price: "69.90", procurement: "20.01",
      logistics: "10.38", channelFees: "7", taxes: "2", acquisition: "0", source: "供应商测试报价",
    });
    repos.missions.command(waiting.id, costs);
    expect(() => repos.missions.command(waiting.id, costs)).toThrow();
    db.close();

    db = openDatabase(path);
    repos = createRepositories(db);
    expect(repos.missions.get(waiting.id)).toMatchObject({ revision: 2, productId: product.id });
    expect(repos.missions.costs(waiting.id)).toMatchObject([{ currency: "CNY", contributionMinor: 3051 }]);
    expect(repos.missions.list()).toHaveLength(2);
  } finally {
    db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

it("keeps demo products and cost data outside a project's configured scope out of the new workspace", () => {
  const db = createTestDb();
  try {
    const repos = createRepositories(db);
    const fixture = seedProduct(repos);
    const values = { requestId: randomUUID(), direction: "product_to_market", goal: "检查资料范围", markets: ["MX"] };
    const fixtureRequest = createMissionInput.parse({ ...values, productId: fixture.id });
    expect(() => repos.missions.create(fixtureRequest)).toThrow();
    const actual = seedProduct(repos, { mode: "LIVE" });
    const mission = repos.missions.create(createMissionInput.parse({ ...values, productId: actual.id }));
    expect(() => repos.missions.command(mission.id, missionCommand.parse({
      type: "save_cost", revision: 0, market: "BR", price: "69.90", procurement: "20",
      logistics: "10", channelFees: "7", taxes: "2", acquisition: "0", source: "报价单",
    }))).toThrow();
    expect(repos.missions.get(mission.id)?.revision).toBe(0);
  } finally {
    db.close();
  }
});
