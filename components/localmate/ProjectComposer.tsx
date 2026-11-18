"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, BriefcaseBusiness, Calculator, FileText, Globe2, ImagePlus, Link2, Scale, ShieldCheck, Sparkles, X } from "lucide-react";
import { findSupplierProductUrl } from "@/lib/agent/product-url";
import { send, useOperation } from "./MissionActions";
import { type ProjectFile } from "@/lib/localmate/team-model";
import { reportMarkets } from "@/lib/localmate/report-model";
import type { Mission } from "@/lib/localmate/mission-model";

const shortcuts = [
  ["分析市场机会", "我有一款便携式充电风扇，想评估墨西哥 Mercado Libre 的市场机会。", Globe2],
  ["比较目标市场", "我有一款便携式充电风扇，想比较墨西哥和巴西的试卖机会。", Scale],
  ["测算单件利润", "我想测算便携式充电风扇在墨西哥销售的单件贡献利润。", Calculator],
  ["检查合规资料", "我想了解便携式充电风扇在墨西哥的待核验合规资料。", ShieldCheck],
] as const;

export function ProjectComposer({ initial = "", products, markets, projects }: {
  initial?: string; projects: { id: string; goal: string }[]; products: { id: string; name: string }[]; markets: { code: string; name: string }[];
}) {
  const router = useRouter();
  const { busy, error, run } = useOperation();
  const [goal, setGoal] = useState(initial);
  const [file, setFile] = useState<ProjectFile>();
  const [fileError, setFileError] = useState("");
  const [reading, setReading] = useState(false);
  const [project, setProject] = useState("");
  const [product, setProduct] = useState("");
  const [market, setMarket] = useState("");
  const [addingLink, setAddingLink] = useState(false);
  const [link, setLink] = useState("");
  const [sourceUrl, setSourceUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const linkField = useRef<HTMLInputElement>(null);
  const linkToggle = useRef<HTMLButtonElement>(null);
  const options = useRef<HTMLDetailsElement>(null);
  const goalField = useRef<HTMLTextAreaElement>(null);
  const upload = useRef<HTMLInputElement>(null);
  const image = useRef<HTMLInputElement>(null);
  const attempt = useRef<{ signature: string; id: string } | undefined>(undefined);

  useEffect(() => {
    if (addingLink) linkField.current?.focus();
  }, [addingLink]);

  function startLink() {
    const url = findSupplierProductUrl(link);
    if (!url) {
      setFileError("请输入公开的 1688、淘宝或天猫商品链接。");
      linkField.current?.focus();
      return;
    }
    setSourceUrl(url);
    setProduct("");
    setAddingLink(false);
    setLink("");
    setFileError("");
    linkToggle.current?.focus();
  }

  function create() {
    if (busy || reading || submitting) return;
    const pasted = link.trim() || sourceUrl;
    const supplierUrl = pasted ? findSupplierProductUrl(pasted) : undefined;
    if (pasted && !supplierUrl) {
      setFileError("请输入公开的 1688、淘宝或天猫商品链接。");
      linkField.current?.focus();
      return;
    }
    const text = goal.trim() || (product && products.find(option => option.id === product)?.name) ||
      (file && `核对附件 ${file.name}`) || (supplierUrl && "导入供应商商品并研究出海") || "";
    if (text.length < 3) {
      setFileError("请描述你的商品，或上传商品资料。");
      goalField.current?.focus();
      return;
    }
    setFileError("");
    const payload = { direction: "product_to_market", goal: text, deferResearch: true, file, productId: !supplierUrl ? product || undefined : undefined, sourceUrl: supplierUrl || undefined, markets: market ? [market] : undefined };
    const signature = JSON.stringify(payload);
    if (attempt.current?.signature !== signature) attempt.current = { signature, id: crypto.randomUUID() };
    const requestId = attempt.current.id;
    void run(async () => {
      const { mission } = await send<{ mission: Mission }>("/api/localmate/projects", "POST", { ...payload, requestId });
      setSubmitting(true);
      router.push(`/workspace/${mission.id}`);
    });
  }

  function readFile(selected?: File) {
    if (!selected) return;
    setFileError("");
    if (!selected.size || selected.size > 5 * 1024 * 1024) {
      setFileError("请选择非空且不超过 5 MB 的文件。");
      return;
    }
    const reader = new FileReader();
    setReading(true);
    reader.onload = () => { setFile({ name: selected.name.slice(0, 180), data: String(reader.result) }); setReading(false); };
    reader.onerror = () => { setFileError("附件读取失败，请重新选择。"); setReading(false); };
    reader.readAsDataURL(selected);
  }

  return <section id="new-project" className="lm-start lm-dash-start" aria-labelledby="lm-composer-title">
    <form className="lm-composer" aria-busy={busy || reading || submitting} data-home-card onSubmit={event => { event.preventDefault(); create(); }}>
      <div className="lm-dash-head">
        <h2 id="lm-composer-title"><Sparkles size={17} aria-hidden/>告诉 LocalMate，你想做什么？</h2>
      </div>
      <textarea id="task-intent" ref={goalField} aria-label="出海需求" maxLength={1000} rows={2} value={goal}
        onChange={event => { setGoal(event.target.value); if (fileError) setFileError(""); }}
        onKeyDown={event => {
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey) && !event.nativeEvent.isComposing) {
            event.preventDefault();
            create();
          }
        }}
        placeholder="例如：我有一款便携式充电风扇，想进入墨西哥 Mercado Libre，请帮我评估市场、成本和准入要求。" />
      {addingLink && <div className="lm-link-entry" id="composer-link">
        <input ref={linkField} aria-label="商品链接" value={link} maxLength={2048} placeholder="粘贴 1688、淘宝或天猫链接"
          onChange={event => { setLink(event.target.value); setFileError(""); }}
          onKeyDown={event => {
            if (event.key === "Enter" && !event.nativeEvent.isComposing) { event.preventDefault(); startLink(); }
            if (event.key === "Escape") { setAddingLink(false); setLink(""); setFileError(""); linkToggle.current?.focus(); }
          }}/>
        <button type="button" className="lm-secondary" onClick={startLink}>添加</button>
      </div>}
      {sourceUrl && <span className="lm-file-chip">
        <Link2 size={15}/><span title={sourceUrl}>{new URL(sourceUrl).hostname}</span>
        <button type="button" aria-label="移除商品链接" onClick={() => { setSourceUrl(""); setLink(""); }}><X size={15}/></button>
      </span>}
      {file && <span className="lm-file-chip"><FileText size={15}/>{file.name}<button type="button" aria-label="移除附件" onClick={() => setFile(undefined)}><X size={15}/></button></span>}
      <div className="lm-composer-bar">
        <div className="lm-attachments">
          <input type="file" aria-label="选择商品图片" accept="image/png,image/jpeg,image/webp,image/gif" hidden ref={image} onChange={event => { readFile(event.target.files?.[0]); event.target.value = ""; }}/>
          <input type="file" aria-label="选择商品文件" hidden ref={upload} onChange={event => { readFile(event.target.files?.[0]); event.target.value = ""; }}/>
          <button type="button" onClick={() => image.current?.click()}><ImagePlus size={16}/>图片</button>
          <button type="button" onClick={() => upload.current?.click()}><FileText size={16}/>文件</button>
          <button type="button" ref={linkToggle} onClick={() => {
            setAddingLink(!addingLink);
            setLink("");
            setFileError("");
          }} aria-expanded={addingLink} aria-controls={addingLink ? "composer-link" : undefined}><Link2 size={16}/>商品链接</button>
        </div>
        <div className="lm-dash-submit">
          <details className="lm-project-options" ref={options} onKeyDown={event => {
            if (event.key === "Escape" && options.current?.open) {
              event.preventDefault();
              options.current.open = false;
              options.current.querySelector("summary")?.focus();
            }
          }}><summary><BriefcaseBusiness size={14}/>项目与市场{(project || product || market) && <span className="lm-choice-dot" aria-label="已选择"/>}</summary>
            <div className="lm-form">
              <label>已有项目<select value={project} onChange={event => setProject(event.target.value)}>
                <option value="">{projects.length ? "选择项目" : "暂无已有项目"}</option>
                {projects.map(item => <option key={item.id} value={item.id}>{item.goal}</option>)}
              </select></label>
              {project && <Link className="lm-secondary" href={`/workspace/${project}`}>打开已有项目 <ArrowRight size={14}/></Link>}
              <label>商品<select value={product} onChange={event => { setProduct(event.target.value); if (event.target.value) { setSourceUrl(""); setLink(""); } }}><option value="">根据输入建立商品简报</option>
                {products.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label>
              <label>市场<select value={market} onChange={event => setMarket(event.target.value)}><option value="">从需求识别市场</option>
                {reportMarkets.flatMap(code => markets.filter(option => option.code === code)).map(option => <option key={option.code} value={option.code}>{option.name}</option>)}</select></label>
              <Link className="lm-link" href="/workspace/import">打开商品导入工具</Link>
            </div>
          </details>
          <button className="lm-primary" aria-keyshortcuts="Control+Enter Meta+Enter" title="快捷键：Ctrl 或 ⌘ + Enter" disabled={busy || reading || submitting}>{reading ? "读取中…" : busy || submitting ? "正在准备…" : "开始评估"}<ArrowRight size={16}/></button>
        </div>
      </div>
      {(fileError || error) && <p role="alert" className="lm-error">{fileError || error}</p>}
    </form>
    <div className="lm-dash-shortcuts" aria-label="快捷任务">
      <span className="lm-shortcut-label">快速开始</span>
      {shortcuts.map(([label, prompt, Icon]) => <button type="button" key={label} aria-pressed={goal === prompt} onClick={() => { setGoal(prompt); setFileError(""); goalField.current?.focus(); }}>
        <Icon size={14}/>{label}
      </button>)}
    </div>
  </section>;
}
