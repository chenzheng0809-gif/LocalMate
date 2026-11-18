import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { createTestDb } from "@/lib/db/client";
import { createRepositories } from "@/lib/repositories";
import { planInstruction, mentionedMarkets } from "@/lib/localmate/team-workflow";
import { currentTask } from "@/lib/localmate/team-model";
import { seedProduct } from "./fixtures";

it("routes authored instructions, preserves queue ordering and recovers expired claims without accepting stale completion", () => {
  const db = createTestDb();
  try {
    const { missions, team } = createRepositories(db);
    const mission = missions.create({ requestId: randomUUID(), direction: "market_to_product", goal: "旅行收纳市场机会", markets: ["US", "CA", "TH"] });
    expect(mentionedMarkets("Compare the US, Canada and Thailand for my product in 2026")).toEqual(["US", "CA", "TH"]);
    const instruction = "@Scout 调查加拿大市场";
    const command = { ...planInstruction(mission, instruction), instruction, requestId: randomUUID() };
    expect(command.agents).toEqual(["Scout"]);
    expect(command.markets).toEqual(["CA"]);
    team.dispatch(mission.id, command);
    team.dispatch(mission.id, command);
    const first = team.claim(mission.id, "Scout")!;
    expect(first.task.status).toBe("running");
    expect(team.claim(mission.id, "Scout")).toBeNull();
    db.prepare("UPDATE localmate_agent_tasks SET lease_until = ? WHERE id = ?").run("2000-01-01T00:00:00Z", first.task.id);
    expect(team.resumable(mission.id)).toBe(true);
    const resumed = team.claim(mission.id, "Scout")!;
    expect(resumed.task.id).toBe(first.task.id);
    team.finish(first.task, first.claim, "failed", { summary: "stale attempt" });
    expect(currentTask(team.list(mission.id), "Scout")?.status).toBe("running");
    team.finish(resumed.task, resumed.claim, "waiting", { summary: "请提供资料" });
    expect(team.list(mission.id)).toHaveLength(1);
    expect(currentTask(team.list(mission.id), "Scout")?.result?.summary).toBe("请提供资料");
    team.retry(mission.id, resumed.task.id);
    expect(currentTask(team.list(mission.id), "Scout")?.status).toBe("queued");
  } finally {
    db.close();
  }
});

it("binds the pilot budget to proposal versions and rejects approval after a budget change", () => {
  const db = createTestDb();
  try {
    const repos = createRepositories(db);
    const product = seedProduct(repos, { mode: "LIVE" });
    const mission = repos.missions.create({
      requestId: randomUUID(), direction: "product_to_market", goal: "测试收纳产品", markets: ["US", "CA", "TH"], productId: product.id,
    });
    const proposal = repos.board.generate(mission.id, "US");
    const instruction = "把试卖预算调整为 8000 元，重新比较三个市场。";
    const plan = planInstruction(mission, instruction);
    expect(plan.agents).toHaveLength(4);
    expect(plan.budgetMinor).toBe(800000);
    repos.team.dispatch(mission.id, { ...plan, instruction, requestId: randomUUID() });
    expect(() => repos.board.approve(mission.id, proposal.id, proposal.hash)).toThrow("输入已更新");
    const updated = repos.board.generate(mission.id, "US");
    expect(updated.snapshot.budgetMinor).toBe(800000);
    expect(repos.board.approve(mission.id, updated.id, updated.hash).tasks).toHaveLength(4);
  } finally {
    db.close();
  }
});
