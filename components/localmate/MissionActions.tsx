"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { calculateContribution, costAmounts, currencies, type CostCheck, type Mission } from "@/lib/localmate/mission-model";
import { listingLocales } from "@/lib/localmate/launch";
import type { Benchmark } from "@/lib/localmate/benchmarks";

type ProductOption = { id: string; name: string };
type MarketOption = { code: string; name: string };

export async function send<T>(path: string, method: string, data: unknown): Promise<T> {
  const response = await fetch(path, {
    method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok) {
    const details = Array.isArray(result.details) ? result.details.map((issue: { message: string }) => issue.message).join("，") : "";
    throw new Error(details || result.error || "保存失败，请重试。");
  }
  return result;
}

export function useOperation() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lock = useRef(false);
  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      await action();
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : "请求失败。");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  return { busy, error, run };
}

function ProductPicker({ products }: { products: ProductOption[] }) {
  return <label>商品<select name="productId" defaultValue="" required>
    <option value="" disabled>选择已导入的商品</option>
    {products.map(product => <option value={product.id} key={product.id}>{product.name}</option>)}
  </select></label>;
}

function MarketPicker({ markets, required, defaultMarket = "" }: { markets: MarketOption[]; required: boolean; defaultMarket?: string }) {
  return <label>目标市场<select name="market" defaultValue={defaultMarket} required={required}>
    <option value="" disabled={required}>{required ? "选择市场" : "稍后选择"}</option>
    {markets.map(({ code, name }) => <option key={code} value={code}>{name}</option>)}
  </select></label>;
}

export function LinkProduct({ mission, products }: { mission: Mission; products: ProductOption[] }) {
  const router = useRouter();
  const { busy, error, run } = useOperation();
  return <form className="lm-form" onSubmit={event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void run(async () => {
      await send(`/api/localmate/missions/${mission.id}`, "PATCH", {
        type: "attach_product", revision: mission.revision, productId: data.get("productId"),
      });
      router.refresh();
    });
  }}>
    {products.length > 0 && <ProductPicker products={products} />}
    <Link className="lm-link" href="/workspace/import">导入商品</Link>
    {error && <p role="alert" className="lm-error">{error}</p>}
    {products.length > 0 && <button className="lm-primary" disabled={busy}>{busy ? "关联中…" : "关联到项目"}</button>}
  </form>;
}

const costFields = [
  ["price", "成交价"], ["procurement", "采购"], ["logistics", "物流"],
  ["channelFees", "渠道费用"], ["taxes", "卖家承担税费"], ["acquisition", "获客"],
] as const;

export function QuickCost({ mission, markets, benchmark, saved, preferMxn }: {
  mission: Mission; markets: MarketOption[]; benchmark?: Benchmark | null; saved?: CostCheck; preferMxn?: boolean;
}) {
  const router = useRouter();
  const observedCurrency = currencies.find(code => code === benchmark?.currency);
  const [currency, setCurrency] = useState<string>(saved?.currency ?? observedCurrency ?? (preferMxn ? "MXN" : "CNY"));
  const [salePrice, setSalePrice] = useState(
    saved ? (saved.inputMinor.price / 100).toFixed(2) : benchmark?.price != null && benchmark.source !== "导入快照" && observedCurrency ? benchmark.price.toFixed(2) : "",
  );
  const [preview, setPreview] = useState<ReturnType<typeof calculateContribution>>();
  const { busy, error, run } = useOperation();
  const draft = saved?.currency === currency ? saved : undefined;
  const priorPrice = (contribution: number | null | undefined) =>
    draft && contribution != null ? (draft.inputMinor.price - draft.contributionMinor + contribution) / 100 : undefined;
  return <form className="lm-form" onInput={event => {
    const parsed = costAmounts.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
    setPreview(parsed.success ? calculateContribution(parsed.data) : undefined);
  }} onSubmit={event => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const at = String(data.get("fxAt") ?? "");

    const optional = (key: string) => data.get(key) || undefined;
    void run(async () => {
      await send(`/api/localmate/missions/${mission.id}`, "PATCH", {
        ...Object.fromEntries(costFields.map(([key]) => [key, data.get(key)])),
        market: data.get("market"), source: data.get("source"), revision: mission.revision, type: "save_cost",
        valuation: { currency, lowPrice: optional("lowPrice"), highPrice: optional("highPrice"), fixedCost: optional("fixedCost"),
          fxToCny: optional("fxToCny"), fxAt: at ? new Date(at).toISOString() : draft?.valuation.fxAt, fxSource: optional("fxSource") },
      });
      router.refresh();
    });
  }}>
    <MarketPicker markets={markets} required defaultMarket={markets.length === 1 ? markets[0].code : undefined} />
    <label>单件金额统一币种<select value={currency} onChange={event => {
      setCurrency(event.target.value);
      setSalePrice("");
      setPreview(undefined);
    }}>
      {currencies.map(code => <option key={code}>{code}</option>)}
    </select></label>
    <div className="lm-form" key={currency}>
      <div className="lm-cost-fields">
        {costFields.map(([key, label]) => <label key={key}>{label}（{currency}/件）<input name={key} type="number" inputMode="decimal" min="0" max="9999999.99" step="0.01" required
          value={key === "price" ? salePrice : undefined}
          defaultValue={key !== "price" && draft ? (draft.inputMinor[key] / 100).toFixed(2) : undefined}
          onChange={key === "price" ? event => setSalePrice(event.target.value) : undefined} /></label>)}
      </div>
      <p aria-live="polite">{preview
        ? `单件贡献预览 ${currency} ${(preview.contributionMinor / 100).toFixed(2)}${preview.amounts.price ? ` · 贡献利润率 ${(100 * preview.contributionMinor / preview.amounts.price).toFixed(1)}%` : ""}`
        : "填齐售价和各项成本后，将显示单件贡献预览。"}</p>
      <details><summary>售价情景与固定成本</summary>
        <div className="lm-cost-fields">
          <label>低价情景<input name="lowPrice" defaultValue={priorPrice(draft?.valuation.lowContributionMinor)} type="number" min="0" step=".01" /></label>
          <label>高价情景<input name="highPrice" defaultValue={priorPrice(draft?.valuation.highContributionMinor)} type="number" min="0" step=".01" /></label>
          <label>固定成本（{currency}，选填）<input name="fixedCost" defaultValue={draft?.valuation.fixedCostMinor === undefined ? undefined : (draft.valuation.fixedCostMinor / 100).toFixed(2)} type="number" min="0" max="9999999.99" step=".01" /></label>
        </div>
      </details>
      {currency !== "CNY" && <div className="lm-cost-fields">
        <label>1 {currency} 等于多少 CNY<input name="fxToCny" defaultValue={draft?.valuation.fxToCny ?? undefined} type="number" min=".00000001" step="any" required /></label>
        <label>汇率观测时间<input name="fxAt" type="datetime-local" required={!draft?.valuation.fxAt} />
          {draft?.valuation.fxAt && <small>留空沿用 {draft.valuation.fxAt}</small>}</label>
        <label>汇率来源<input name="fxSource" defaultValue={draft?.valuation.fxSource ?? undefined} minLength={2} required /></label>
      </div>}
      <label>报价或假设来源<input name="source" defaultValue={draft?.source} required minLength={2} maxLength={500} placeholder="例：供应商报价单编号与日期" /></label>
    </div>
    {error && <p role="alert" className="lm-error">{error}</p>}
    <button className="lm-primary" disabled={busy}>{busy ? "保存中…" : "计算并保存"}</button>
  </form>;
}

export function Boardroom({ missionId, markets, proposals, approvals, shopifyShop, currentIds, defaultMarket }: {
  missionId: string;
  shopifyShop: string | null;
  currentIds: string[];
  defaultMarket?: string;
  markets: MarketOption[];
  proposals: import("@/lib/localmate/board").Proposal[];
  approvals: import("@/lib/localmate/board").Approval[];
}) {
  const router = useRouter();
  const { busy, error, run } = useOperation();
  const [message, setMessage] = useState("");
  const marketName = (code: string) => markets.find(market => market.code === code)?.name ?? code;
  const latestIds = new Set(markets.flatMap(market => {
    const proposal = proposals.find(item => item.snapshot.market === market.code);
    return proposal ? [proposal.id] : [];
  }));
  const current = new Set(currentIds);
  function submit(command: object, note: string) {
    setMessage("");
    void run(async () => {
      try {
        await send(`/api/localmate/missions/${missionId}/board`, "POST", command);
        setMessage(note);
      } finally {
        router.refresh();
      }
    });
  }
  const gateLabels = { READY_FOR_PILOT: "可准备试卖", NEEDS_REVIEW: "待复核", BLOCKED: "有阻断项" };
  const renderProposal = ({ id, hash, version, snapshot }: typeof proposals[number]) => {
    const approval = approvals.find(item => item.proposalId === id);
    const locale = listingLocales[snapshot.market];
    return <article key={id} className="lm-panel">
          <div className="lm-section-heading"><h3>{marketName(snapshot.market)} · V{version}</h3>
            {!current.has(id) && <span className="lm-badge">{latestIds.has(id) ? "输入已更新" : "历史版本"}</span>}
          </div>
          {snapshot.benchmarkCostCurrent === false && <p>对标依据已变更，待重新测算。</p>}
          <p>{snapshot.cost ? `单件贡献 ${snapshot.cost.currency ?? "CNY"} ${(snapshot.cost.contributionMinor / 100).toFixed(2)} · 成本版本 ${snapshot.cost.version}` : "单件贡献待测算"}</p>
          {snapshot.benchmark && <p>对标商品 · <a className="lm-link" href={snapshot.benchmark.url} target="_blank" rel="noreferrer">{snapshot.benchmark.title}</a>{snapshot.benchmark.notes && ` · ${snapshot.benchmark.notes}`}</p>}
          <p>{snapshot.evidence.length ? `引用 ${snapshot.evidence.length} 条商品市场证据` : "待补商品市场证据"}</p>
          {snapshot.pilotGate && <p><b>试卖评估 · {gateLabels[snapshot.pilotGate.status]}</b> {snapshot.pilotGate.reasons.join(" ")}</p>}
          <details>
            <summary>证据、准入缺口与分工</summary>
            <ul className="lm-list">{snapshot.evidence.map(item => <li key={item.id}>
              <a className="lm-link" href={item.url} target="_blank" rel="noreferrer">{item.title}</a><small>{item.observedAt.slice(0, 10)} · {item.category ?? marketName(snapshot.market)} · {item.verification === "IMPORTED_SNAPSHOT" ? "导入快照" : item.verification}</small>
              <p>{item.excerpt}</p>{item.applicability && <small>{item.applicability}</small>}
            </li>)}</ul>
            <p>{snapshot.guardFindings.join("、")}</p>
            <ul className="lm-list">{snapshot.tasks.map(task => <li key={task.owner}>{task.owner} · {task.title}</li>)}</ul>
          </details>
          {approval ? <div>
            {locale && <details open={current.has(id) || undefined}>
              <summary>本地化草稿 · {locale.label}</summary>
              {current.has(id) && !approval.draft && <button className="lm-secondary" type="button" disabled={busy}
                onClick={() => submit({ type: "draft_start", approvalId: approval.id }, "已生成首稿，请核对实际 SKU 卖点。")}>
                生成本地化首稿
              </button>}
              {current.has(id) && <form key={approval.draft?.id} className="lm-form" onSubmit={event => {
                event.preventDefault();
                const fields = new FormData(event.currentTarget);
                submit({ type: "draft", approvalId: approval.id, title: fields.get("title"), description: fields.get("description") }, "草稿版本已保存。");
              }}>
                <label>商品标题<input name="title" required minLength={2} maxLength={160} defaultValue={approval.draft?.title} lang={locale.locale} /></label>
                <label>商品描述<textarea name="description" required minLength={2} maxLength={5000} rows={3} defaultValue={approval.draft?.description} lang={locale.locale} /></label>
                <button className="lm-primary" disabled={busy}>保存上架草稿</button>
              </form>}
              {approval.draft && <details>
                <summary>买家视角预览 · V{approval.draft.version}</summary>
                <div className="lm-panel" lang={locale.locale}>
                  <strong>{approval.draft.title}</strong>
                  <p className="lm-listing-preview-copy">{approval.draft.description}</p>
                </div>
              </details>}
              {approval.draft && <a className="lm-link" href={`/api/localmate/missions/${missionId}/board?draft=${approval.draft.id}`}>
                下载 Shopify 草稿 CSV · V{approval.draft.version}
              </a>}
              {snapshot.market === "MX" && approval.draft && (shopifyShop ? <div>
                <p>开发店 {shopifyShop} · 草稿 V{approval.draft.version} · {approval.draft.title}</p>
                {approval.shopify?.remoteId && <p>已回读 DRAFT · {approval.shopify.remoteId}</p>}
                <button className="lm-primary" type="button"
                  disabled={busy || (!approval.shopify && (!current.has(id) || snapshot.pilotGate?.status === "BLOCKED" || snapshot.benchmarkCostCurrent === false))}
                  onClick={() => submit({ type: approval.shopify ? "shopify_check" : "shopify_create", draftId: approval.draft!.id, shop: shopifyShop },
                    "开发店草稿状态已回读。")}>
                  {approval.shopify ? "回读 Shopify 草稿" : "授权并创建测试店草稿"}
                </button>
              </div> : <p>Shopify 开发店待配置，当前可下载草稿 CSV。</p>)}
            </details>}
            <a className="lm-secondary" href={`/api/localmate/missions/${missionId}/board?review=${approval.id}`}>
              下载试点评审包
            </a>
            <p>已授权准备 · {approval.tasks.filter(task => task.status === "done").length}/{approval.tasks.length} 项完成</p>
            <ul className="lm-list">{approval.tasks.map(task => <li key={task.id}>
              <b>{task.owner}</b> · {task.title}
              {task.status === "open" ? <button className="lm-link lm-task-button" type="button" disabled={busy}
                onClick={() => submit({ type: "complete", taskId: task.id }, "任务进度已保存。")}>标为完成</button> : <small>已完成</small>}
            </li>)}</ul>
          </div> : current.has(id) && <button className="lm-primary" type="button" disabled={busy}
            onClick={() => submit({ type: "approve", proposalId: id, hash }, "内部准备已授权，执行清单已生成。")}>授权内部准备</button>}
        </article>;
  };
  const latest = proposals.filter(proposal => latestIds.has(proposal.id));
  const previous = proposals.filter(proposal => !latestIds.has(proposal.id));
  return <section className="lm-panel lm-board" id="proposal-versions">
    <h2>方案与执行清单</h2>
    <form className="lm-form" onSubmit={event => {
      event.preventDefault();
      submit({ type: "generate", market: new FormData(event.currentTarget).get("market") }, "方案已保存。");
    }}>
      <MarketPicker markets={markets} required defaultMarket={defaultMarket} />
      <button className="lm-primary" disabled={busy}>生成准备方案</button>
    </form>
    {error && <p className="lm-error" role="alert">{error}</p>}
    {message && <p role="status">{message}</p>}
    <p>选择一个市场生成方案。授权后会创建内部执行清单。</p>
    {latest.length > 0 && <div className="lm-grid">{latest.map(renderProposal)}</div>}
    {previous.length > 0 && <details>
      <summary>查看历史版本 · {previous.length}</summary>
      <div className="lm-grid">{previous.map(renderProposal)}</div>
    </details>}
  </section>;
}
