"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AgentAtWork } from "./AgentAtWork";
import { AgentPose } from "./AgentPose";
import { reportModules, reportSummary, reportTasks } from "@/lib/localmate/report-view";
import { DeliveryWorkspace } from "./DeliveryWorkspace";
import type { CostCheck } from "@/lib/localmate/mission-model";
import { taskLabels, type TeamTask } from "@/lib/localmate/team-model";

export function MarketReport({ missionId, run, initialTasks, requestedMarket, costs }: {
  missionId: string; run: string; initialTasks: TeamTask[]; requestedMarket?: string; costs: CostCheck[];
}) {
  const [tasks, setTasks] = useState(initialTasks);
  const [selectedMarket, chooseMarket] = useState(requestedMarket);
  const [offline, setOffline] = useState(false);
  const report = reportSummary(tasks);
  const done = report?.done ?? false;
  useEffect(() => {
    if (done) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const response = await fetch(`/api/localmate/missions/${missionId}/tasks`, { cache: "no-store", signal: controller.signal });
        if (!response.ok) throw new Error("Task polling failed");
        const feed = await response.json();
        if (!controller.signal.aborted) {
          setTasks(reportTasks(feed.tasks, run));
          setOffline(!feed.workerOnline);
        }
      } catch {
        if (!controller.signal.aborted) setOffline(true);
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(poll, 1800);
      }
    }
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [done, missionId, run]);
  if (!report) return null;
  const { input } = report;
  const market = report.markets.find(item => item.code === selectedMarket) ?? report.markets[0];
  const board = `/workspace/${missionId}?view=board`;
  const cost = costs.find(item => item.market === market?.code);
  return <div className="lm-board-flow">
    <ol className="lm-workflow-steps" aria-label="出海流程">
      <li><Link href={`/workspace/${missionId}`}>1. 确认商品</Link></li>
      <li>{done ? <a href="#research-results">2. 研究与竞品</a> : "2. 研究与竞品"}</li>
      <li>{done && market ? <Link href={`${board}&step=evaluate&market=${market.code}#project-cost`}>3. 利润测算</Link> : "3. 利润测算"}</li>
      <li>{done ? <a href="#delivery">4. 生成文件</a> : "4. 生成文件"}</li>
    </ol>
    <section className="lm-panel lm-form">
      <div className="lm-report-heading">
        <div className="lm-form">
          <h2>{done ? "出海研究报告" : "AI 董事会正在研究"}</h2>
          <p>{input.name} · {report.markets.map(market => market.name).join("、")}</p>
          {done && <a className="lm-secondary" href={`/api/localmate/missions/${missionId}/report?run=${run}`}>下载完整报告</a>}
        </div>
        <ul className="lm-report-poses" aria-label="四位顾问的进度">
          {report.roles.map(({ agent, task }) => {
            const status = task?.status ?? "queued";
            const label = `${agent} · ${taskLabels[status]}`;
            return <li key={agent} data-status={status} aria-label={label} title={label}>
              <AgentPose agent={agent} finished={status === "completed"}/>
            </li>;
          })}
        </ul>
      </div>
      {offline && !done && <p role="status">暂时无法接收工作进程的状态，任务记录仍保存在项目里。</p>}
    </section>
    {done && market && <>
      <section id="research-results" className="lm-panel lm-form">
        <div className="lm-section-heading lm-agent-header"><h2>第 2 步 · 核对研究与竞品</h2><AgentAtWork agent="Scout" busy={false}/></div>
        {report.markets.length > 1 && <label>目标市场<select value={market.code} onChange={event => chooseMarket(event.target.value)}>
          {report.markets.map(item => <option key={item.code} value={item.code}>{item.name} · {item.channel.name}</option>)}
        </select></label>}
        <p>{market.channel.name}。核对来源后，可以选一个可比商品作为参考，也可以直接按自己的报价测算。</p>
        <div className="lm-actions">
          <Link className="lm-secondary" href={`${board}&step=research&market=${market.code}`}>查看竞品与来源</Link>
        </div>
        {market.outputs.filter(item => item.agent === "Scout" || item.agent === "Guard").map(({ agent, section, evidence, nextAction }) => <details key={agent}>
          <summary>{section?.title ?? reportModules[agent]}{section?.releaseHold && <> <span className="lm-badge lm-waiting">需专业复核</span></>}</summary>
          {section && <ul className="lm-list">{section.lines.map((line, index) => <li key={index}>{line}</li>)}</ul>}
          {nextAction && <p>AI 建议：{nextAction}</p>}
          {evidence.length > 0 && <ul className="lm-list">{evidence.map(item => <li key={item.url}>
            <a className="lm-link" href={item.url} target="_blank" rel="noreferrer">{item.title}</a>
            {item.note && <p>{item.note}</p>}
          </li>)}</ul>}
        </details>)}
      </section>
      <section className="lm-panel lm-form">
        <div className="lm-section-heading lm-agent-header"><h2>第 3 步 · 利润测算</h2><AgentAtWork agent="Margin" busy={false}/></div>
        <p>{cost ? `已保存 ${market.name}测算 · 单件贡献 ${cost.currency} ${(cost.contributionMinor / 100).toFixed(2)}` :
          "填写售价、采购、物流与渠道费用。暂无报价时，可先保存草稿，之后再补测算表。"}</p>
        <div className="lm-actions">
          <Link className={cost ? "lm-secondary" : "lm-primary"} href={`${board}&step=evaluate&market=${market.code}#project-cost`}>
            {cost ? "查看或调整测算" : "打开利润测算"}
          </Link>
          {cost && <a className="lm-primary" href="#delivery">继续生成文件</a>}
        </div>
      </section>
      <DeliveryWorkspace missionId={missionId} run={run} input={input} market={market.code} costSaved={Boolean(cost)}/>
    </>}
  </div>;
}
