import { uid, type AppDatabase } from "@/lib/db/client";

export const WORKER_LEASE_MS = 15_000;

/** SQLite is shared by the HTTP server and the worker. Only one worker owns this database. */
export function createWorkerLease(db: AppDatabase) {
  const token = uid("worker");
  function assertOwnership() {
    const now = Date.now();
    if (!db.prepare("SELECT 1 FROM workflow_worker WHERE id = 1 AND token = ? AND expires_at > ?").get(token, now)) {
      throw new Error("工作进程已失去任务队列租约。");
    }
  }
  return {
    acquire() {
      const now = Date.now();
      db.exec("BEGIN IMMEDIATE");
      try {
        const claimed = db.prepare(`INSERT INTO workflow_worker (id, token, expires_at) VALUES (1, ?, ?)
          ON CONFLICT(id) DO UPDATE SET token = excluded.token, expires_at = excluded.expires_at
          WHERE workflow_worker.expires_at <= ?`).run(token, now + WORKER_LEASE_MS, now);
        if (claimed.changes) {
          db.prepare(`UPDATE research_jobs SET status = 'FAILED', finished_at = ?, current_stage = '已中断',
            error = '工作进程多次中断，请手动重试。' WHERE status = 'RUNNING' AND attempts >= 3`).run(new Date(now).toISOString());
          db.exec(`UPDATE research_jobs SET status = 'PENDING', attempts = attempts + 1,
            progress = 0, current_stage = '等待恢复', started_at = NULL, finished_at = NULL, error = NULL
            WHERE status = 'RUNNING';
            UPDATE localmate_agent_tasks SET status = 'queued', claim = NULL, lease_until = NULL WHERE status = 'running';`);
        }
        db.exec("COMMIT");
        return Boolean(claimed.changes);
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
    renew() {
      const now = Date.now();
      return Boolean(db.prepare("UPDATE workflow_worker SET expires_at = ? WHERE id = 1 AND token = ? AND expires_at > ?")
        .run(now + WORKER_LEASE_MS, token, now).changes);
    },
    assertOwnership,
    release() {
      db.prepare("DELETE FROM workflow_worker WHERE id = 1 AND token = ?").run(token);
    },
  };
}

export function workerOnline(db: AppDatabase) {
  return Boolean(db.prepare("SELECT 1 FROM workflow_worker WHERE id = 1 AND expires_at > ?").get(Date.now()));
}
