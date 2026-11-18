"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Benchmark, Comparable } from "@/lib/localmate/benchmarks";
import { formatSales, highSales } from "@/lib/localmate/market-samples";
import { AgentAtWork } from "./AgentAtWork";
import { send, useOperation } from "./MissionActions";

function ComparableImage({ item }: { item: Comparable }) {
  const [failed, setFailed] = useState(false);
  if (!item.image || failed) return null;
  return <a href={item.url} target="_blank" rel="noreferrer" className="lm-comparable-image">
    {/* eslint-disable-next-line @next/next/no-img-element */}
    <img src={item.image} alt={item.title} width={280} height={160} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)}/>
  </a>;
}

export function CompetitorShortlist({ missionId, market, candidates, selected, researching }: {
  missionId: string;
  market: { code: string; name: string };
  candidates: Comparable[];
  selected: Benchmark | null;
  researching: boolean;
}) {
  const router = useRouter();
  const { busy, error, run } = useOperation();
  const display = candidates.filter(highSales).sort((a, b) => b.sales! - a.sales!);
  if (!display.length) return <section className="lm-panel lm-form">
    <div className="lm-section-heading lm-agent-header"><h3>{market.name}暂无可对标商品</h3><AgentAtWork agent="Scout" busy={researching}/></div>
    <p>暂无来源显示销量超过 500 件。可以继续补充商品链接。</p>
    <a className="lm-link" href="#market-observations">添加竞品链接</a>
  </section>;

  return <section className="lm-board-main" aria-label={`${market.name}竞品`}>
    <div className="lm-section-heading lm-agent-header"><div><h3>{market.name}的竞品</h3>
      <small>{display.length} 个候选 · 按页面销量排序</small></div><AgentAtWork agent="Scout" busy={researching}/></div>
    {error && <p role="alert" className="lm-error">{error}</p>}
    <div className="lm-comparable-grid">
      {display.map(item => {
        const active = selected?.url === item.url;
        return <article key={item.url} className="lm-panel lm-comparable" data-selected={active || undefined}>
          <ComparableImage key={item.image} item={item}/>
          <div className="lm-comparable-title"><h4>{item.title}</h4>{active && <span className="lm-badge">已选对标</span>}</div>
          {item.price !== null && item.currency && <strong>
            {item.source === "导入快照" ? "历史挂牌价 · " : "观察价 · "}
            {item.currency} {item.price.toLocaleString("zh-CN", { maximumFractionDigits: 2 })}
          </strong>}
          <small>页面销量 {formatSales(item)}{item.rating !== null && ` · ${item.rating}/5`}</small>
          {item.details.length > 0 && <p>{item.details.slice(0, 2).join(" · ")}</p>}
          <a className="lm-link" href={item.url} target="_blank" rel="noreferrer">查看原商品页</a>
          {active ? <p>{selected.notes || "已作为这个市场的测算参考。"}</p> :
            <form className="lm-form" onSubmit={event => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              void run(async () => {
                await send(`/api/localmate/missions/${missionId}/benchmark`, "POST", {
                  market: market.code, comparableId: item.id, notes: data.get("notes"),
                });
                router.push(`/workspace/${missionId}?view=board&step=evaluate&market=${market.code}`);
                router.refresh();
              });
            }}>
              <label>想借鉴的地方<input name="notes" placeholder="例如尺寸、组合装或售价" maxLength={1000}/></label>
              <button className="lm-secondary" disabled={busy}>选为对标并测算</button>
            </form>}
          {active && <a className="lm-secondary" href={`/workspace/${missionId}?view=board&step=evaluate&market=${market.code}`}>按这个竞品测算</a>}
        </article>;
      })}
    </div>
  </section>;
}
