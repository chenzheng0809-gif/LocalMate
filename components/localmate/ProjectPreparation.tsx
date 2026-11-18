"use client";

import { taskResultText } from "@/lib/localmate/status-copy";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import type { Mission, ProjectPlan } from "@/lib/localmate/mission-model";
import type { TeamTask } from "@/lib/localmate/team-model";
import { taskLabels } from "@/lib/localmate/team-model";
import type { ProductDNA } from "@/types/domain";
import { defaultMexicoMarketplace, reportDimensions, type MexicoMarketplace } from "@/lib/localmate/report-model";
import { DimensionFields, readDimensions } from "./DimensionFields";
import { AgentAvatar } from "./AgentAvatar";
import { send, useOperation } from "./MissionActions";

type MarketOption = { code: string; name: string };
const endpoint = (id: string) => `/api/localmate/missions/${id}/prepare`;
const optionalNumber = (data: FormData, key: string) => {
  const value = data.get(key);
  return value === "" || value === null ? null : Number(value);
};

export function ImportProjectProduct({ mission, existingSource, confirmed }: { mission: Mission; existingSource?: string | null; confirmed: boolean }) {
  const router = useRouter();
  const { busy, error, run } = useOperation();
  const [warnings, setWarnings] = useState<string[]>([]);
  const [imported, setImported] = useState(false);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setImported(false);
    setWarnings([]);
    void run(async () => {
      const result = await send<{ warnings: string[] }>(endpoint(mission.id), "POST", {
        type: "import_product", revision: mission.revision, sourceUrl: data.get("sourceUrl"), updateExisting: confirmed,
      });
      setWarnings(result.warnings);
      setImported(true);
      router.refresh();
    });
  }

  return <section className="lm-panel lm-form">
    <h2>从商品链接导入</h2>
    <form className="lm-form" onSubmit={submit}>
      <label>1688、淘宝或天猫商品链接<input name="sourceUrl" required maxLength={2048}
        defaultValue={existingSource ?? ""} placeholder="也可以粘贴包含链接的分享文案" /></label>
      {confirmed && <label style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <input type="checkbox" required style={{ width: "auto" }}/>
        这是同一件商品。用页面可读的尺寸、采购价和重量更新资料，然后重新确认。
      </label>}
      <button className="lm-secondary" disabled={busy}>{busy ? "正在读取商品页…" : "抓取并填入商品资料"}</button>
    </form>
    {error && <p role="alert" className="lm-error">{error}</p>}
    {imported && <p role="status">已填入页面可读的商品资料，请核对下方字段。</p>}
    {warnings.length > 0 && <ul className="lm-list">{warnings.map(item => <li key={item}>{item}</li>)}</ul>}
  </section>;
}

export function ConfirmProjectProduct({ product, requireSpecs = false }: { product: ProductDNA; requireSpecs?: boolean }) {
  const router = useRouter();
  const { busy, error, run } = useOperation();
  function confirm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    void run(async () => {
      try {
        const values = {
          name: String(data.get("name")).trim(), dimensions: readDimensions(data, "dimensions") ?? (!requireSpecs ? product.attributes.dimensions : null),
          packagingDimensions: readDimensions(data, "packagingDimensions") ?? (!requireSpecs ? product.attributes.packagingDimensions : null),
          weight: optionalNumber(data, "weight"), priceCNY: optionalNumber(data, "price"),
        };
        if (requireSpecs && (!reportDimensions(values.dimensions) || !reportDimensions(values.packagingDimensions))) {
          throw new Error("请填写商品和单品包装的长、宽、高。");
        }
        const before = { name: product.name, dimensions: product.attributes.dimensions,
          packagingDimensions: product.attributes.packagingDimensions, weight: product.attributes.weight,
          priceCNY: product.sourcing.priceCNY };
        const keys = Object.keys(values) as (keyof typeof values)[];
        const patch = Object.fromEntries(keys.filter(key => values[key] !== before[key]).map(key => [key, values[key]]));
        if (Object.keys(patch).length) await send(`/api/products/${product.id}`, "PATCH", patch);
        await send(`/api/products/${product.id}/confirm`, "POST", { confirm: true });
        if (window.location.search.includes("edit=product")) router.replace(window.location.pathname);
      } finally {
        router.refresh();
      }
    });
  }
  return <section className="lm-panel lm-form" id="project-product">
    <h2>第一步 · 确认商品参数</h2>
    <form className="lm-form" onSubmit={confirm}>
      <div className="lm-grid">
        <label>商品名称<input name="name" defaultValue={product.name === "待确认商品" ? "" : product.name} required minLength={2} maxLength={200} /></label>
        <DimensionFields name="dimensions" label="商品尺寸" value={product.attributes.dimensions} required={requireSpecs}/>
        <DimensionFields name="packagingDimensions" label="单品包装尺寸" value={product.attributes.packagingDimensions} required={requireSpecs}/>
        <label>采购价（人民币／件）<input name="price" required={requireSpecs} type="number" step="0.01" min="0" max="1000000"
          defaultValue={product.sourcing.priceCNY ?? ""} /></label>
        <label>含包装重量（千克）<input name="weight" required={requireSpecs} type="number" step="0.001" min="0.001" max="500"
          defaultValue={product.attributes.weight ?? ""} /></label>
      </div>
      {product.sourcePlatform !== "MANUAL" && <p>页面采购价可能随 SKU 和起订量变化。页面未提供的规格请向供应商核实。</p>}
      {product.sourceUrl && <details><summary>查看原商品链接</summary><p style={{ overflowWrap: "anywhere" }}>{product.sourceUrl}</p></details>}
      {product.name === "待确认商品" && <p>请核对原商品页，填写你实际要卖的商品。</p>}
      {error && <p role="alert" className="lm-error">{error}</p>}
      <button className="lm-primary" disabled={busy}>{busy ? "正在确认…" : "确认商品，继续"}</button>
    </form>
  </section>;
}

export function PlanResearch({ mission, plan, markets, budget, previousMexicoMarketplace }: {
  mission: Mission; plan: ProjectPlan | null; markets: MarketOption[]; budget: number | null; previousMexicoMarketplace?: MexicoMarketplace;
}) {
  const router = useRouter();
  const { busy, error, run } = useOperation();
  const request = useRef<{ signature: string; id: string } | null>(null);
  const [selected, setSelected] = useState(mission.markets.filter(code => markets.some(market => market.code === code)));
  const productFirst = mission.direction === "product_to_market";
  function start(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const payload = {
      type: "save_plan", revision: mission.revision,
      markets: productFirst ? selected : [data.get("market")],
      mexicoMarketplace: productFirst && selected.includes("MX") ? data.get("mexicoMarketplace") : undefined,
      sourcing: productFirst ? "" : data.get("sourcing"),
      procurementLimit: optionalNumber(data, "limit"), budget: optionalNumber(data, "budget"),
    };
    const signature = JSON.stringify(payload);
    if (request.current?.signature !== signature) request.current = { signature, id: crypto.randomUUID() };
    const requestId = request.current.id;
    void run(async () => {
      const result = await send<{ reportId?: string }>(endpoint(mission.id), "POST", { ...payload, requestId });
      request.current = null;
      if (result.reportId) router.push(`/workspace/${mission.id}?view=report&run=${result.reportId}`);
      else router.refresh();
    });
  }
  return <section className="lm-panel lm-form">
    <div className="lm-section-heading">
      <h2>{productFirst ? "第二步 · 确认研究市场" : "确认选品条件"}</h2>
      {productFirst && <span className="lm-report-scout"><AgentAvatar agent="Scout"/> Scout</span>}
    </div>
    {productFirst && mission.markets.some(code => !markets.some(market => market.code === code)) &&
      <p>需求里有市场尚未开放。本次报告只覆盖下方勾选项。</p>}
    <form className="lm-form" onSubmit={start}>
      {productFirst ? <fieldset>
        <legend>首批开放市场</legend>
        <div className="lm-grid">
          {markets.map(market => <label key={market.code} style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <input type="checkbox" style={{ width: "auto" }} checked={selected.includes(market.code)}
              
              onChange={event => setSelected(event.target.checked ? [...selected, market.code] : selected.filter(code => code !== market.code))}/>
            {market.name}
          </label>)}
        </div>
      </fieldset> : <div className="lm-grid">
        <label>目标市场<select name="market" required defaultValue={mission.markets[0] ?? ""}>
          <option value="">选择一个市场</option>
          {markets.map(market => <option key={market.code} value={market.code}>{market.name}</option>)}
        </select></label>
        <label>单件采购价上限（人民币）<input name="limit" type="number" step="0.01" min="0" max="1000000"
          defaultValue={plan?.procurementLimit ?? ""} /></label>
        <label>已有货源或想看的品类<input name="sourcing" maxLength={200} defaultValue={plan?.sourcing ?? ""} /></label>
      </div>}
      {productFirst && selected.includes("MX") && <label>墨西哥站点<select name="mexicoMarketplace" defaultValue={previousMexicoMarketplace ?? defaultMexicoMarketplace(mission.goal)}>
        <option value="mercado_libre">Mercado Libre México</option><option value="amazon">Amazon México</option>
      </select></label>}
      <label>试卖总预算（人民币）<input name="budget" type="number" required={productFirst} step="0.01" min="0.01" max="10000000"
        defaultValue={budget === null ? "" : budget / 100}/></label>
      {error && <p role="alert" className="lm-error">{error}</p>}
      <button className="lm-primary" disabled={busy || (productFirst && !selected.length)}>{busy ? "正在提交…" : productFirst ? "开始研究并生成报告" : "开始查找商品机会"}</button>
    </form>
  </section>;
}

export function SaveCandidate({ mission, procurementLimit }: { mission: Mission; procurementLimit: number | null }) {
  const router = useRouter();
  const { busy, error, run } = useOperation();
  const [quote, setQuote] = useState("");
  const overLimit = procurementLimit !== null && quote !== "" && Number(quote) > procurementLimit;
  return <section className="lm-panel lm-form" id="project-product">
    <h2>保存待验证商品</h2>
    <form className="lm-form" onSubmit={event => {
      event.preventDefault();
      const data = new FormData(event.currentTarget);
      void run(async () => {
        await send(endpoint(mission.id), "POST", { type: "save_candidate", revision: mission.revision,
          name: data.get("name"), supplier: data.get("supplier"), priceCNY: optionalNumber(data, "price") });
        router.refresh();
      });
    }}>
      <label>候选商品<input name="name" required minLength={2} maxLength={200} /></label>
      <div className="lm-grid">
        <label>供应商或报价出处<input name="supplier" maxLength={200} /></label>
        <label>单件采购报价（人民币）<input name="price" type="number" step="0.01" min="0" max="1000000"
          value={quote} onChange={event => setQuote(event.target.value)} /></label>
      </div>
      {overLimit && <p role="status">这条报价超过你设定的采购价上限。</p>}
      {error && <p role="alert" className="lm-error">{error}</p>}
      <button className="lm-primary" disabled={busy}>{busy ? "正在保存…" : "保存候选商品"}</button>
    </form>
  </section>;
}

export function ScoutProgress({ mission, task }: { mission: Mission; task: TeamTask }) {
  const router = useRouter();
  const active = task.status === "queued" || task.status === "running";
  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    let checking = false;
    const path = `/api/localmate/missions/${mission.id}/tasks`;
    const timer = window.setInterval(async () => {
      if (checking) return;
      checking = true;
      try {
        const response = await fetch(path, { cache: "no-store", signal: controller.signal });
        if (!response.ok) return;
        const data = await response.json();
        if (controller.signal.aborted) return;
        if (data.updatedAt !== mission.updatedAt) router.refresh();
      } catch {
        // Recover on the next poll.
      } finally {
        checking = false;
      }
    }, 3000);
    return () => { controller.abort(); window.clearInterval(timer); };
  }, [active, mission.id, mission.updatedAt, router]);
  return <section className="lm-panel lm-form">
    <div className="lm-section-heading"><h2>{mission.direction === "product_to_market" ? "市场研究" : "商品机会线索"}</h2>
      <span className="lm-badge">{taskLabels[task.status]}</span></div>
    {task.result && <p>{taskResultText(task.result.summary, task.agent === "Guard")}</p>}
    {task.result?.evidence?.length ? <ul className="lm-list">{task.result.evidence.map(item => <li key={`${item.market ?? ""}:${item.url}`}>
      <a className="lm-link" href={item.url} target="_blank" rel="noreferrer">{item.title}</a>
      {item.note && <small>{item.note}</small>}
    </li>)}</ul> : null}
    {(task.status === "waiting" || task.status === "failed") &&
      <Link className="lm-link" href={`/workspace/${mission.id}?view=board&team=1#team-tasks`}>查看顾问任务与重试入口</Link>}
  </section>;
}
