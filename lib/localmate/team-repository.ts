import type { ReportInput } from "./report-model";
import type { MethodSnapshot } from "./method-model";
import { createHash } from "node:crypto";
import { nowIso, parseJson, uid, type AppDatabase } from "@/lib/db/client";
import { AppError } from "@/lib/errors";
import { modules, type AgentName, type ProjectFile, type TaskResult, type TeamTask } from "./team-model";

type Dispatch = {
  requestId: string; instruction: string; markets: string[]; agents: AgentName[];
  budgetMinor?: number; budgetCleared?: boolean; file?: ProjectFile; method?: MethodSnapshot; sourceUrl?: string; report?: ReportInput;
};
function taskFromRow(row: Record<string, unknown>): TeamTask {
  const agent = row.agent as AgentName;
  const report = parseJson<ReportInput | undefined>(row.report_json, undefined);
  return {
    id: String(row.id), missionId: String(row.mission_id), agent,
    requestId: String(row.request_id), report,
    title: report ? modules[agent] : String(row.title), instruction: String(row.instruction),
    markets: parseJson<string[]>(row.markets_json, []), status: row.status as TeamTask["status"],
    result: parseJson<TaskResult | null>(row.result_json, null),
    method: parseJson<MethodSnapshot | undefined>(row.method_json, undefined),
    createdAt: String(row.created_at), updatedAt: String(row.updated_at),
  };
}

export function createTeamRepository(db: AppDatabase) {
  const list = (id: string) => db.prepare(
    `SELECT task.*, json_extract(instruction.input_json, '$.method') AS method_json,
      json_extract(instruction.input_json, '$.report') AS report_json
      FROM localmate_agent_tasks task JOIN localmate_instructions instruction USING (mission_id, request_id)
      WHERE task.mission_id = ? ORDER BY task.created_at DESC, task.rowid DESC`,
  ).all(id).map(taskFromRow);
  function enqueue(missionId: string, input: Dispatch) {
    const stored = JSON.stringify(input);
    const fingerprint = createHash("sha256").update(stored).digest("hex");
    const at = nowIso();
    const inserted = db.prepare(`INSERT INTO localmate_instructions VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT(mission_id, request_id) DO NOTHING`).run(missionId, input.requestId, stored, fingerprint, input.budgetMinor ?? null, at);
    if (!inserted.changes) {
      const previous = db.prepare("SELECT fingerprint FROM localmate_instructions WHERE mission_id = ? AND request_id = ?").get(missionId, input.requestId);
      if (previous?.fingerprint !== fingerprint) throw new AppError("请求编号已绑定另一条指令。", { status: 409 });
      return;
    }
    const insert = db.prepare(`INSERT INTO localmate_agent_tasks
      (id, mission_id, request_id, agent, title, instruction, markets_json, status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'queued', ?, ?)`);
    const goal = input.instruction.replace(/(?:^|\s)@[A-Za-z]+\b/g, "").trim();
    for (const agent of input.agents) {
      const title = input.report ? modules[agent] : goal.startsWith(modules[agent]) ? goal : `${modules[agent]}${goal ? ` · ${goal}` : ""}`;
      insert.run(uid("agent"), missionId, input.requestId, agent, title,
        input.instruction, JSON.stringify(input.markets), at, at);
    }
    db.prepare("UPDATE localmate_missions SET updated_at = ? WHERE id = ?").run(at, missionId);
  }
  return {
    list,
    enqueue,
    instruction(id: string, requestId: string) {
      const row = db.prepare("SELECT input_json FROM localmate_instructions WHERE mission_id = ? AND request_id = ?").get(id, requestId);
      return parseJson<Dispatch | null>(row?.input_json, null);
    },
    dispatch(missionId: string, input: Dispatch) {
      db.exec("BEGIN IMMEDIATE");
      try {
        enqueue(missionId, input);
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
    budget(id: string, through?: string): number | null {
      const result = db.prepare(`SELECT budget_minor FROM localmate_instructions WHERE mission_id = ?
        AND (budget_minor IS NOT NULL OR json_extract(input_json, '$.budgetCleared') = 1) AND created_at <= ? ORDER BY created_at DESC, rowid DESC LIMIT 1`).get(id, through ?? nowIso());
      return result?.budget_minor == null ? null : Number(result.budget_minor);
    },
    files(id: string) {
      return db.prepare(`SELECT request_id, json_extract(input_json, '$.file.name') AS name
        FROM localmate_instructions WHERE mission_id = ? AND json_type(input_json, '$.file') = 'object'`)
        .all(id).map(row => ({ requestId: String(row.request_id), name: String(row.name) }));
    },
    file(id: string, requestId: string) {
      const row = db.prepare("SELECT json_extract(input_json, '$.file') AS file FROM localmate_instructions WHERE mission_id = ? AND request_id = ?").get(id, requestId);
      return parseJson<ProjectFile | null>(row?.file, null);
    },
    nextMission() {
      const row = db.prepare(`SELECT mission_id FROM localmate_agent_tasks WHERE status = 'queued'
        ORDER BY created_at, rowid LIMIT 1`).get();
      return row ? String(row.mission_id) : null;
    },
    claim(id: string, agent: AgentName) {
      const claim = uid("lease");
      const now = nowIso();
      const lease = new Date(Date.now() + 5 * 60_000).toISOString();
      const row = db.prepare(`UPDATE localmate_agent_tasks SET status = 'running', updated_at = ?, claim = ?, lease_until = ?
        WHERE id = (SELECT id FROM localmate_agent_tasks WHERE mission_id = ? AND agent = ?
          AND (status = 'queued' OR (status = 'running' AND lease_until <= ?)) ORDER BY created_at, rowid LIMIT 1)
        AND NOT EXISTS (SELECT 1 FROM localmate_agent_tasks WHERE mission_id = ? AND agent = ? AND status = 'running' AND lease_until > ?)
        RETURNING *`).get(now, claim, lease, id, agent, now, id, agent, now);
      if (!row) return null;
      db.prepare("UPDATE localmate_missions SET updated_at = ? WHERE id = ?").run(now, id);
      const task = taskFromRow(row);
      const instruction = db.prepare("SELECT input_json FROM localmate_instructions WHERE mission_id = ? AND request_id = ?")
        .get(id, String(row.request_id));
      const stored = parseJson<Dispatch | null>(instruction?.input_json, null);
      task.method = stored?.method;
      task.report = stored?.report;
      return { task, claim };
    },
    finish(task: TeamTask, claim: string, status: "completed" | "failed" | "waiting", result: TaskResult) {
      const now = nowIso();
      const stored = db.prepare(`UPDATE localmate_agent_tasks SET status = ?, result_json = ?, claim = NULL,
        lease_until = NULL, updated_at = ? WHERE id = ? AND claim = ?`).run(status, JSON.stringify(result), now, task.id, claim);
      if (stored.changes) db.prepare("UPDATE localmate_missions SET updated_at = ? WHERE id = ?").run(now, task.missionId);
    },
    retry(id: string, taskId: string) {
      const now = nowIso();
      const row = db.prepare(`UPDATE localmate_agent_tasks SET status = 'queued', updated_at = ?
        WHERE mission_id = ? AND id = ? AND (status IN ('failed','waiting') OR (status = 'running' AND lease_until <= ?))`).run(now, id, taskId, now);
      if (!row.changes) throw new AppError("任务已更新，请刷新后查看。", { status: 409 });
    },
    resumable(id: string) {
      return !!db.prepare(`SELECT 1 FROM localmate_agent_tasks candidate
        WHERE mission_id = ? AND (status = 'queued' OR (status = 'running' AND lease_until <= ?))
        AND NOT EXISTS (SELECT 1 FROM localmate_agent_tasks active WHERE active.mission_id = candidate.mission_id
          AND active.agent = candidate.agent AND active.status = 'running' AND active.lease_until > ?) LIMIT 1`).get(id, nowIso(), nowIso());
    },
  };
}
