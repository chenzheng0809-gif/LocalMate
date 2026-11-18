import { createHash } from "node:crypto";
import { type AppDatabase, nowIso, uid } from "@/lib/db/client";
import { AppError } from "@/lib/errors";
import { calculateCost, type CostCheck, type CostValuation, type CreateMission, type Mission, type MissionCommand, type ProjectPlan } from "./mission-model";

type MissionRow = {
  id: string; direction: Mission["direction"]; goal: string; markets_json: string;
  product_id: string | null; status: Mission["status"]; revision: number;
  created_at: string; updated_at: string; request_fingerprint: string;
};

function fromRow(row: MissionRow): Mission {
  return {
    id: row.id, direction: row.direction, goal: row.goal, markets: JSON.parse(row.markets_json),
    productId: row.product_id, status: row.status, revision: row.revision,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export function createMissionRepository(db: AppDatabase) {
  function transaction<T>(run: () => T): T {
    db.exec("BEGIN IMMEDIATE");
    try {
      const value = run();
      db.exec("COMMIT");
      return value;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  function get(id: string): Mission | null {
    const row = db.prepare("SELECT * FROM localmate_missions WHERE id = ?").get(id) as MissionRow | undefined;
    return row ? fromRow(row) : null;
  }

  function requireProduct(id: string) {
    const row = db.prepare("SELECT mode FROM products WHERE id = ?").get(id);
    if (!row) throw new AppError("未找到商品。", { status: 404, code: "PRODUCT_NOT_FOUND" });
    if (row.mode === "DEMO") {
      throw new AppError("请选择已实际导入或手工录入的商品。", { status: 422, code: "DEMO_PRODUCT" });
    }
  }

  function requireRevision(id: string, revision: number) {
    const mission = get(id);
    if (!mission) throw new AppError("未找到项目。", { status: 404, code: "MISSION_NOT_FOUND" });
    if (mission.revision !== revision) throw new AppError("项目已更新，请刷新后重试。", { status: 409, code: "STALE_REVISION" });
    return mission;
  }

  function updateRevision(id: string) {
    db.prepare("UPDATE localmate_missions SET revision = revision + 1, updated_at = ? WHERE id = ?").run(nowIso(), id);
    return get(id)!;
  }

  return {
    get,
    list() {
      const rows = db.prepare("SELECT * FROM localmate_missions ORDER BY updated_at DESC, id DESC").all() as MissionRow[];
      return rows.map(fromRow);
    },
    byRequest(requestId: string) {
      const row = db.prepare("SELECT * FROM localmate_missions WHERE request_id = ?").get(requestId) as MissionRow | undefined;
      return row ? fromRow(row) : null;
    },
    create(input: CreateMission, onCreate?: (mission: Mission) => void): Mission {
      const productId = input.direction === "product_to_market" ? input.productId : null;
      const markets = input.direction === "product_to_market" ? input.markets : input.markets ?? (input.market ? [input.market] : []);
      const fingerprint = createHash("sha256").update(JSON.stringify([input.direction, input.goal, productId, markets])).digest("hex");
      return transaction(() => {
        const prior = db.prepare("SELECT * FROM localmate_missions WHERE request_id = ?").get(input.requestId) as MissionRow | undefined;
        if (prior) {
          if (prior.request_fingerprint !== fingerprint) throw new AppError("创建请求已用于另一个项目。", { status: 409, code: "REQUEST_CONFLICT" });
          const mission = fromRow(prior);
          onCreate?.(mission);
          return mission;
        }
        if (productId) requireProduct(productId);
        const id = uid("mission");
        const at = nowIso();
        db.prepare(`INSERT INTO localmate_missions
          (id, request_id, request_fingerprint, direction, product_id, markets_json, goal, status, created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
          .run(id, input.requestId, fingerprint, input.direction, productId, JSON.stringify(markets), input.goal, productId ? "research_ready" : "awaiting_product", at, at);
        const mission = get(id)!;
        onCreate?.(mission);
        return mission;
      });
    },
    plan(id: string): ProjectPlan | null {
      const row = db.prepare("SELECT sourcing, procurement_limit FROM localmate_project_plans WHERE mission_id = ?").get(id);
      return row ? { sourcing: String(row.sourcing), procurementLimit: row.procurement_limit === null ? null : Number(row.procurement_limit) } : null;
    },
    requireImportable(id: string, revision: number, updateExisting: boolean, existingUpdatedAt?: string) {
      const mission = requireRevision(id, revision);
      const current = mission.productId && db.prepare("SELECT confirmed, updated_at FROM products WHERE id = ?").get(mission.productId);
      if (current && ((!updateExisting && current.confirmed) || (existingUpdatedAt !== undefined && current.updated_at !== existingUpdatedAt))) {
        throw new AppError("项目商品已确认或更新。请刷新并保留现有记录。", { status: 409 });
      }
      if (updateExisting) {
        if (!current || db.prepare("SELECT 1 FROM localmate_missions WHERE product_id = ? AND id <> ?").get(mission.productId, id)) {
          throw new AppError("商品未关联或由多个项目共用，请在独立项目导入链接。", { status: 409 });
        }
      } else if (db.prepare("SELECT 1 FROM localmate_cost_checks WHERE mission_id = ? UNION ALL SELECT 1 FROM localmate_proposals WHERE mission_id = ? LIMIT 1").get(id, id)) {
        throw new AppError("此项目已有成本或方案记录，请在新项目导入另一商品。", { status: 409 });
      }
      return current ? String(current.updated_at) : undefined;
    },
    importProduct(id: string, revision: number, updateExisting: boolean, existingUpdatedAt: string | undefined, saveProduct: () => string) {
      return transaction(() => {
        this.requireImportable(id, revision, updateExisting, existingUpdatedAt);
        const productId = saveProduct();
        requireProduct(productId);
        db.prepare("UPDATE localmate_missions SET product_id = ?, status = 'research_ready' WHERE id = ?").run(productId, id);
        return updateRevision(id);
      });
    },
    createCandidate(id: string, revision: number, createProduct: () => string): Mission {
      return transaction(() => {
        const mission = requireRevision(id, revision);
        if (mission.direction !== "market_to_product" || mission.productId || !mission.markets.length) {
          throw new AppError("请先确定选品市场。已有候选请直接编辑商品资料。", { status: 409 });
        }
        const productId = createProduct();
        requireProduct(productId);
        db.prepare("UPDATE localmate_missions SET product_id = ?, status = 'research_ready' WHERE id = ?").run(productId, id);
        return updateRevision(id);
      });
    },
    command(id: string, command: MissionCommand, onUpdate?: (mission: Mission) => void): Mission {
      return transaction(() => {
        const mission = requireRevision(id, command.revision);
        const at = nowIso();
        if (command.type === "attach_product") {
          if (mission.status !== "awaiting_product") throw new AppError("该项目已有商品。", { status: 409, code: "PRODUCT_ALREADY_ATTACHED" });
          requireProduct(command.productId);
          db.prepare("UPDATE localmate_missions SET product_id = ?, status = 'research_ready' WHERE id = ?").run(command.productId, id);
        } else if (command.type === "save_plan") {
          if (mission.direction === "market_to_product" && command.markets.length !== 1) {
            throw new AppError("请为选品项目选择一个目标市场。", { status: 422 });
          }
          const product = mission.productId && db.prepare("SELECT confirmed FROM products WHERE id = ?").get(mission.productId);
          if (mission.direction === "product_to_market" && (!product || !product.confirmed)) {
            throw new AppError("请先确认商品资料。", { status: 422 });
          }
          db.prepare("UPDATE localmate_missions SET markets_json = ? WHERE id = ?").run(JSON.stringify(command.markets), id);
          db.prepare(`INSERT INTO localmate_project_plans (mission_id, sourcing, procurement_limit) VALUES (?, ?, ?)
            ON CONFLICT(mission_id) DO UPDATE SET sourcing = excluded.sourcing, procurement_limit = excluded.procurement_limit`)
            .run(id, command.sourcing, command.procurementLimit);
        } else {
          if (!mission.productId || (mission.markets.length && !mission.markets.includes(command.market))) {
            throw new AppError("请先关联商品并选择项目范围内的市场。", { status: 422, code: "COST_SCOPE" });
          }
          let result;
          try {
            result = calculateCost(command);
          } catch (error) {
            throw new AppError(error instanceof Error ? error.message : "成本口径无效。", { status: 422, code: "COST_VALUATION" });
          }
          const benchmark = db.prepare(`SELECT snapshot_json FROM localmate_benchmarks
            WHERE mission_id = ? AND market = ? AND product_id = ?`).get(id, command.market, mission.productId);
          const selected = benchmark ? JSON.parse(String(benchmark.snapshot_json)) : null;
          const reference = selected ? { url: selected.url, selectedAt: selected.selectedAt } : undefined;
          db.prepare("INSERT INTO localmate_cost_checks VALUES (?, ?, ?, ?, ?, ?, ?)")
            .run(id, mission.revision + 1, command.market, JSON.stringify({ ...result.inputMinor, valuation: result.valuation, benchmark: reference }), result.contributionMinor, command.source, at);
        }
        const updated = updateRevision(id);
        onUpdate?.(updated);
        return updated;
      });
    },
    costs(id: string): CostCheck[] {
      return db.prepare("SELECT * FROM localmate_cost_checks WHERE mission_id = ? ORDER BY version DESC").all(id).map(row => {
        const contributionMinor = Number(row.contribution_minor);
        const { valuation, benchmark, ...inputMinor } = JSON.parse(String(row.input_json)) as CostCheck["inputMinor"] & { valuation?: CostValuation; benchmark?: CostCheck["benchmark"] };
        return {
          missionId: id, version: Number(row.version), market: String(row.market), currency: valuation?.currency ?? "CNY",
          inputMinor, contributionMinor, ...(benchmark ? { benchmark } : {}), source: String(row.source), createdAt: String(row.created_at),
          valuation: valuation ?? { currency: "CNY", contributionCnyMinor: contributionMinor, lowContributionMinor: null,
            highContributionMinor: null, fxToCny: null, fxAt: null, fxSource: null },
        };
      });
    },
  };
}
