"use client";

import { taskResultText } from "@/lib/localmate/status-copy";

import Link from "next/link";
import type { MethodSnapshot } from "@/lib/localmate/method-model";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { ArrowDownRight, ArrowRight, AtSign, CircleCheck, PanelLeftClose, PanelLeftOpen, RotateCcw, Send, UsersRound } from "lucide-react";
import { agents, currentTask, taskLabels, type AgentName, type TeamTask } from "@/lib/localmate/team-model";
import { AgentAvatar } from "./AgentAvatar";
import { send, useOperation } from "./MissionActions";

const fmt = new Intl.DateTimeFormat("zh-CN", { dateStyle: "short", timeStyle: "short", timeZone: "Asia/Shanghai" });
type Feed = { tasks: TeamTask[]; workerOnline: boolean; updatedAt: string };

export function TaskDetails({ task }: { task: TeamTask }) {
  const result = task.result;
  return <div className="lm-task-output">
    <span className={`lm-badge lm-${task.status}`}>{taskLabels[task.status]}</span>
    <time dateTime={task.updatedAt}>{fmt.format(new Date(task.updatedAt))}</time>
    {!task.report && <p>{task.instruction}</p>}
    {task.method && <details><summary>使用的做法 · {task.method.name}</summary><p>{task.method.instructions}</p></details>}
    <Link className="lm-link" href={`/workspace?view=resources&mission=${task.missionId}&task=${task.id}`}>将指令存为做法</Link>
    {result && <><b>{taskResultText(result.summary, task.agent === "Guard")}</b>
      {result.nextAction && <p>AI 建议 · {result.nextAction}</p>}
      {result.details?.length ? <ul className="lm-output-list">{result.details.map((item, i) => <li key={i}>{taskResultText(item, task.agent === "Guard")}</li>)}</ul> : null}
      {result.evidence?.length ? <details><summary>查看证据 · {result.evidence.length}</summary><ul className="lm-list">{result.evidence.map((item, i) =>
        <li key={i}><a className="lm-link" href={item.url} target="_blank" rel="noreferrer">{item.title}</a>{item.note && <small>{item.note}</small>}</li>)}</ul></details> : null}
      {result.link && <a className="lm-link" href={result.link.startsWith("#") && result.link !== "#project-product"
        ? `/workspace/${task.missionId}?view=board&step=evaluate${result.link}` : result.link === "#project-product"
          ? `/workspace/${task.missionId}#project-product` : result.link}>打开原始记录 <ArrowRight size={14}/></a>}
    </>}
  </div>;
}

export function TeamBoard({ missionId, initialTasks, updatedAt, methods, actions, openTeam, defaultStep, children, sideTools = false }: {
  missionId: string; initialTasks: TeamTask[]; updatedAt: string; methods: MethodSnapshot[];
  actions: { agent: "Scout" | "Guard"; label: string; instruction: string; markets: string[]; exact?: boolean }[];
  openTeam: boolean; defaultStep?: string; sideTools?: boolean; children: ReactNode;
}) {
  const router = useRouter();
  const path = `/api/localmate/missions/${missionId}/tasks`;
  const { run, error, busy } = useOperation();
  const [tasks, setTasks] = useState(initialTasks);
  const [feedError, setFeedError] = useState("");
  const [instruction, setInstruction] = useState("");
  const [methodId, setMethodId] = useState("");
  const selectedMethod = methods.find(method => method.id === methodId);
  const [sent, setSent] = useState("");
  const [expanded, setExpanded] = useState<AgentName>();
  const field = useRef<HTMLTextAreaElement>(null);
  const request = useRef<{ signature: string; id: string } | null>(null);
  const lastUpdate = useRef(updatedAt);
  const sequence = useRef(0);
  const timerBusy = useRef(false);

  const poll = useCallback(async (signal?: AbortSignal) => {
    if (timerBusy.current || signal?.aborted) return;
    timerBusy.current = true;
    const revision = sequence.current;
    try {
      const response = await fetch(path, { cache: "no-store", signal });
      if (!response.ok) throw new Error("任务同步中断。");
      const feed: Feed = await response.json();
      if (signal?.aborted || revision !== sequence.current) return;
      setTasks(feed.tasks);
      setFeedError(feed.workerOnline || !feed.tasks.some(task => task.status === "queued" || task.status === "running") ? "" : "工作进程暂未连接，任务已保存在队列中。");
      if (feed.updatedAt !== lastUpdate.current) {
        lastUpdate.current = feed.updatedAt;
        router.refresh();
      }
    } catch {
      if (!signal?.aborted) setFeedError("任务同步中断，正在尝试重连。");
    } finally {
      timerBusy.current = false;
    }
  }, [path, router]);

  useEffect(() => {
    if (!defaultStep) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("step") !== defaultStep) {
      url.searchParams.set("step", defaultStep);
      window.history.replaceState(null, "", url);
    }
  }, [defaultStep]);

  useEffect(() => {
    const controller = new AbortController();
    void poll(controller.signal);
    const timer = setInterval(() => void poll(controller.signal), 3000);
    return () => { clearInterval(timer); controller.abort(); };
  }, [poll]);

  function dispatch(value: string, method?: MethodSnapshot) {
    const text = value.trim();
    if (text.length < 2) { field.current?.focus(); return; }
    const reference = method && { id: method.id, revision: method.revision };
    const signature = JSON.stringify([text, reference]);
    if (request.current?.signature !== signature) request.current = { signature, id: crypto.randomUUID() };
    const requestId = request.current.id;
    setSent("");
    void run(async () => {
      const feed = await send<Feed>(path, "POST", { type: "dispatch", instruction: text, requestId, method: reference });
      sequence.current++;
      setTasks(feed.tasks);
      setInstruction(current => current.trim() === text ? "" : current);
      request.current = null;
      setSent("指令已加入任务队列");
      router.refresh();
    });
  }

  function retry(id: string) {
    void run(async () => {
      const feed = await send<Feed>(path, "POST", { type: "retry", id });
      sequence.current++;
      setTasks(feed.tasks);
    });
  }

  function focus(value?: string) {
    if (value !== undefined) setInstruction(value);
    field.current?.focus();
  }

  return <div className="lm-board-flow">
    {actions.length > 0 && <section className="lm-panel lm-board-actions" aria-label="本阶段的顾问任务">
      {actions.map(action => {
        const matches = tasks.filter(task => task.agent === action.agent && !task.method &&
          (action.exact ? task.instruction === action.instruction :
            task.markets.some(market => action.markets.includes(market)) && !/\bAmazon\s+UK\b|英国亚马逊|亚马逊英国/i.test(task.instruction)));
        const task = matches.find(item => item.status === "queued" || item.status === "running") ?? matches[0];
        const pending = task?.status === "queued" || task?.status === "running";
        const retryable = task?.status === "failed" && task.instruction === action.instruction;
        return <div key={action.instruction} className="lm-board-action">
          <div><strong>{action.label}</strong>
            {task && <p><span className={`lm-badge lm-${task.status}`}>{taskLabels[task.status]}</span>
              {task.result?.summary && <span> {taskResultText(task.result.summary, task.agent === "Guard")}</span>}</p>}
            {!!task?.result?.details?.length && <details><summary>任务详情</summary>
              <ul className="lm-list">{task.result.details.map((line, i) => <li key={i}>{taskResultText(line, task.agent === "Guard")}</li>)}</ul>
            </details>}
          </div>
          <button className="lm-secondary" type="button" aria-label={action.label} disabled={busy || pending}
            onClick={() => retryable && task ? retry(task.id) : dispatch(action.instruction)}>
            {pending ? taskLabels[task.status] : retryable ? "重试" : task ? "重新运行" : "开始"}
          </button>
        </div>;
      })}
    </section>}
    {feedError && <button type="button" className="lm-link lm-error" onClick={() => void poll()}>{feedError} 重试</button>}
    {error && <p className="lm-error" role="alert">{error}</p>}
    {sent && <p role="status" className="lm-success"><CircleCheck size={15}/>{sent}</p>}
    <div className={sideTools ? "lm-board-with-tools" : "lm-board-flow"}>
    <div className="lm-board-main">{children}</div>
    <details className="lm-panel lm-board-tools" id="team-tasks" open={sideTools || openTeam || undefined}>
      {sideTools ? <summary className="lm-advisor-toggle">
        <span className="lm-advisor-expand"><PanelLeftOpen size={17} aria-hidden="true"/>展开顾问栏</span>
        <span className="lm-advisor-collapse" title="收起顾问栏"><PanelLeftClose size={17} aria-hidden="true"/>顾问任务与自定义指令</span>
      </summary> : <summary><UsersRound size={17} aria-hidden="true"/>顾问任务与自定义指令</summary>}
      <div className="lm-board-tools-body">
      <section className="lm-board-team" aria-label="顾问任务">
      <ul>{agents.map(agent => {
        const history = tasks.filter(item => item.agent === agent);
        const task = currentTask(tasks, agent);
        return <li key={agent}><button type="button" className="lm-agent-row" aria-expanded={expanded === agent} onClick={() => setExpanded(expanded === agent ? undefined : agent)}>
          <AgentAvatar agent={agent}/><span><b>{agent}</b><small className="lm-clamp" title={task?.title}>{task?.title ?? "暂无任务"}</small>
            {task && <span className={`lm-badge lm-${task.status}`}>{taskLabels[task.status]}</span>}</span><ArrowDownRight size={13}/>
        </button>
        {expanded === agent && <div className="lm-agent-open">{task ? <>
          <TaskDetails task={task}/>
          {(task.status === "failed" || task.status === "waiting") && <button type="button" className="lm-secondary" disabled={busy} onClick={() => retry(task.id)}><RotateCcw size={14}/>重新执行</button>}
          {history.length > 1 && <details><summary>任务历史 · {history.length - 1}</summary>{history.filter(item => item.id !== task.id).map(item =>
            <details key={item.id}><summary className="lm-clamp">{item.title}</summary><TaskDetails task={item}/></details>)}</details>}
        </> : <small>当前项目还未向 {agent} 分派任务。</small>}</div>}
        </li>;
      })}</ul>
      </section>
      <form className="lm-command lm-form" onSubmit={event => { event.preventDefault(); dispatch(instruction, selectedMethod); }}>
        <label htmlFor="strategy-instruction">调度 AI 团队</label>
        <textarea id="strategy-instruction" ref={field} rows={4} value={instruction} minLength={2} maxLength={1000}
          onChange={event => setInstruction(event.target.value)} placeholder="把试卖预算调整为 8000 元，重新比较三个市场。" />
        <div className="lm-mentions" aria-label="指定顾问"><AtSign size={15}/>{agents.map(agent =>
          <button type="button" key={agent} onClick={() => focus(`@${agent} ${instruction.replace(/^@[A-Za-z]+\s*/, "")}`)}>{agent}</button>)}</div>
        {methods.length > 0 && <label>使用我的做法<select value={selectedMethod?.id ?? ""} onChange={event => setMethodId(event.target.value)}>
          <option value="">选择做法（可选）</option>
          {methods.map(method => <option key={method.id} value={method.id}>{method.name}</option>)}
        </select></label>}
        {selectedMethod && <details><summary>查看做法</summary><small>{selectedMethod.scope}</small><p>{selectedMethod.instructions}</p></details>}
        <Link href="/workspace?view=resources" className="lm-link">管理我的做法</Link>
        <button className="lm-primary" disabled={busy || instruction.trim().length < 2}><Send size={16}/>{busy ? "提交中…" : "派发指令"}</button>
      </form>
      </div>
    </details>
    </div>
  </div>;
}
