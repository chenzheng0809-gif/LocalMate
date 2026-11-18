"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { MexicoMarketplace, ReportMarket } from "@/lib/localmate/report-model";
import { AgentAtWork } from "./AgentAtWork";
import { send, useOperation } from "./MissionActions";

type Source = { title: string; url: string };
type Review = {
  mode: "demo" | "live" | "fallback" | "no_sources" | "knowledge" | "quota";
  readable: number;
  sources: Source[];
  items: { source: number; quote: string; action: string; curated?: boolean }[];
};
type Checklist = { review: Review; prepared: number[] };

function storeChecklist(key: string, value: Checklist) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* The checklist remains available on this page. */ }
}

export function ComplianceDesk({ productId, revision, confirmed, market, name, marketplace, sources, next, materialsReady }: {
  productId: string; revision: string; confirmed: boolean; market: ReportMarket; name: string;
  marketplace: MexicoMarketplace; sources: Source[]; next: string; materialsReady: boolean;
}) {
  const { busy, error, run } = useOperation();
  const [checklist, setChecklist] = useState<Checklist>();
  const resultsHeading = useRef<HTMLHeadingElement>(null);
  const focusResults = useRef(false);
  const storageKey = `lm:checklist:${productId}:${revision}:${market}:${marketplace}`;
  const review = checklist?.review;
  const references = review?.sources ?? sources;
  const prepared = checklist?.prepared.length ?? 0;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setChecklist(JSON.parse(saved) as Checklist);
    } catch { /* Unavailable local storage does not stop a new review. */ }
  }, [storageKey]);

  useEffect(() => {
    if (review && focusResults.current) {
      focusResults.current = false;
      resultsHeading.current?.focus();
    }
  }, [review]);

  function toggle(index: number, checked: boolean) {
    if (!checklist) return;
    const current = checklist.prepared.filter(item => item !== index);
    const nextChecklist = { ...checklist, prepared: checked ? [...current, index] : current };
    setChecklist(nextChecklist);
    storeChecklist(storageKey, nextChecklist);
  }

  function download() {
    if (!review || !checklist) return;
    const text = [
      `${name}准入核对清单`, "状态：需专业复核", "",
      ...review.items.flatMap((item, index) => {
        const source = references[item.source - 1];
        return [`${index + 1}. ${item.action}`, `资料准备：${checklist.prepared.includes(index) ? "已标记准备" : "待补充"}`,
          `依据：${item.quote}`, source ? `${source.title} · ${source.url}` : "", ""];
      }),
    ].join("\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF", text], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `LocalMate-${name}-准入核对清单.txt`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return <section className="lm-panel lm-form">
    <div className="lm-section-heading lm-agent-header"><div><h2>{name}准入预检</h2><span className="lm-badge lm-waiting">{confirmed ? "需专业复核" : "待确认"}</span></div>
      <AgentAtWork agent="Guard" busy={busy}/>
    </div>
    <div className="lm-actions">
      <button className={review ? "lm-secondary" : "lm-primary"} type="button" disabled={busy || !confirmed} onClick={() => void run(async () => {
        const result = await send<Review>(`/api/localmate/compliance/${productId}`, "POST", { market, marketplace });
        const previouslyPrepared = new Set(checklist?.prepared.map(index => {
          const item = checklist.review.items[index];
          return item && JSON.stringify([checklist.review.sources[item.source - 1]?.url, item.action]);
        }));
        const nextChecklist = { review: result, prepared: result.items.flatMap((item, index) =>
          previouslyPrepared.has(JSON.stringify([result.sources[item.source - 1]?.url, item.action])) ? [index] : []) };
        focusResults.current = true;
        setChecklist(nextChecklist);
        storeChecklist(storageKey, nextChecklist);
      })}>{busy ? "正在读取来源…" : "生成准入核对清单"}</button>
      {!confirmed && <Link className="lm-link" href={next}>先确认商品资料</Link>}
    </div>
    {error && <p role="alert" className="lm-error">{error}</p>}
    {!review && <p>生成清单后，按核对事项向供应商索取资料，再上传原件给进口商或专业人员复核。</p>}
    {review && <section className="lm-form lm-checklist-results" aria-labelledby="checklist-results">
      <div className="lm-section-heading"><h3 id="checklist-results" ref={resultsHeading} tabIndex={-1}>下一步 · 准备资料</h3>
        <span className="lm-badge">{prepared}/{review.items.length} 项已备资料</span></div>
      {review.mode !== "live" && <p>{{ demo: "演示模式，已显示可用的资料依据。", fallback: "模型暂未生成核对项，可继续查看官方入口。",
        knowledge: "当前清单来自已整理的官方资料。", quota: "今日 AI 额度已用完，仍可查看现有清单和官方依据。",
        no_sources: "暂未读取到官方正文，可打开官方入口手动核对。" }[review.mode]}</p>}
      {!review.items.length ? <p>暂无可引用的核对项。请把商品规格和官方链接一并交给当地责任方查证。</p> : <>
        <p>把以下事项发给供应商或当地责任方。收到资料后再勾选，随后到交付区上传原件。</p>
        <ol className="lm-checklist-items">{review.items.map((item, index) => {
          const reference = references[item.source - 1];
          return <li key={`${item.source}-${index}`}>
            <label><input type="checkbox" checked={checklist?.prepared.includes(index) ?? false}
              onChange={event => toggle(index, event.target.checked)}/><span><b>{item.action}</b><small>标记资料已准备</small></span></label>
            {reference && <details><summary>{item.curated ? "查看官方依据" : "查看原文与来源"}</summary>
              {item.curated ? <p>{item.quote}</p> : <blockquote>{item.quote}</blockquote>}
              <a className="lm-link" target="_blank" rel="noreferrer" href={reference.url}>{reference.title}</a>
            </details>}
          </li>;
        })}</ol>
        <small>勾选只记录备料进度。资料适用性和准入结论仍需专业复核。</small>
      </>}
      <div className="lm-actions">
        <Link className="lm-primary" href={next}>{materialsReady ? "去准入材料区上传原件" : "返回项目准备交付"}</Link>
        {review.items.length > 0 && <button className="lm-secondary" type="button" onClick={download}>下载核对清单</button>}
      </div>
    </section>}
    <details open={!review || undefined}><summary>官方来源 · {references.length} 个入口{review ? ` · 已读正文 ${review.readable} 个` : ""}</summary><ul className="lm-list">
      {references.map(source => <li key={source.url}><a className="lm-link" target="_blank" rel="noreferrer" href={source.url}>{source.title}</a></li>)}
    </ul></details>
  </section>;
}
