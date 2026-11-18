import nextEnv from "@next/env";
import { setTimeout as delay } from "node:timers/promises";

nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV === "development");
const [{ getDb, resetDbSingleton }, { getRepositories }, { getAIProvider }, { runTeam }, { executeResearchJob }, { createWorkerLease }] =
  await Promise.all([
    import("@/lib/db/client"), import("@/lib/repositories"), import("@/lib/ai/factory"),
    import("@/lib/localmate/team-workflow"), import("@/lib/workflow/research"), import("@/lib/workflow/worker-lease"),
  ]);

const repos = getRepositories();
const lease = createWorkerLease(getDb());
let stopping = false;
let lost = false;
let heartbeat: ReturnType<typeof setInterval> | undefined;
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => { stopping = true; });
}

try {
  while (!stopping && !lease.acquire()) await delay(1000);
  if (!stopping) {
    console.log("[worker] 队列已连接");
    heartbeat = setInterval(() => {
      try {
        if (!lease.renew()) lost = true;
      } catch (error) {
        console.error("[worker] 续约失败", error);
        lost = true;
      }
    }, 3000);
    let preferTeam = true;
    while (!stopping && !lost) {
      lease.assertOwnership();
      const mission = repos.team.nextMission();
      const job = repos.jobs.nextPending();
      if (!mission && !job) {
        await delay(750);
        continue;
      }
      try {
        if (mission && (preferTeam || !job)) {
          preferTeam = false;
          await runTeam(mission, repos, lease.assertOwnership);
        } else if (job) {
          preferTeam = true;
          await executeResearchJob({ repos, ai: getAIProvider(), assertOwnership: lease.assertOwnership }, job.id);
        }
      } catch (error) {
        console.error("[worker] 任务执行出错", error);
        await delay(750);
      }
    }
    if (lost) process.exitCode = 1;
  }
} finally {
  clearInterval(heartbeat);
  lease.release();
  resetDbSingleton();
}
