import Image from "next/image";
import Link from "next/link";
import { Activity, ArrowRight, ArrowUpRight, CircleDollarSign, Globe2, LibraryBig } from "lucide-react";
import { DashboardAgents } from "@/components/localmate/DashboardAgents";
import { ProjectComposer } from "@/components/localmate/ProjectComposer";
import { LocalMateShell } from "@/components/localmate/Shell";
import { comparablesFor } from "@/lib/localmate/benchmarks";
import { markets } from "@/lib/localmate/mission-model";
import { reportModules, reportTasks } from "@/lib/localmate/report-view";
import { agents, currentTask, taskLabels, type TeamTask } from "@/lib/localmate/team-model";
import { getRepositories } from "@/lib/repositories";

export const dynamic = "force-dynamic";

const names = new Map(markets.map(({ code, name }) => [code, name]));
const marketName = (code: string) => names.get(code) ?? code;

function More({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link className="lm-dash-link" href={href}>{children}<ArrowUpRight size={13} aria-hidden/></Link>;
}

export default async function HomePage({ searchParams }: { searchParams: Promise<{ ask?: string }> }) {
  const { ask } = await searchParams;
  const repos = getRepositories();
  const projects = repos.missions.list();
  const project = projects[0];
  const product = project?.productId ? repos.products.getById(project.productId) : null;
  const tasks = project ? repos.team.list(project.id) : [];
  const pendingTasks = tasks.filter(task => task.status !== "completed");
  const activeCount = pendingTasks.filter(task => task.status === "queued" || task.status === "running").length;
  const latestReport = reportTasks(tasks);
  const reportRun = latestReport[0]?.requestId;
  const projectMarkets = project?.markets ?? [];
  const observations = project ? repos.observations.list(project.id).filter(item =>
    item.productId === project.productId && projectMarkets.includes(item.market)) : [];
  const scoutLinks = latestReport.filter(task => task.agent === "Scout" && task.status === "completed")
    .flatMap(task => task.result?.evidence?.filter(item => item.market && projectMarkets.includes(item.market)) ?? []);
  const evidenceCount = new Set([...observations, ...scoutLinks].map(item => item.url)).size;
  const opportunityMarkets = project
    ? projectMarkets.filter(code => comparablesFor(repos, project, code).length > 0)
    : [];
  const cost = project ? repos.missions.costs(project.id).find(item => projectMarkets.includes(item.market)) : undefined;
  const money = cost ? new Intl.NumberFormat("zh-CN", {
    style: "currency", currency: cost.currency, currencyDisplay: "code",
  }).format(cost.contributionMinor / 100) : "—";

  const path = project ? `/workspace/${project.id}` : "/workspace";
  const board = project ? `${path}?view=board` : "/workspace?view=board";
  const reportPath = reportRun ? `${path}?view=report&run=${reportRun}` : undefined;
  const marketLink = reportPath ?? (project ? `${board}&step=research` : "/workspace?view=market");
  const costLink = project ? `${board}&step=evaluate${cost ? `&market=${cost.market}` : ""}` : board;
  const taskListLink = project ? `${board}&team=1#team-tasks` : board;
  const taskLink = (task: TeamTask) => task.report && task.requestId
    ? `${path}?view=report&run=${task.requestId}`
    : taskListLink;
  const projectAction = !project ? { href: "#task-intent", label: "开始填写" } : !product?.confirmed
    ? { href: path, label: "核对商品" }
    : { href: reportPath ?? board, label: reportPath ? "查看研究报告" : "进入项目" };
  const kpis = [
    { label: "进行中的任务", value: activeCount.toString(), unit: "项", note: "未开始或执行中", icon: Activity, href: taskListLink },
    { label: "已收集证据", value: evidenceCount.toString(), unit: "条", note: "报告与项目观察 · 去重", icon: LibraryBig, href: marketLink },
    { label: "预计利润", value: money, note: cost ? "单件贡献 · 已存测算" : "暂无已存测算", icon: CircleDollarSign, href: costLink },
    { label: "市场机会", value: opportunityMarkets.length.toString(), unit: "个市场", note: "有可比线索 · 待验证", icon: Globe2, href: marketLink },
  ];

  const metrics = <section className="lm-dash-kpis" aria-label="当前项目指标">
        {kpis.map(({ label, value, unit, note, icon: Icon, href }) => <Link className="lm-panel lm-dash-kpi" href={href} key={label} data-home-card>
          <div><h2>{label}</h2><strong>{value}{unit && <small>{unit}</small>}</strong><small>{note}</small></div>
          <span className="lm-dash-icon"><Icon size={18} aria-hidden/></span>
        </Link>)}
      </section>;

  return <LocalMateShell overview overviewMetrics={metrics}>
    <div className="lm-dashboard">
      <div className="lm-overview-main">
        <section className="lm-dash-hero" aria-labelledby="lm-team-heading">
          <div className="lm-overview-team" aria-hidden="true">
            <Image src="/localmate/home-team.webp" width={1440} height={489} sizes="(max-width: 550px) 90vw, 45vw" alt="" priority/>
          </div>
          <div className="lm-overview-intro">
            <h1 id="lm-team-heading">一个人，也能拥有<span>全球商业团队</span></h1>
            <p>四位顾问，帮你研究市场、测算利润、核对准入并准备上架。</p>
          </div>
        </section>
        <ProjectComposer key={ask} initial={ask?.slice(0, 1000)}
          projects={projects.map(({ id, goal }) => ({ id, goal }))}
          products={repos.products.listRecent(100).filter(item => item.mode === "LIVE").map(({ id, name }) => ({ id, name }))}
          markets={markets}/>
        <DashboardAgents agents={agents.map(agent => {
          const task = currentTask(tasks, agent);
          const href = agent === "Scout" ? marketLink : agent === "Margin" ? costLink : undefined;
          return { agent, status: task ? taskLabels[task.status] : "暂无任务", state: task?.status, href };
        })}/>
      </div>
      <aside className="lm-overview-aside" aria-label="工作区动态">
        <section className="lm-panel lm-dash-project" aria-labelledby="lm-project-heading" data-home-card>
          <div className="lm-dash-head"><h2 id="lm-project-heading">当前项目</h2><More href="/workspace">全部项目</More></div>
          <div className="lm-dash-project-title">
            <div><h3>{product?.name ?? (project ? "市场机会项目" : "暂无出海项目")}</h3>
              {project && <p>{projectMarkets.slice(0, 3).map(marketName).join(" · ") || "待选目标市场"}{projectMarkets.length > 3 && ` 等 ${projectMarkets.length} 个市场`}</p>}
            </div>
          </div>
          <Link className="lm-dash-link lm-overview-project-action" href={projectAction.href}>{projectAction.label} <ArrowRight size={14} aria-hidden/></Link>
        </section>
        <section className="lm-panel" aria-labelledby="lm-tasks-heading" data-home-card>
          <div className="lm-dash-head"><h2 id="lm-tasks-heading">待办任务</h2><More href={taskListLink}>全部任务</More></div>
          {pendingTasks.length ? <ul className="lm-dash-tasks">{pendingTasks.slice(0, 3).map(task => <li key={task.id}>
            <Link href={taskLink(task)} title={task.title}>
              <Activity size={15} aria-hidden/><span>{task.report ? `${task.agent} · ${reportModules[task.agent]}` : task.title}</span>
              <small className={`lm-badge lm-${task.status}`}>{taskLabels[task.status]}</small>
            </Link>
          </li>)}</ul> : <p className="lm-overview-empty">暂无待办任务</p>}
        </section>
        <section className="lm-panel" aria-labelledby="lm-market-heading" data-home-card>
          <div className="lm-dash-head"><h2 id="lm-market-heading">市场洞察</h2><More href={marketLink}>查看研究</More></div>
          {opportunityMarkets.length ? <ul className="lm-overview-markets">{opportunityMarkets.slice(0, 3).map(code => <li key={code}>
            <Link href={`${board}&step=research&market=${code}`}><Globe2 size={15} aria-hidden/>{marketName(code)}<small>有可比线索</small></Link>
          </li>)}</ul> : <p className="lm-overview-empty">{evidenceCount ? "已有研究来源，待补充可比商品。" : "暂无可比市场线索"}</p>}
        </section>
      </aside>

    </div>
  </LocalMateShell>;
}
