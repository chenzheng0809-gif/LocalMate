import { createHash } from "node:crypto";
import { nowIso, type AppDatabase } from "@/lib/db/client";
import { AppError } from "@/lib/errors";
import type { Repositories } from "@/lib/repositories";
import { sanitizeSourceUrl } from "@/lib/search/source-validator";
import { legacyCountry, type Mission } from "./mission-model";
import { reportTasks } from "./report-view";
import { marketSamples } from "./market-samples";

export type Comparable = {
  id: string;
  title: string;
  url: string;
  image: string | null;
  price: number | null;
  currency: string | null;
  reviews: number | null;
  sales?: number;
  salesPlus?: boolean;
  rating: number | null;
  observedAt: string | null;
  source: string;
  details: string[];
};

export type Benchmark = Comparable & { market: string; selectedAt: string; notes: string };

export function comparablesFor(repos: Repositories, mission: Mission, market: string): Comparable[] {
  const product = mission.productId ? repos.products.getById(mission.productId) : null;
  const country = legacyCountry(market);
  const research = product && country ? repos.research.get(product.id, country) : null;
  const catalog: Comparable[] = research && research.dataMode !== "DEMO" ? research.competitors.map(item => ({
    id: item.sourceEvidenceId, title: item.name, url: item.url, image: item.imageUrl ?? null,
    price: item.price, currency: item.currency, reviews: item.reviewCount ?? null, rating: item.rating ?? null,
    observedAt: item.priceObservedAt ?? research.researchedAt,
    source: item.dataOrigin === "IMPORTED_LOCAL_RESEARCH" ? "导入快照" : "零售页面观察",
    details: item.keySellingPoints,
  })) : [];
  const snapshots: Comparable[] = product?.confirmed ? marketSamples(product.name, market).map(item => ({
    id: item.id, title: item.title, url: item.url, image: null,
    price: item.price, currency: item.currency, reviews: item.reviews, rating: item.rating, observedAt: item.observedAt,
    source: "导入快照", sales: item.sales, salesPlus: item.salesPlus, details: [item.positioning],
  })) : [];
  const manual: Comparable[] = repos.observations.list(mission.id)
    .filter(item => item.market === market && item.productId === (product?.id ?? null))
    .map(item => ({
      id: item.id, title: item.title, url: item.url, image: null, price: null, currency: null,
      reviews: null, rating: null, observedAt: item.observedAt, source: "用户提供 · 待核验", details: [item.excerpt],
    }));
  const cited = reportTasks(repos.team.list(mission.id)).find(task =>
    task.agent === "Scout" && task.status === "completed" && task.report?.productId === product?.id &&
    task.report?.productUpdatedAt === product?.updatedAt);
  const searchLeads: Comparable[] = (cited?.result?.evidence ?? [])
    .filter(item => item.market === market && item.origin === "OPENAI_WEB_SEARCH")
    .map(item => ({
      id: `gpt-${createHash("sha256").update(item.url).digest("hex").slice(0, 20)}`,
      title: item.title, url: item.url, image: null, price: null, currency: null, reviews: null, rating: null,
      observedAt: cited?.updatedAt ?? null, source: "GPT 联网线索", details: ["请打开商品页核对相似度、当前价格与库存。"],
    }));
  const byUrl = new Map<string, Comparable>();
  for (const item of [...catalog, ...snapshots, ...manual, ...searchLeads]) {
    const url = sanitizeSourceUrl(item.url);
    if (url && !byUrl.has(url)) byUrl.set(url, { ...item, url, image: item.image && sanitizeSourceUrl(item.image) });
  }
  return [...byUrl.values()];
}

export function createBenchmarkRepository(db: AppDatabase) {
  return {
    get(missionId: string, market: string, productId: string | null): Benchmark | null {
      const row = db.prepare("SELECT snapshot_json FROM localmate_benchmarks WHERE mission_id = ? AND market = ? AND product_id IS ?")
        .get(missionId, market, productId);
      return row ? JSON.parse(String(row.snapshot_json)) as Benchmark : null;
    },
    save(mission: Mission, market: string, comparable: Comparable, notes: string) {
      db.exec("BEGIN IMMEDIATE");
      try {
        const current = db.prepare("SELECT product_id, revision FROM localmate_missions WHERE id = ?").get(mission.id);
        if (!current || current.revision !== mission.revision || current.product_id !== mission.productId) {
          throw new AppError("项目已更新，请重新选择对标商品。", { status: 409 });
        }
        const selected = this.get(mission.id, market, mission.productId);
        const { selectedAt: previousTime, ...previous } = selected ?? {};
        const snapshot = { ...comparable, market, notes };
        const selectedAt = previousTime && JSON.stringify(previous) === JSON.stringify(snapshot) ? previousTime : nowIso();
        const benchmark = { ...snapshot, selectedAt };
        db.prepare(`INSERT INTO localmate_benchmarks (mission_id, market, product_id, snapshot_json) VALUES (?, ?, ?, ?)
          ON CONFLICT(mission_id, market) DO UPDATE SET product_id = excluded.product_id, snapshot_json = excluded.snapshot_json`)
          .run(mission.id, market, mission.productId, JSON.stringify(benchmark));
        if (selectedAt !== previousTime) db.prepare("UPDATE localmate_missions SET updated_at = ?, revision = revision + 1 WHERE id = ?")
          .run(selectedAt, mission.id);
        db.exec("COMMIT");
        return benchmark;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
  };
}
