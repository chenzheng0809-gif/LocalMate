import type { AppDatabase } from "@/lib/db/client";
import { nowIso, parseJson, uid } from "@/lib/db/client";
import type { SimulationResult } from "@/types/domain";

export interface SimulationRepository {
  create(simulation: Omit<SimulationResult, "id" | "createdAt"> & { id?: string }): SimulationResult;
  get(id: string): SimulationResult | null;
  listByProduct(productId: string, limit?: number): SimulationResult[];
  getLatest(productId: string): SimulationResult | null;
}

export function createSimulationRepository(db: AppDatabase): SimulationRepository {
  return {
    create(simulation) {
      const id = simulation.id ?? uid("sim");
      const createdAt = nowIso();
      db.prepare(
        `INSERT INTO simulations (id, product_id, label, overrides_json, impacts_json, before_json, after_json, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        id,
        simulation.productId,
        simulation.label,
        JSON.stringify(simulation.overrides),
        JSON.stringify(simulation.impacts),
        JSON.stringify(simulation.before),
        JSON.stringify(simulation.after),
        createdAt,
      );
      return { ...simulation, id, createdAt };
    },

    get(id) {
      const row = db.prepare("SELECT * FROM simulations WHERE id = ?").get(id) as
        | Record<string, unknown>
        | undefined;
      if (!row) return null;
      return {
        id: String(row.id),
        productId: String(row.product_id),
        label: String(row.label),
        overrides: parseJson(row.overrides_json, {}),
        impacts: parseJson(row.impacts_json, []),
        before: parseJson(row.before_json, {} as SimulationResult["before"]),
        after: parseJson(row.after_json, {} as SimulationResult["after"]),
        createdAt: String(row.created_at),
      };
    },

    listByProduct(productId, limit = 20) {
      const rows = db
        .prepare("SELECT * FROM simulations WHERE product_id = ? ORDER BY created_at DESC LIMIT ?")
        .all(productId, limit) as Array<Record<string, unknown>>;
      return rows.map((row) => ({
        id: String(row.id),
        productId: String(row.product_id),
        label: String(row.label),
        overrides: parseJson(row.overrides_json, {}),
        impacts: parseJson(row.impacts_json, []),
        before: parseJson(row.before_json, {} as SimulationResult["before"]),
        after: parseJson(row.after_json, {} as SimulationResult["after"]),
        createdAt: String(row.created_at),
      }));
    },

    getLatest(productId) {
      const row = db
        .prepare("SELECT id FROM simulations WHERE product_id = ? ORDER BY created_at DESC LIMIT 1")
        .get(productId) as { id: string } | undefined;
      return row ? this.get(row.id) : null;
    },
  };
}