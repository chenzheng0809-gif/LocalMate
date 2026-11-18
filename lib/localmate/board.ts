import { createHash } from "node:crypto";
import { type AppDatabase, nowIso, uid } from "@/lib/db/client";
import { AppError } from "@/lib/errors";
import type { ProductRepository } from "@/lib/repositories/product-repository";
import type { EvidenceRepository } from "@/lib/repositories/evidence-repository";
import type { ResearchRepository } from "@/lib/repositories/research-repository";
import type { ComplianceRepository } from "@/lib/repositories/compliance-repository";
import type { createMissionRepository } from "./repository";
import type { ShopifyRecord } from "./shopify";
import { launchGate, listingLocales, localizedListingStarter, type ListingDraft } from "./launch";
import type { Benchmark, createBenchmarkRepository } from "./benchmarks";
import type { CompliancePrecheck } from "./compliance-kb";
import { currentGbPrecheck } from "./team-model";
import { marketSamples } from "./market-samples";
import { legacyCountry, marketCodes } from "./mission-model";

type BoardInputs = {
  benchmarks: ReturnType<typeof createBenchmarkRepository>;
  observations: ReturnType<typeof import("./observations").createObservationRepository>;
  team: ReturnType<typeof import("./team-repository").createTeamRepository>;
  missions: ReturnType<typeof createMissionRepository>;
  products: ProductRepository;
  research: ResearchRepository;
  evidence: EvidenceRepository;
  compliance: ComplianceRepository;
};
type Specialist = "Scout" | "Margin" | "Guard" | "Localizer";
type WorkItem = { owner: Specialist; title: string };
type BoardEvidence = { id: string; title: string; url: string; observedAt: string; verification: string; excerpt: string; category?: string; applicability?: string };
type Snapshot = {
  budgetMinor?: number;
  localizationTaskId?: string;
  productId: string;
  productName: string;
  productUpdatedAt: string;
  market: string;
  cost: { version: number; contributionMinor: number; source: string; currency?: string; contributionCnyMinor?: number } | null;
  pilotGate?: ReturnType<typeof launchGate>;
  evidence: BoardEvidence[];
  guardFindings: string[];
  benchmark?: Benchmark;
  benchmarkCostCurrent?: boolean;
  compliancePrecheck?: CompliancePrecheck;
  tasks: WorkItem[];
};
export type Proposal = {
  id: string; missionId: string; version: number; hash: string; createdAt: string; snapshot: Snapshot;
};
export type WorkTask = WorkItem & { id: string; status: "open" | "done" };
export type Approval = {
  id: string; proposalId: string; createdAt: string; scope: "internal_preparation"; tasks: WorkTask[]; draft?: ListingDraft; shopify?: ShopifyRecord;
};

function proposalFromRow(row: Record<string, unknown>): Proposal {
  return {
    id: String(row.id), missionId: String(row.mission_id), version: Number(row.version),
    hash: String(row.hash), createdAt: String(row.created_at), snapshot: JSON.parse(String(row.snapshot_json)),
  };
}

function httpSource(source: string | null): source is string {
  try {
    const url = new URL(source ?? "");
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

export function createBoardRepository(db: AppDatabase, inputs: BoardInputs) {
  function currentSnapshot(missionId: string, market: string): Snapshot {
    const mission = inputs.missions.get(missionId);
    if (!mission) throw new AppError("未找到项目。", { status: 404 });
    if (!marketCodes.includes(market) || (mission.markets.length && !mission.markets.includes(market))) {
      throw new AppError("请选择项目范围内的市场。", { status: 422 });
    }
    const product = mission.productId ? inputs.products.getById(mission.productId) : null;
    if (!product?.confirmed || product.mode !== "LIVE") throw new AppError("请先关联实际商品并确认资料。", { status: 409 });
    const benchmark = inputs.benchmarks.get(missionId, market, product.id);
    const cost = inputs.missions.costs(missionId).find(item => item.market === market);
    const country = legacyCountry(market);
    const research = country ? inputs.research.get(product.id, country) : null;
    const evidence: BoardEvidence[] = research && research.dataMode !== "DEMO"
      ? inputs.evidence.getByIds(research.evidenceIds)
        .filter(row => row.country === country && row.kind === "MARKET" && row.productId === product.id
          && row.origin !== "MODEL_INFERENCE" && httpSource(row.sourceUrl))
        .sort((a, b) => a.id.localeCompare(b.id)).slice(0, 20)
        .map(row => ({ id: row.id, title: row.sourceTitle, url: row.sourceUrl!, observedAt: row.retrievedAt, verification: row.verificationStatus, excerpt: row.relevantExcerpt }))
      : [];
    evidence.push(...marketSamples(product.name, market));
    evidence.push(...inputs.observations.list(missionId).filter(item =>
      item.market === market && item.productId === product.id
    ).map(item => ({ ...item, verification: "UNVERIFIED", category: "用户采集",
      applicability: "来源与可比性待复核" })));
    const tasks = inputs.team.list(missionId);
    const marketTask = tasks.find(task => task.agent === "Scout" && task.result?.evidence?.some(item => item.market === market));
    // Manual entries are included directly above; historical task copies cannot restore deleted entries.
    const knownUrls = new Set(evidence.map(item => item.url));
    for (const item of (marketTask?.result?.evidence ?? []).filter(item => item.market === market).slice(0, 12)) {
      if (item.origin !== "USER_INPUT" && !knownUrls.has(item.url) && httpSource(item.url)) {
        evidence.push({ id: `${marketTask!.id}:${evidence.length}`, title: item.title, url: item.url,
          observedAt: marketTask!.updatedAt, verification: "UNVERIFIED", excerpt: item.note ?? "" });
        knownUrls.add(item.url);
      }
    }
    const localization = tasks.find(task => task.agent === "Localizer" && task.status === "completed" && task.markets.includes(market));
    const compliance = country ? inputs.compliance.get(product.id, country) : null;
    const knownCheck = compliance && compliance.dataMode !== "DEMO" ? compliance : null;
    const compliancePrecheck = market === "GB" ? currentGbPrecheck(tasks, product) : undefined;
    const guardFindings = [...product.missingFields, ...(knownCheck?.missingAttributes ?? [])];
    if (knownCheck) guardFindings.push(knownCheck.statusReason);
    if (compliancePrecheck) {
      guardFindings.push(`Amazon UK 知识库 · ${compliancePrecheck.answer} · 需专业复核`);
    } else if (!knownCheck) guardFindings.push("暂无当前市场的准入核查记录");
    const uniqueFindings = Array.from(new Set(guardFindings)).sort();

    const benchmarkCostCurrent = cost?.benchmark?.url === benchmark?.url && cost?.benchmark?.selectedAt === benchmark?.selectedAt;
    const pilotGate = launchGate({
      market, contribution: benchmarkCostCurrent ? cost?.contributionMinor ?? null : null,
      lowContribution: benchmarkCostCurrent ? cost?.valuation.lowContributionMinor ?? null : null,
      sourceCount: evidence.filter(row => row.verification === "VERIFIED" || row.verification === "PARTIALLY_VERIFIED").length,
      complianceStatus: knownCheck?.status ?? null,
      missing: [...product.missingFields, ...(knownCheck?.missingAttributes ?? [])],
    });
    const budgetMinor = inputs.team.budget(missionId);
    return {
      ...(budgetMinor === null ? {} : { budgetMinor }),
      ...(benchmark ? { benchmark, benchmarkCostCurrent } : cost?.benchmark ? { benchmarkCostCurrent } : {}),
      ...(localization ? { localizationTaskId: localization.id } : {}),
      pilotGate, productId: product.id, productName: product.name, productUpdatedAt: product.updatedAt, market,
      cost: cost ? { version: cost.version, contributionMinor: cost.contributionMinor, source: cost.source, currency: cost.currency, contributionCnyMinor: cost.valuation.contributionCnyMinor } : null,
      ...(compliancePrecheck ? { compliancePrecheck } : {}),
      evidence, guardFindings: uniqueFindings,
      tasks: [
        { owner: "Scout", title: evidence.length ? "回查样本口径、时效和商品可比性" : "采集同市场可追溯的需求与竞品样本" },
        { owner: "Margin", title: !cost ? "补齐同市场报价与单件成本" : cost.contributionMinor < 0 ? "复核亏损项并调整成本或售价情景" : "用正式报价复核当前成本与利润假设" },
        { owner: "Guard", title: "核验准入、标签及商品宣称，补齐缺失资料" },
        { owner: "Localizer", title: "核对当地用语和可支持的卖点，整理文案要求" },
      ],
    };
  }

  const fingerprint = (snapshot: Snapshot) => createHash("sha256").update(JSON.stringify(snapshot)).digest("hex");
  const latest = (missionId: string, market: string) => db.prepare(
    "SELECT * FROM localmate_proposals WHERE mission_id = ? AND market = ? ORDER BY version DESC LIMIT 1",
  ).get(missionId, market);

  function transaction<T>(execute: () => T) {
    db.exec("BEGIN IMMEDIATE");
    try {
      const result = execute();
      db.exec("COMMIT");
      return result;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  function mapDraft(row: Record<string, unknown>): ListingDraft {
    return {
      id: String(row.id), handle: String(row.approval_id).replaceAll("_", "-"), version: Number(row.version),
      title: String(row.title), description: String(row.description), at: String(row.created_at),
    };
  }

  function draftForApproval(approvalId: string) {
    const row = db.prepare("SELECT * FROM localmate_listing_drafts WHERE approval_id = ? ORDER BY version DESC LIMIT 1").get(approvalId);
    return row ? mapDraft(row) : undefined;
  }

  function shopifyRecord(draftId?: string): ShopifyRecord | undefined {
    if (!draftId) return;
    const row = db.prepare("SELECT shop, remote_id, state FROM localmate_shopify_drafts WHERE draft_id = ?").get(draftId);
    return row ? { shop: String(row.shop), remoteId: row.remote_id ? String(row.remote_id) : null,
      state: row.state as ShopifyRecord["state"] } : undefined;
  }

  function approvals(missionId: string): Approval[] {
    return db.prepare(`SELECT a.* FROM localmate_approvals a JOIN localmate_proposals p ON p.id = a.proposal_id
      WHERE p.mission_id = ? ORDER BY a.created_at DESC`).all(missionId).map(row => {
      const id = String(row.id);
      const draft = draftForApproval(id);
      const tasks = db.prepare("SELECT * FROM localmate_work_items WHERE approval_id = ? ORDER BY ordinal").all(id)
        .map(task => ({ id: String(task.id), owner: task.owner as Specialist, title: String(task.title), status: task.status as WorkTask["status"] }));
      return { id, proposalId: String(row.proposal_id), scope: "internal_preparation", createdAt: String(row.created_at),
        draft, shopify: shopifyRecord(draft?.id), tasks };
    });
  }

  function approvedProposal(missionId: string, approvalId: string) {
    const row = db.prepare(`SELECT p.* FROM localmate_proposals p JOIN localmate_approvals a ON a.proposal_id = p.id
      WHERE p.mission_id = ? AND a.id = ?`).get(missionId, approvalId);
    if (!row) throw new AppError("请先授权该项目对应的准备方案。", { status: 404 });
    return proposalFromRow(row);
  }

  return {
    list(missionId: string) {
      return db.prepare("SELECT * FROM localmate_proposals WHERE mission_id = ? ORDER BY created_at DESC, version DESC").all(missionId).map(proposalFromRow);
    },
    approvals,
    isCurrent(proposal: Proposal) {
      try {
        return latest(proposal.missionId, proposal.snapshot.market)?.id === proposal.id &&
          fingerprint(currentSnapshot(proposal.missionId, proposal.snapshot.market)) === proposal.hash;
      } catch (error) {
        if (error instanceof AppError) return false;
        throw error;
      }
    },
    generate(missionId: string, market: string): Proposal {
      return transaction(() => {
        const snapshot = currentSnapshot(missionId, market);
        const hash = fingerprint(snapshot);
        const previous = latest(missionId, market);
        if (previous?.hash === hash) return proposalFromRow(previous);
        const id = uid("proposal");
        const version = previous ? Number(previous.version) + 1 : 1;
        const createdAt = nowIso();
        db.prepare("INSERT INTO localmate_proposals VALUES (?, ?, ?, ?, ?, ?, ?)")
          .run(id, missionId, market, version, hash, JSON.stringify(snapshot), createdAt);
        return {id, missionId, version, hash, createdAt, snapshot};
      });
    },
    approve(missionId: string, proposalId: string, hash: string): Approval {
      return transaction(() => {
        const row = db.prepare("SELECT * FROM localmate_proposals WHERE mission_id = ? AND id = ?").get(missionId, proposalId);
        if (!row) throw new AppError("未找到该项目的方案。", { status: 404 });
        const proposal = proposalFromRow(row);
        if (proposal.hash !== hash) throw new AppError("方案版本不匹配。", { status: 409 });
        const prior = approvals(missionId).find(item => item.proposalId === proposalId);
        if (prior) return prior;
        if (latest(missionId, proposal.snapshot.market)?.id !== proposalId
          || fingerprint(currentSnapshot(missionId, proposal.snapshot.market)) !== hash) {
          throw new AppError("输入已更新，请生成方案新版本后再授权。", { status: 409 });
        }
        const id = uid("approval");
        const createdAt = nowIso();
        db.prepare("INSERT INTO localmate_approvals VALUES (?, ?, 'internal_preparation', ?)")
          .run(id, proposalId, createdAt);
        const tasks = proposal.snapshot.tasks.map((item, index): WorkTask => {
          const task = { ...item, id: uid("task"), status: "open" as const };
          db.prepare("INSERT INTO localmate_work_items VALUES (?, ?, ?, ?, ?, 'open')")
            .run(task.id, id, index, task.owner, task.title);
          return task;
        });
        return { id, proposalId, createdAt, scope: "internal_preparation", tasks };
      });
    },
    pilotReview(missionId: string, approvalId: string) {
      const proposal = approvedProposal(missionId, approvalId);
      const approval = approvals(missionId).find(item => item.id === approvalId)!;
      return { proposal, approval, current: this.isCurrent(proposal) };
    },
    startDraft(missionId: string, approvalId: string) {
      const proposal = approvedProposal(missionId, approvalId);
      if (!this.isCurrent(proposal)) throw new AppError("方案已失效，请更新方案并重新授权。", { status: 409 });
      const previous = draftForApproval(approvalId);
      if (previous) return previous;
      const product = inputs.products.getById(proposal.snapshot.productId);
      const copy = product && localizedListingStarter(product, proposal.snapshot.market);
      if (!copy) throw new AppError("首稿支持已确认的英国和墨西哥家居收纳商品。", { status: 422 });
      return this.saveDraft(missionId, approvalId, copy.title, copy.description);
    },
    saveDraft(missionId: string, approvalId: string, title: string, description: string): ListingDraft {
      return transaction(() => {
        const proposal = approvedProposal(missionId, approvalId);
        if (!listingLocales[proposal.snapshot.market]) throw new AppError("上架草稿支持英国和墨西哥。", { status: 422 });
        if (!this.isCurrent(proposal)) {
          throw new AppError("方案已失效，请更新方案并重新授权。", { status: 409 });
        }
        const previous = draftForApproval(approvalId);
        if (previous?.title === title && previous.description === description) return previous;
        const id = uid("draft");
        const version = (previous?.version ?? 0) + 1;
        const at = nowIso();
        db.prepare("INSERT INTO localmate_listing_drafts VALUES (?, ?, ?, ?, ?, ?)").run(id, approvalId, version, title, description, at);
        return { id, handle: approvalId.replaceAll("_", "-"), version, title, description, at };
      });
    },
    reserveShopify(missionId: string, draftId: string, shop: string, allowWrite: boolean) {
      return transaction(() => {
        const row = db.prepare(`SELECT p.*, d.approval_id FROM localmate_listing_drafts d
          JOIN localmate_approvals a ON a.id = d.approval_id JOIN localmate_proposals p ON p.id = a.proposal_id
          WHERE d.id = ? AND p.mission_id = ?`).get(draftId, missionId);
        if (!row) throw new AppError("未找到该项目的草稿。", { status: 404 });
        const prior = shopifyRecord(draftId);
        if (prior) {
          if (prior.shop !== shop) throw new AppError("草稿已绑定另一家测试店。", { status: 409 });
          return { write: false, record: prior };
        }
        if (!allowWrite) throw new AppError("此版本暂无 Shopify 写入记录。", { status: 409 });
        const proposal = proposalFromRow(row);
        const market = proposal.snapshot.market;
        const snapshot = currentSnapshot(missionId, market);
        if (market !== "MX" || snapshot.pilotGate?.status === "BLOCKED" || snapshot.benchmarkCostCurrent === false || fingerprint(snapshot) !== proposal.hash
          || latest(missionId, market)?.id !== proposal.id || draftForApproval(String(row.approval_id))?.id !== draftId) {
          throw new AppError("草稿版本已过期或试点被阻断。", { status: 409 });
        }
        db.prepare("INSERT INTO localmate_shopify_drafts VALUES (?, ?, 'requested', NULL, ?, NULL)").run(draftId, shop, nowIso());
        return { write: true, record: shopifyRecord(draftId)! };
      });
    },
    verifyShopify(draftId: string, shop: string, remoteId: string) {
      db.prepare("UPDATE localmate_shopify_drafts SET state = 'verified', remote_id = ?, checked_at = ? WHERE draft_id = ? AND shop = ?")
        .run(remoteId, nowIso(), draftId, shop);
      return shopifyRecord(draftId);
    },
    draft(missionId: string, draftId: string): ListingDraft | null {
      const row = db.prepare(`SELECT d.* FROM localmate_listing_drafts d
        JOIN localmate_approvals a ON a.id = d.approval_id JOIN localmate_proposals p ON p.id = a.proposal_id
        WHERE d.id = ? AND p.mission_id = ?`).get(draftId, missionId);
      return row ? mapDraft(row) : null;
    },
    complete(missionId: string, taskId: string) {
      const result = db.prepare(`UPDATE localmate_work_items SET status = 'done' WHERE id = ? AND approval_id IN (
        SELECT a.id FROM localmate_approvals a JOIN localmate_proposals p ON p.id = a.proposal_id WHERE p.mission_id = ?
      )`).run(taskId, missionId);
      if (!result.changes) throw new AppError("未找到该项目的执行任务。", { status: 404 });
    },
  };
}
