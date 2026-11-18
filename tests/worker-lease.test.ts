import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { openDatabase } from "@/lib/db/client";
import { createWorkerLease, workerOnline } from "@/lib/workflow/worker-lease";
import { createRepositories } from "@/lib/repositories";
import { seedProduct } from "./fixtures";

it("reclaims interrupted work only after exclusive ownership changes across database connections", () => {
  const dir = mkdtempSync(join(tmpdir(), "localmate-lease-test-"));
  const db = openDatabase(join(dir, "queue.db"));
  const db2 = openDatabase(join(dir, "queue.db"));
  try {
    const first = createWorkerLease(db);
    const successor = createWorkerLease(db2);
    expect(first.acquire()).toBe(true);
    const repos = createRepositories(db);
    const { jobs, missions, team } = repos;
    const product = seedProduct(repos, { mode: "LIVE" });
    const job = jobs.create(product.id, ["US"]);
    expect(jobs.claim(job.id)?.status).toBe("RUNNING");
    const capped = jobs.create(product.id, ["UK"]);
    jobs.claim(capped.id);
    jobs.update(capped.id, { attempts: 3 });
    const mission = missions.create({
      requestId: randomUUID(), goal: "验证工作进程恢复", direction: "product_to_market", markets: ["US"], productId: product.id,
    });
    team.dispatch(mission.id, { requestId: randomUUID(), instruction: "核对市场", markets: ["US"], agents: ["Scout"] });
    const old = team.claim(mission.id, "Scout")!;
    expect(successor.acquire()).toBe(false);
    expect(jobs.getById(job.id)?.status).toBe("RUNNING");
    expect(workerOnline(db2)).toBe(true);
    db2.prepare("UPDATE workflow_worker SET expires_at = 0 WHERE id = 1").run();
    expect(successor.acquire()).toBe(true);
    expect(first.renew()).toBe(false);
    expect(() => first.assertOwnership()).toThrow("失去任务队列租约");
    expect(jobs.getById(job.id)).toMatchObject({ status: "PENDING", attempts: 2 });
    expect(jobs.getById(capped.id)?.status).toBe("FAILED");
    expect(team.list(mission.id)[0]).toMatchObject({ id: old.task.id, status: "queued" });
    team.finish(old.task, old.claim, "completed", { summary: "expired" });
    expect(team.list(mission.id)[0].status).toBe("queued");
    first.release();
    expect(workerOnline(db2)).toBe(true);
  } finally {
    db.close();
    db2.close();
    rmSync(dir, { force: true, recursive: true });
  }
});
