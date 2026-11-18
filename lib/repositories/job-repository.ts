import type { AppDatabase } from "@/lib/db/client";
import { nowIso, parseJson, uid } from "@/lib/db/client";
import type { Country, ResearchJob, ResearchJobEvent } from "@/types/domain";

function mapJob(row: Record<string, unknown>): ResearchJob {
  return {
    id: String(row.id),
    productId: String(row.product_id),
    status: String(row.status) as ResearchJob["status"],
    countries: parseJson<Country[]>(row.countries_json, []),
    progress: Number(row.progress ?? 0),
    currentStage: row.current_stage ? String(row.current_stage) : null,
    error: row.error ? String(row.error) : null,
    attempts: Number(row.attempts ?? 1),
    createdAt: String(row.created_at),
    startedAt: row.started_at ? String(row.started_at) : null,
    finishedAt: row.finished_at ? String(row.finished_at) : null,
  };
}

function mapEvent(row: Record<string, unknown>): ResearchJobEvent {
  return {
    id: String(row.id),
    jobId: String(row.job_id),
    country: row.country ? (String(row.country) as Country) : null,
    level: String(row.level) as ResearchJobEvent["level"],
    phase: String(row.phase),
    message: String(row.message),
    meta: row.meta_json ? parseJson<Record<string, unknown>>(row.meta_json, {}) : undefined,
    createdAt: String(row.created_at),
  };
}

export interface JobUpdate {
  status?: ResearchJob["status"];
  progress?: number;
  currentStage?: string | null;
  error?: string | null;
  attempts?: number;
  startedAt?: string | null;
  finishedAt?: string | null;
}

export interface JobRepository {
  create(productId: string, countries: Country[]): ResearchJob;
  nextPending(): ResearchJob | null;
  claim(id: string): ResearchJob | null;
  getById(id: string): ResearchJob | null;
  getLatestByProduct(productId: string): ResearchJob | null;
  listByProduct(productId: string, limit?: number): ResearchJob[];
  update(id: string, patch: JobUpdate): ResearchJob | null;
  addEvent(event: {
    jobId: string;
    country?: Country | null;
    level: ResearchJobEvent["level"];
    phase: string;
    message: string;
    meta?: Record<string, unknown>;
  }): ResearchJobEvent;
  listEvents(jobId: string, after?: string): ResearchJobEvent[];
}

export function createJobRepository(db: AppDatabase): JobRepository {
  return {
    create(productId, countries) {
      const id = uid("job");
      const createdAt = nowIso();
      db.prepare(
        `INSERT INTO research_jobs (id, product_id, status, countries_json, progress, current_stage, error, attempts, created_at)
         VALUES (?, ?, 'PENDING', ?, 0, 'Queued', NULL, 1, ?)`,
      ).run(id, productId, JSON.stringify(countries), createdAt);
      const job = this.getById(id);
      if (!job) throw new Error("Failed to create research job.");
      return job;
    },

    nextPending() {
      const row = db.prepare("SELECT * FROM research_jobs WHERE status = 'PENDING' ORDER BY created_at, rowid LIMIT 1").get();
      return row ? mapJob(row) : null;
    },

    claim(id) {
      const row = db.prepare(`UPDATE research_jobs SET status = 'RUNNING', started_at = ?, current_stage = '开始研究'
        WHERE id = ? AND status = 'PENDING' RETURNING *`).get(nowIso(), id);
      return row ? mapJob(row) : null;
    },

    getById(id) {
      const row = db.prepare("SELECT * FROM research_jobs WHERE id = ?").get(id) as
        | Record<string, unknown>
        | undefined;
      return row ? mapJob(row) : null;
    },

    getLatestByProduct(productId) {
      const row = db
        .prepare("SELECT * FROM research_jobs WHERE product_id = ? ORDER BY created_at DESC LIMIT 1")
        .get(productId) as Record<string, unknown> | undefined;
      return row ? mapJob(row) : null;
    },

    listByProduct(productId, limit = 10) {
      const rows = db
        .prepare("SELECT * FROM research_jobs WHERE product_id = ? ORDER BY created_at DESC LIMIT ?")
        .all(productId, limit) as Array<Record<string, unknown>>;
      return rows.map(mapJob);
    },

    update(id, patch) {
      const existing = this.getById(id);
      if (!existing) return null;
      const next = { ...existing, ...patch };
      db.prepare(
        `UPDATE research_jobs SET status = ?, progress = ?, current_stage = ?, error = ?,
          attempts = ?, started_at = ?, finished_at = ? WHERE id = ?`,
      ).run(
        next.status,
        next.progress,
        next.currentStage ?? null,
        next.error ?? null,
        next.attempts,
        next.startedAt ?? null,
        next.finishedAt ?? null,
        id,
      );
      return this.getById(id);
    },

    addEvent(event) {
      const id = uid("evt");
      const createdAt = nowIso();
      db.prepare(
        `INSERT INTO job_events (id, job_id, country, level, phase, message, meta_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        event.jobId,
        event.country ?? null,
        event.level,
        event.phase,
        event.message,
        event.meta ? JSON.stringify(event.meta) : null,
        createdAt,
      );
      return {
        id,
        jobId: event.jobId,
        country: event.country ?? null,
        level: event.level,
        phase: event.phase,
        message: event.message,
        meta: event.meta,
        createdAt,
      };
    },

    listEvents(jobId, after) {
      const rows = after
        ? (db
            .prepare("SELECT * FROM job_events WHERE job_id = ? AND created_at > ? ORDER BY created_at ASC")
            .all(jobId, after) as Array<Record<string, unknown>>)
        : (db
            .prepare("SELECT * FROM job_events WHERE job_id = ? ORDER BY created_at ASC")
            .all(jobId) as Array<Record<string, unknown>>);
      return rows.map(mapEvent);
    },
  };
}