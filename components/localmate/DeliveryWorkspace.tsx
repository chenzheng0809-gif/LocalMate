"use client";

import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { AgentAtWork } from "./AgentAtWork";
import { DimensionFields, readDimensions } from "./DimensionFields";
import { channels, copyFields, type DocumentDraft, type FileKind, type Handoff, type Reply, type RuleCandidate, type UploadInfo, type ListingOption } from "@/lib/localmate/handoff-model";
import { handoffChannel } from "@/lib/localmate/handoff-channels";
import type { ReportInput, ReportMarket } from "@/lib/localmate/report-model";

type Data = {
  state: Handoff; smtp: boolean; ai: boolean; options?: ListingOption[];
  sources: { title: string; url: string; note?: string }[];
  suggestedListing?: { title?: string; description?: string };
};
type Result = { options?: ListingOption[]; state?: Handoff; file?: UploadInfo; draft?: Record<string, string>; excerpt?: string; rules?: RuleCandidate[]; error?: string };
const filed = ".xlsx,.xlsm,.pdf,.docx,.csv,.txt";
const currencies = ["CNY", "USD", "EUR", "GBP", "MXN", "BRL", "JPY", "HKD", "CAD", "SGD", "CHF", "AUD"];
const value = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

function Field({ name, label, initial, type = "text", optional, step }: {
  name: string; label: string; initial?: string | number; type?: string; optional?: boolean; step?: string;
}) {
  return <label>{label}<input name={name} type={type} defaultValue={initial ?? ""} required={!optional}
    min={type === "number" ? (step ?? "1") : undefined} step={step} maxLength={500}/></label>;
}
function Select({ name, label, options, initial }: { name: string; label: string; options: readonly string[]; initial?: string }) {
  return <label>{label}<select name={name} defaultValue={initial} required>
    {options.map(option => <option key={option}>{option}</option>)}</select></label>;
}
function Form({ action, children, label, busy }: { action: (data: FormData) => void | Promise<void>; children: ReactNode; label: string; busy: boolean }) {
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void action(new FormData(event.currentTarget));
  }
  return <form className="lm-form" onSubmit={submit}>{children}<button aria-disabled={busy} disabled={busy} className="lm-secondary">{label}</button></form>;
}
function Upload({ kind, title, busy, action }: {
  kind: FileKind; title: string; busy: boolean; action: (data: FormData) => Promise<void>;
}) {
  return <Form label={title} busy={busy} action={async form => { form.set("kind", kind); await action(form); }}>
    <label>{title}<input type="file" name="file" required accept={kind === "template" ? ".xlsx,.xlsm" : filed}/></label>
  </Form>;
}
function OriginalSelect({ files, label, initial, optional = false, change }: {
  files: UploadInfo[]; label: string; initial?: string; optional?: boolean; change?: (id: string) => void;
}) {
  return <label>{label}<select name="file" defaultValue={initial ?? ""} required={!optional} onChange={event => change?.(event.target.value)}>
    <option value="">{optional ? "尚无材料" : "选择原始文件"}</option>
    {files.map(file => <option key={file.id} value={file.id}>{file.name} · {file.at.slice(0, 10)}</option>)}
  </select></label>;
}
const fields: Record<typeof copyFields[number], string> = {
  title: "本地商品标题", description: "本地商品描述", sku: "SKU", brand: "品牌", gtin: "商品条码",
  lengthCm: "商品长 cm", widthCm: "商品宽 cm", heightCm: "商品高 cm",
  packageLengthCm: "单品包装长 cm", packageWidthCm: "单品包装宽 cm", packageHeightCm: "单品包装高 cm",
  packageKg: "单品含包装重 kg", price: "已确认商品价", currency: "商家价币种",
};
const replyLabels: Record<keyof Omit<Reply, "file" | "rfqId" | "at" | "currency">, string> = {
  forwarder: "货代公司", originalRef: "回单号或原件定位", amount: "整票运费金额（数字）",
  scope: "费用包含项", excludes: "费用不包含项", transit: "运输时效", expires: "报价有效至", proof: "原文摘录或页码／单元格定位",
};

function Evidence({ draft }: { draft?: DocumentDraft }) {
  if (!draft) return null;
  return <>
    {draft.issue && <small>{draft.issue}</small>}
    {Object.keys(draft.evidence).length > 0 && <details>
      <summary>查看提取依据</summary>
      <ul className="lm-list">{[...new Set(Object.values(draft.evidence))].map(line => <li key={line}>{line}</li>)}</ul>
    </details>}
  </>;
}

export function DeliveryWorkspace({ missionId, run, input, market, costSaved }: {
  missionId: string; run: string; input: ReportInput; market: ReportMarket; costSaved: boolean;
}) {
  return <section id="delivery" className="lm-panel lm-form">
    <div className="lm-section-heading"><h2>第 4 步 · 生成市场交付文件</h2></div>
    <p>核对商品标题和描述，填入商家 SKU，保存后即可下载完整交付包。</p>
    <MarketHandoff key={market} project={`/workspace/${missionId}?edit=product`} input={input} market={market}
      base={`/api/localmate/missions/${missionId}/handoff?run=${encodeURIComponent(run)}&market=${market}`} costSaved={costSaved}/>
  </section>;
}

function MarketHandoff({ base, project, market, input, costSaved }: { base: string; project: string; market: ReportMarket; input: ReportInput; costSaved: boolean }) {
  const [data, setData] = useState<Data>();
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const [carton, setCarton] = useState<boolean>();
  const [draft, setDraft] = useState<Partial<Record<"title" | "description", string>>>();
  const [options, setOptions] = useState<ListingOption[]>([]);
  const [copyBusy, setCopyBusy] = useState(false);
  const [copyError, setCopyError] = useState("");
  const copySection = useRef<HTMLDivElement>(null);
  const admissionSection = useRef<HTMLDetailsElement>(null);
  const attemptedCopy = useRef(false);
  const [picked, setPicked] = useState<number>();
  const [replyDraft, setReplyDraft] = useState<{ id: string; values: Record<string, string> }>();
  const [excerpt, setExcerpt] = useState<{ id: string; text: string }>();
  const [mappingCount, setMappingCount] = useState<number>();
  const [priceFile, setPriceFile] = useState<string>();
  const [templateFile, setTemplateFile] = useState<string>();
  const [ruleEdit, setRuleEdit] = useState<string>();
  const [ruleDraft, setRuleDraft] = useState<RuleCandidate>();
  const [ruleFormKey, setRuleFormKey] = useState(0);
  const url = (name: string, file?: string) => `${base}&export=${name}${file ? `&file=${file}` : ""}`;
  const link = (name: string, label: string, file?: string) => <a className="lm-link" href={url(name, file)}>{label}</a>;
  useEffect(() => {
    const controller = new AbortController();
    void fetch(base, { signal: controller.signal, cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error("交付资料加载失败，请刷新。");
      const handoff: Data = await response.json();
      setData(handoff);
      if (handoff.options) setOptions(handoff.options);
    }).catch(error => { if (!controller.signal.aborted) setError(error.message); });
    return () => controller.abort();
  }, [base]);

  useEffect(() => {
    if (!data?.ai || data.options?.length || !copySection.current || attemptedCopy.current) return;
    const section = copySection.current;
    function generate() {
      if (attemptedCopy.current) return;
      attemptedCopy.current = true;
      setCopyBusy(true);
      void fetch(base, { method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "draft-copy", automatic: true }) })
        .then(async response => {
          const result: Result = await response.json();
          if (!response.ok || !result.options?.length) throw new Error(result.error ?? "文案未生成，请重试。");
          setOptions(result.options);
        }).catch(error => setCopyError(error.message))
        .finally(() => setCopyBusy(false));
    }
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      generate();
    }, { rootMargin: "160px 0px" });
    function openDelivery() {
      if (window.location.hash !== "#delivery") return;
      section.closest("#delivery")?.scrollIntoView({ block: "start" });
      observer.disconnect();
      generate();
    }
    observer.observe(section);
    openDelivery();
    window.addEventListener("hashchange", openDelivery);
    return () => {
      observer.disconnect();
      window.removeEventListener("hashchange", openDelivery);
    };
  }, [base, data?.ai, data?.options]);

  const loaded = Boolean(data);
  useEffect(() => {
    function openMaterials() {
      if (window.location.hash !== "#admission-materials" || !admissionSection.current) return;
      admissionSection.current.open = true;
      admissionSection.current.scrollIntoView({ block: "start" });
    }
    openMaterials();
    window.addEventListener("hashchange", openMaterials);
    return () => window.removeEventListener("hashchange", openMaterials);
  }, [loaded]);

  async function handle(operation: () => Promise<void>) {
    setBusy(true);
    setError("");
    setNotice("");
    try { await operation(); }
    catch (error) { setError(error instanceof Error ? error.message : "处理失败。"); }
    finally { setBusy(false); }
  }
  async function post(command: Record<string, unknown> | FormData, version = data?.state.version) {
    const form = command instanceof FormData;
    if (form) command.set("version", String(version));
    const response = await fetch(base, { method: "POST", headers: form ? undefined : { "Content-Type": "application/json" },
      body: form ? command : JSON.stringify({ ...command, version }) });
    const result: Result = await response.json();
    if (!response.ok) throw new Error(result.error ?? "保存失败。");
    if (result.state) {
      setData(previous => previous && { ...previous, state: result.state! });
      setNotice("已保存");
    }
    return result;
  }
  const command = (payload: Record<string, unknown>) => handle(async () => { await post(payload); });
  if (!data) return <p role="status">{error || "正在加载交付资料…"}</p>;
  const { state } = data;
  const channel = handoffChannel(market, input.mexicoMarketplace);
  const rfq = state.rfq;
  const listing = state.listing;
  const files = (kind: FileKind) => state.files.filter(file => file.kind === kind);
  const agent = state.agent;
  const documents = agent?.documents ?? {};
  const upload = (form: FormData) => handle(async () => {
    if (rfq) form.set("rfqId", rfq.id);
    const uploaded = await post(form);
    const file = uploaded.file;
    if (!file || !uploaded.state || file.kind === "material") return;
    if (file.kind === "price") setPriceFile(file.id);
    if (file.kind === "template") { setTemplateFile(file.id); setMappingCount(undefined); }
    const prepared = await post({ type: "prepare", file: file.id }, uploaded.state.version);
    const result = prepared.state?.agent?.documents[file.id];
    setNotice(result?.issue ? `原件已保存。${result.issue}` : "原件已保存，识别结果已填入下方。");
  });
  const selected = state.replies.find(item => item.file === state.selected && item.rfqId === rfq?.id);
  const chosenTemplate = templateFile ?? state.template?.file ?? files("template").at(-1)?.id;
  const templateDoc = chosenTemplate ? documents[chosenTemplate] : undefined;
  const mappings = state.template?.file === chosenTemplate ? state.template?.mappings : templateDoc?.mappings;
  const count = mappingCount ?? mappings?.length ?? 1;
  const chosenPrice = priceFile ?? state.price?.file ?? files("price").at(-1)?.id;
  const priceDoc = chosenPrice ? documents[chosenPrice] : undefined;
  const confirmedPrice = state.price?.file === chosenPrice ? state.price : undefined;
  const shipping = rfq ?? agent?.shipment;
  const channelStatus = state.channel;
  const useCarton = carton ?? (shipping?.carton === undefined ? undefined : Boolean(shipping.carton));
  const currentCategory = state.channel?.category ?? state.category;
  const activeRequirements = state.requirements.filter(item => item.category === undefined || item.category === currentCategory);
  const rules = agent?.ruleCategory === currentCategory ? agent?.rules : undefined;
  const rule = activeRequirements.find(item => item.name === ruleEdit);
  const goodThrough = new Date().toISOString().slice(0, 10);
  const canQuote = Boolean(selected && state.price && state.price.currency === selected.currency &&
    state.price.expires >= goodThrough && selected.expires >= goodThrough);
  const currentFiles = files("reply").filter(file => file.rfqId === rfq?.id);
  const template = state.template;
  const copyDraft = agent?.listing;
  const suggestedListing = copyDraft ?? data.suggestedListing;
  const productNameMissing = /^(我|帮我|请帮|比较|对比)/.test(input.name);
  const shipment = agent?.shipment;
  const missingShipment = [
    ["origin", "起运地"], ["destination", "目的地"], ["units", "件数"], ["mode", "运输方式"], ["ready", "备货日期"],
    ["terms", "贸易条款"], ["carton", "出货包装或完整外箱数据"],
  ].filter(([key]) => !Object.hasOwn(shipment ?? {}, key)).map(([, label]) => label);

  return <div className="lm-form lm-handoff" aria-busy={busy}>
    <div className="lm-handoff-feedback" aria-live="polite">
      {error && <p role="alert" className="lm-error">{error}</p>}
      {notice && <p role="status">{notice}</p>}
    </div>
    <div className="lm-panel lm-form" ref={copySection}>
      <div className="lm-section-heading lm-agent-header"><h3>核对上架草稿 · {channel.name}</h3><AgentAtWork agent="Localizer" busy={copyBusy}/></div>
      {!suggestedListing?.title && !listing && <p>可填写你已核对的商品文案。规格见本次研究报告。</p>}
      {copyError && <p className="lm-error" role="alert">{copyError}</p>}
      {data.ai && <details>
        <summary>补充卖点或重新生成</summary>
        <Form label="重新生成三套文案" busy={busy || copyBusy} action={async form => {
          attemptedCopy.current = true;
          setCopyBusy(true);
          setCopyError("");
          try {
            const result = await post({ type: "draft-copy", facts: value(form, "facts") });
            setOptions(result.options ?? []);
            setPicked(undefined);
          } catch (error) { setCopyError(error instanceof Error ? error.message : "文案未生成，请重试。"); }
          finally { setCopyBusy(false); }
        }}><label>补充已确认的卖点（可选）<textarea name="facts" rows={2} maxLength={2000}/></label></Form>
      </details>}
      {options.length > 0 && <div className="lm-copy-options" aria-label="本地文案选项">
        {options.map((option, index) => <article className="lm-panel lm-form lm-copy-option" key={index} data-picked={picked === index}>
          <span className="lm-badge">{["搜索直达", "使用场景", "规格清晰"][index]}</span>
          <strong>{option.title}</strong><b>{option.slogan}</b><p>{option.description}</p><small><strong>这版侧重</strong> · {option.reason}</small>
          <button type="button" className="lm-secondary" aria-pressed={picked === index} onClick={() => {
            setPicked(index);
            setDraft({ title: option.title, description: `${option.slogan}\n\n${option.description}` });
          }}>{picked === index ? "已选用" : "使用这版"}</button>
        </article>)}
      </div>}
      <Form key={JSON.stringify([suggestedListing, listing])} label="确认商品文案" busy={busy} action={form => command({
        type: "listing", listing: Object.fromEntries(["title", "description", "sku", "brand", "gtin"].map(name => [name, value(form, name)])),
      })}>
        <label>本地商品标题<input name="title" required maxLength={200}
          value={draft?.title ?? listing?.title ?? suggestedListing?.title ?? ""}
          onChange={event => setDraft(current => ({ ...current, title: event.target.value }))}/></label>
        <label>本地商品描述<textarea name="description" required rows={4} maxLength={2500}
          value={draft?.description ?? listing?.description ?? suggestedListing?.description ?? ""}
          onChange={event => setDraft(current => ({ ...current, description: event.target.value }))}/></label>
        <div className="lm-grid">
          <Field name="sku" label="商家 SKU" initial={listing?.sku}/>
          <Field name="brand" label="品牌" initial={listing?.brand} optional/>
          <Field name="gtin" label="商品条码" initial={listing?.gtin} optional/>
        </div>
      </Form>
      {listing && <div className="lm-actions lm-delivery-download">
        <a className="lm-primary" href={url("delivery-zip")}>下载完整交付包 ZIP</a>
        {channel.id === "mercado_libre" && link("listing-json", "下载上架草稿 JSON")}
      </div>}
      {listing && <small>交付包含市场报告、渠道表、准入核对表和上架草稿{costSaved ? "，以及已保存的测算表" : "。保存利润测算后可将测算表一起导出"}。</small>}
    </div>
    <details className="lm-delivery-more">
      <summary>更多交付工具 · 官方模板、询价</summary>
      <div className="lm-form">
    <section className="lm-panel lm-form" aria-label="Agent 交付准备">
      <div className="lm-section-heading"><h3>Agent 交付准备</h3>
        <button type="button" className="lm-primary" disabled={busy} onClick={() => void handle(async () => {
          await post({ type: "prepare" });
          setMappingCount(undefined);
          setNotice("已整理项目资料和原件，可以核对结果。");
        })}>{busy ? "处理中…" : agent ? "更新交付草稿" : "让 Agent 准备交付"}</button>
      </div>
      <div className="lm-actions">{link("channel", "下载渠道跟进 Excel")}{copyDraft && link("copy-draft", "下载本地化文案草稿")}{link("missing", "下载材料核对 Excel")}</div>
      {productNameMissing && <p>项目里的商品名是「{input.name}」。请先确认实际商品，再生成上架文案。 <a className="lm-link" href={project}>确认商品资料</a></p>}
      {agent && <ul className="lm-list">
        <li>商品本地化 · {listing ? "已确认" : copyDraft ? "草稿已生成" : "需补充可用于上架的商品资料"}</li>
        <li>货代询价 · {rfq ? "询价表已生成" : shipment ? missingShipment.length ? `需补充 ${missingShipment.join("、")}` : "已带入出货资料，核对后生成" : "请粘贴出货信息或填写缺项"}</li>
        <li>报价原件 · {Object.values(documents).filter(doc => Object.keys(doc.values).length > 0).length} 份已提取字段</li>
        <li>准入材料 · 已整理报告来源，{activeRequirements.length} 项已核实适用</li>
      </ul>}
    </section>
    <details>
      <summary>市场和渠道</summary>
      <section className="lm-form">
        <p>{channel.name} · {channel.requirements}</p>
        <div className="lm-actions">
          <a className="lm-link" href={channel.apply} target="_blank" rel="noreferrer">官方申请入口</a>
          <a className="lm-link" href={channel.guide} target="_blank" rel="noreferrer">官方注册要求</a>
          <a className="lm-link" href={channel.contact} target="_blank" rel="noreferrer">官方客服</a>
        </div>
        <Form label="保存渠道跟进" busy={busy} action={form => command({ type: "channel", category: value(form, "category"),
          status: value(form, "status"), reference: value(form, "reference") })}>
          <div className="lm-grid">
            <Field name="category" label="拟上架类目（按站点填写）" initial={channelStatus?.category ?? state.category}/>
            <Select name="status" label="跟进状态" options={channels} initial={channelStatus?.status}/>
          </div>
          <Field name="reference" label="跟进记录或申请编号" initial={channelStatus?.reference} optional/>
        </Form>
      </section>
    </details>
    <details>
      <summary>官方上架模板与文案工具</summary>
      <section className="lm-form">
        <small>商家已确认 · {input.name} · 商品 {input.dimensions} · 单品包装 {input.packagingDimensions} · {input.weightKg} kg</small>
        {!listing && copyDraft && <p>Agent 已把报告文案和确认过的规格带入，请核对后确认。</p>}

        {listing && <div className="lm-form">
          <div className="lm-panel lm-form"><strong>{listing.title}</strong><p style={{ whiteSpace: "pre-wrap" }}>{listing.description}</p></div>
          <div className="lm-actions">
            <button type="button" className="lm-secondary" onClick={() => void handle(async () => {
              await navigator.clipboard.writeText(`${listing.title}\n\n${listing.description}`);
              setNotice("已复制商品标题和描述");
            })}>复制商品文案</button>
            {link("copy", "下载商品文案")}
          </div>
        </div>}
        <h3>官方上架模板</h3>
        <p>从对应卖家后台按站点和类目下载原表。上传后会读取可识别的字段。<a className="lm-link" href={channel.templateHelp} target="_blank" rel="noreferrer"> {channel.name} 模板说明</a></p>
        <Upload busy={busy} kind="template" title="上传官方 Excel 原表" action={upload}/>
        {chosenTemplate && !listing && <p>确认本地文案和商家 SKU 后，Agent 可把已确认的字段填进原表。</p>}
        {chosenTemplate && listing && <div className="lm-actions">
          <button type="button" className="lm-secondary" disabled={busy} onClick={() => void handle(async () => {
            await post({ type: "prepare", file: chosenTemplate }); setMappingCount(undefined);
          })}>识别模板字段</button>
        </div>}
        <Evidence draft={templateDoc}/>
        {chosenTemplate && listing && <Form key={JSON.stringify([chosenTemplate, mappings])} label={mappings?.length ? "核对映射并生成上架表" : "检查映射并保存"} busy={busy} action={form => command({
          type: "template", file: value(form, "file"), mappings: Array.from({ length: count }, (_, i) => ({
            sheet: value(form, `sheet${i}`), cell: value(form, `cell${i}`), field: value(form, `field${i}`), custom: value(form, `custom${i}`),
          })),
        })}>
          <OriginalSelect files={files("template")} label="使用原表" initial={chosenTemplate} change={id => { setTemplateFile(id || undefined); setMappingCount(undefined); }}/>
          {Array.from({ length: count }, (_, i) => <div className="lm-grid" key={i}>
            <label>项目字段<select name={`field${i}`} defaultValue={mappings?.[i]?.field ?? "title"}>
              {copyFields.map(field => <option value={field} key={field}>{fields[field]}</option>)}
              <option value="custom">填写原模板规定的值</option></select></label>
            <Field name={`sheet${i}`} label="原工作表名" initial={mappings?.[i]?.sheet}/>
            <Field name={`cell${i}`} label="单元格坐标（例如 D5）" initial={mappings?.[i]?.cell}/>
            <Field name={`custom${i}`} label="模板规定值（仅自填字段）" initial={mappings?.[i]?.custom} optional/>
          </div>)}
          <div className="lm-actions">
            <button type="button" className="lm-secondary" disabled={count >= 80} onClick={() => setMappingCount(count + 1)}>添加字段</button>
            {count > 1 && <button type="button" className="lm-secondary" onClick={() => setMappingCount(count - 1)}>删除最后一项</button>}
          </div>
        </Form>}
        {template && <p>{link("template", "下载已填官方模板")} · 上传到对应站点后台进行校验</p>}
      </section>
    </details>
    <details>
      <summary>价格和物流 {currentFiles.length ? "· 已收到回单" : rfq?.mail?.status === "accepted" || rfq?.mail?.status === "recorded" ? "· 待货代回复" : ""}</summary>
      <section className="lm-form">
        <h3>1. 货代询价</h3>
        {!rfq && <Form label="从出货信息填入询价" busy={busy} action={form => handle(async () => {
          setCarton(undefined);
          const result = await post({ type: "prepare", shipment: value(form, "shipment") });
          setNotice(Object.keys(result.state?.agent?.shipment ?? {}).length ? "出货信息已带入。请核对并补充未识别的字段。" : "未识别到有效字段。请在每行写一个字段，或展开表单输入。");
        })}>
          <label>粘贴出货信息<textarea name="shipment" rows={4} maxLength={2500} required
            placeholder={"起运地：…\n目的地：…\n件数：…\n运输方式：…\n备货日期：YYYY-MM-DD\n贸易条款：…\n出货包装：单品包装或整箱\n货代邮箱：…"} /></label>
        </Form>}
        <details open={Boolean(shipment) || undefined}>
          <summary>{rfq ? "查看或修改询价资料" : "核对询价字段"}</summary>
        <Form key={JSON.stringify(shipping)} label="确认并生成询价表" busy={busy} action={form => handle(async () => {
          const rfq = { ...Object.fromEntries(["contact", "origin", "destination", "mode", "ready", "terms", "notes"].map(key => [key, value(form, key)])),
            units: Number(form.get("units")), carton: useCarton ? {
              dimensions: readDimensions(form, "carton"), count: Number(form.get("count")), grossKg: Number(form.get("gross")),
            } : null };
          await post({ type: "rfq", rfq });
        })}>
          <div className="lm-grid">
            <Field name="origin" label="起运地（地址及邮编）" initial={shipping?.origin}/>
            <Field name="destination" label="目的地（地址及邮编）" initial={shipping?.destination}/>
            <Field name="units" label="商品总件数" type="number" initial={shipping?.units}/>
            <Field name="ready" label="备货日期" type="date" initial={shipping?.ready}/>
            <Select name="mode" label="运输方式" options={["", "Courier", "Air", "Sea", "Rail", "Road"]} initial={shipping?.mode}/>
            <Select name="terms" label="贸易条款" options={["", "EXW", "FCA", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"]} initial={shipping?.terms}/>
            <Field name="contact" label="货代收件邮箱（在线发送时必填）" type="email" initial={shipping?.contact} optional/>
            <Field name="notes" label="货物材质或特殊运输要求" initial={shipping?.notes} optional/>
          </div>
          <label>实际出货包装<select required value={useCarton === undefined ? "" : useCarton ? "carton" : "sku"} onChange={event => setCarton(event.target.value === "" ? undefined : event.target.value === "carton")}>
            <option value="">选择实际出货包装</option><option value="sku">每件用单品包装发货</option><option value="carton">整箱发货</option></select></label>
          {useCarton ? <div className="lm-grid">
            <DimensionFields name="carton" label="运输外箱尺寸" value={shipping?.carton?.dimensions} required/>
            <Field name="count" label="外箱数（同规格）" type="number" initial={shipping?.carton?.count}/>
            <Field name="gross" label="每箱毛重 kg" type="number" step="0.001" initial={shipping?.carton?.grossKg}/>
          </div> : useCarton === false && <small>每件按已确认的包装 {input.packagingDimensions}、毛重 {input.weightKg} kg 询价。</small>}
        </Form>
        </details>
        {rfq && <>
          <p>询价编号 {rfq.id} · {currentFiles.length ? "已收到回单" : rfq.mail?.status === "sending" ? "正在提交邮件" :
            rfq.mail?.status === "unknown" ? "邮件状态待确认，请查看发件邮箱" : rfq.mail ? "待货代回复" : "待发送"}</p>
          {rfq.mail?.status === "accepted" && <small>发信服务已受理 · {rfq.mail.at}</small>}
          <div className="lm-actions">
            {link("rfq", "下载货代询价 Excel")}
            {rfq.contact && <a className="lm-link" href={`mailto:${rfq.contact}?subject=${encodeURIComponent(`Freight RFQ ${rfq.id}`)}&body=${encodeURIComponent("Hello, please quote the shipment using the attached RFQ workbook. Please include total freight, currency, included and excluded charges, transit and validity.")}`}>打开邮件草稿</a>}
            {data.smtp && rfq.contact && !rfq.mail && <button type="button" className="lm-primary" disabled={busy} onClick={() => {
              if (window.confirm(`将询价 Excel 发给 ${rfq.contact}？`)) void command({ type: "send", rfqId: rfq.id });
            }}>发送询价和附件</button>}
            {(!rfq.mail || rfq.mail.status === "unknown") && <button type="button" disabled={busy} className="lm-secondary"
              onClick={() => void command({ type: "sent", rfqId: rfq.id })}>我已从邮箱发出</button>}
          </div>
          {!data.smtp && <small>用邮箱发送时，请将下载的询价表添加为附件。收到回复后上传原件。</small>}
          <h3>2. 导入货代回单</h3>
          <Upload kind="reply" title="上传原始回单" busy={busy} action={upload}/>
          {currentFiles.map(file => {
            const reply = state.replies.find(item => item.file === file.id);
            const localDraft = documents[file.id];
            const suggestion = reply ? undefined : { ...localDraft?.values, ...(replyDraft?.id === file.id ? replyDraft.values : {}) };
            return <details className="lm-panel lm-form" key={file.id} open={!reply || undefined}>
              <summary>{file.name} · {reply ? state.selected === file.id ? "已采用" : "已确认" : "待确认"}</summary>
              <div className="lm-actions">
                {link("original", "下载原始回单", file.id)}
                <button type="button" className="lm-secondary" disabled={busy} onClick={() => void handle(async () => {
                  const res = await fetch(url("excerpt", file.id));
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error);
                  setExcerpt({ id: file.id, text: data.excerpt });
                })}>读取原文</button>
                {data.ai && <button type="button" className="lm-secondary" disabled={busy} onClick={() => {
                  if (window.confirm("将原件提取的文本交给已配置的 AI 服务？请确认可共享。")) void handle(async () => {
                    const result = await post({ type: "extract", file: file.id });
                    if (result.excerpt) setExcerpt({ id: file.id, text: result.excerpt });
                    setReplyDraft({ id: file.id, values: result.draft ?? {} });
                  });
                }}>AI 提取字段</button>}
                {reply && reply.expires >= goodThrough && state.selected !== file.id && <button type="button" className="lm-primary" disabled={busy}
                  onClick={() => void command({ type: "select", file: file.id, rfqId: rfq.id })}>采用这条回单</button>}
              </div>
              <Evidence draft={localDraft}/>
              {excerpt?.id === file.id && <textarea rows={8} value={excerpt.text} readOnly aria-label="回单原件文字"/>}
              <Form key={JSON.stringify(suggestion)} label="核对原件并确认字段" busy={busy} action={form => command({
                type: "reply", file: file.id, rfqId: rfq.id,
                reply: Object.fromEntries([...Object.keys(replyLabels), "currency"].map(key => [key, value(form, key)])),
              })}>
                <div className="lm-grid">
                  <Select name="currency" label="原单币种" options={["", ...currencies]} initial={suggestion?.currency ?? reply?.currency}/>
                  {Object.entries(replyLabels).map(([key, label]) => <Field key={key} label={label} name={key} type={key === "expires" ? "date" : "text"}
                    initial={suggestion?.[key] ?? reply?.[key as keyof typeof reply]}/>)}
                </div>
              </Form>
            </details>;
          })}
          <div className="lm-actions">{link("comparison", "下载报价对照 Excel")}{link("originals", "下载报价对照和原始回单 ZIP")}</div>
        </>}
        {!rfq && <><h3>2. 导入货代回单</h3><small>保存询价后可上传该票的原始回单。</small></>}
        <h3>3. 确认商家价目表</h3>
        <Upload kind="price" title="上传商家价目表原件" busy={busy} action={upload}/>
        <Evidence draft={priceDoc}/>
        {chosenPrice && <Form key={JSON.stringify([chosenPrice, priceDoc, confirmedPrice])} label="核对并确认商家报价" busy={busy} action={form => command({
          type: "price", ...Object.fromEntries(["file", "currency", "amount", "reference", "expires"].map(key => [key, value(form, key)])),
        })}>
          <OriginalSelect files={files("price")} label="商家价目原件" initial={chosenPrice} change={id => setPriceFile(id || undefined)}/>
          <div className="lm-grid">
            <Select name="currency" label="价目币种" options={["", ...currencies]} initial={confirmedPrice?.currency ?? priceDoc?.values.currency}/>
            <Field name="amount" label="对买家商品单价（数字）" initial={confirmedPrice?.amount ?? priceDoc?.values.amount}/>
            <Field name="reference" label="价目表行号、页码或单元格" initial={confirmedPrice?.reference ?? priceDoc?.values.reference}/>
            <Field name="expires" label="价格有效至" type="date" initial={confirmedPrice?.expires ?? priceDoc?.values.expires}/>
          </div>
        </Form>}
        {state.price && <p>{link("original", "下载已确认的商家价目表原件", state.price.file)}</p>}
        <h3>4. 买家报价 PDF</h3>
        {canQuote && rfq ? <>
          <p>商品 {state.price?.currency} {state.price?.amount}／件 × {rfq.units} 件 · 整票运费 {selected?.currency} {selected?.amount} · {selected?.transit}</p>
          <Form label="确认买家报价" busy={busy} action={form => command({
            type: "quote", rfqId: rfq.id, ...Object.fromEntries(["seller", "buyer", "product", "notes"].map(key => [key, value(form, key)])),
          })}>
            <div className="lm-grid">
              <Field name="seller" label="卖方名称" initial={state.quote?.seller ?? (state.price ? documents[state.price.file]?.values.seller : undefined)}/>
              <Field name="buyer" label="买方名称" initial={state.quote?.buyer ?? (state.price ? documents[state.price.file]?.values.buyer : undefined)}/>
              <Field name="product" label="对外商品名称（买家语言）" initial={state.quote?.product ?? listing?.title}/>
              <Field name="notes" label="对外报价备注" initial={state.quote?.notes} optional/>
            </div>
          </Form>
          {state.quote && <div className="lm-actions">{link("quote", "下载买家报价 PDF")}{link("trace", "下载内部报价追溯 Excel")}</div>}
        </> : <p>{state.price && selected && state.price.currency !== selected.currency ? "请取得同币种的确认原件。" : "请确认有效的商家价目和当前询价的货代回单，再生成买家报价。"}</p>}
      </section>
    </details>
      </div>
    </details>
    <details id="admission-materials" ref={admissionSection}>
      <summary>准入材料 {activeRequirements.length > 0 ? `· ${activeRequirements.length} 项` : ""}</summary>
      <section className="lm-form">
        <p>先上传供应商或责任方提供的原件。确认某项要求适用于当前商品后，再填写下方的适用要求记录。</p>
        {data.sources.length > 0 && <ul className="lm-list">{data.sources.map(source => <li key={source.url}>
          <a className="lm-link" href={source.url} target="_blank" rel="noreferrer">{source.title}</a>
          {source.note && <small> · {source.note}</small>}
        </li>)}</ul>}
        {agent?.ruleIssue && <small>{agent.ruleIssue}</small>}
        {data.ai && <button type="button" className="lm-secondary" disabled={busy} onClick={() => void handle(async () => {
          await post({ type: "scan-rules" });
        })}>按站点和类目检索官方材料要求</button>}
        {rules && (rules.length ? <ul className="lm-list">{rules.map((candidate, index) => <li key={index}>
          <button className="lm-link" type="button" onClick={() => {
            setRuleDraft(candidate); setRuleEdit(undefined); setRuleFormKey(ruleFormKey + 1);
          }}>{candidate.name}</button> · <a href={candidate.rule} target="_blank" rel="noreferrer">核对原文</a>
        </li>)}</ul> : <small>已读取到的页面没有给出可引用的匹配材料。请核对站点类目页面。</small>)}
        <Upload busy={busy} kind="material" title="上传已有材料原件" action={upload}/>
        {activeRequirements.length > 0 && <ul className="lm-list">{activeRequirements.map(item => <li key={item.name}>
          <button className="lm-link" type="button" onClick={() => { setRuleEdit(item.name); setRuleDraft(undefined); setRuleFormKey(ruleFormKey + 1); }}>{item.name}</button> · {item.file ? "已收到" : "缺件"}
        </li>)}</ul>}
        <Form key={ruleFormKey} label="记录已核实的适用要求" busy={busy} action={form => command({
          type: "requirement", ...Object.fromEntries(["name", "rule", "submit", "locator"].map(key => [key, value(form, key)])),
          file: value(form, "file") || null,
        })}>
          <div className="lm-grid">
            <Field name="name" label="所需材料名称" initial={rule?.name ?? ruleDraft?.name}/>
            <Field name="rule" label="官方规则链接" type="url" initial={rule?.rule ?? ruleDraft?.rule}/>
            <Field name="locator" label="具体条款或页面定位" initial={rule?.locator ?? ruleDraft?.locator}/>
            <Field name="submit" label="提交入口" type="url" initial={rule?.submit ?? ruleDraft?.submit ?? channel.submit}/>
          </div>
          <OriginalSelect files={files("material")} label="关联已有材料" initial={rule?.file ?? undefined} optional/>
          {(ruleEdit || ruleDraft) && <button type="button" className="lm-link" onClick={() => { setRuleEdit(undefined); setRuleDraft(undefined); setRuleFormKey(ruleFormKey + 1); }}>另记一项</button>}
        </Form>
        <div className="lm-actions">
          {link("missing", "下载补件 Excel")}{link("materials", "下载材料包 ZIP")}
        </div>
      </section>
    </details>
  </div>;
}
