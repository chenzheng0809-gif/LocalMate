import { z } from "zod";
import { nowIso, uid, type AppDatabase } from "@/lib/db/client";
import { AppError } from "@/lib/errors";
import { sanitizeSourceUrl } from "@/lib/search/source-validator";
import { marketCodes } from "./mission-model";

export const observationInput = z.object({
  market: z.string().refine(code => marketCodes.includes(code)),
  url: z.string().trim().max(2048),
  title: z.string().trim().min(2).max(200),
  observedAt: z.string().date(),
  excerpt: z.string().trim().min(3).max(1200),
}).strict();

type ObservationInput = z.infer<typeof observationInput>;
export type Observation = ObservationInput & { id: string; productId: string | null };

const shape = (row: Record<string, unknown>): Observation => ({
  id: String(row.id), market: String(row.market), productId: row.product_id === null ? null : String(row.product_id),
  url: String(row.url), title: String(row.title), observedAt: String(row.observed_at), excerpt: String(row.excerpt),
});

export function createObservationRepository(db: AppDatabase) {
  return {
    list(missionId: string) {
      return db.prepare(`SELECT * FROM localmate_observations WHERE mission_id = ?
        ORDER BY observed_at DESC, id`).all(missionId).map(shape);
    },
    save(missionId: string, input: ObservationInput) {
      const url = sanitizeSourceUrl(input.url);
      if (!url) throw new AppError("请填写公开网页的原始链接。", { status: 422 });
      const today = new Intl.DateTimeFormat("fr-CA", { timeZone: "Asia/Shanghai", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
      if (input.observedAt > today) throw new AppError("观察日期不能晚于今天。", { status: 422 });
      db.exec("BEGIN IMMEDIATE");
      try {
        const mission = db.prepare("SELECT product_id, markets_json FROM localmate_missions WHERE id = ?").get(missionId);
        if (!mission) throw new AppError("未找到项目。", { status: 404 });
        if (!(JSON.parse(String(mission.markets_json)) as string[]).includes(input.market)) {
          throw new AppError("请选择项目当前的目标市场。", { status: 422 });
        }
        const productId = mission.product_id as string | null;
        const existing = db.prepare(`SELECT * FROM localmate_observations WHERE mission_id = ? AND market = ?
          AND product_id IS ? AND url = ? AND observed_at = ?`).get(missionId, input.market, productId, url, input.observedAt);
        if (!existing && Number(db.prepare("SELECT count(*) AS count FROM localmate_observations WHERE mission_id = ?").get(missionId)?.count) >= 100) {
          throw new AppError("项目已保存 100 条观察，请移除不再需要的记录。", { status: 409 });
        }
        const id = existing ? String(existing.id) : uid("obs");
        db.prepare(`INSERT INTO localmate_observations (id, mission_id, product_id, market, url, title, observed_at, excerpt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET title = excluded.title, excerpt = excluded.excerpt`)
          .run(id, missionId, productId, input.market, url, input.title, input.observedAt, input.excerpt);
        db.prepare("UPDATE localmate_missions SET updated_at = ? WHERE id = ?").run(nowIso(), missionId);
        db.exec("COMMIT");
        return { ...input, url, id, productId };
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
    remove(missionId: string, id: string) {
      db.exec("BEGIN IMMEDIATE");
      try {
        if (!db.prepare("DELETE FROM localmate_observations WHERE mission_id = ? AND id = ?").run(missionId, id).changes) {
          throw new AppError("未找到该项目下的观察记录。", { status: 404 });
        }
        const removed = db.prepare(`DELETE FROM localmate_benchmarks WHERE mission_id = ?
          AND json_extract(snapshot_json, '$.id') = ?`).run(missionId, id);
        db.prepare("UPDATE localmate_missions SET updated_at = ?, revision = revision + ? WHERE id = ?")
          .run(nowIso(), removed.changes ? 1 : 0, missionId);
        db.exec("COMMIT");
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  };
}
