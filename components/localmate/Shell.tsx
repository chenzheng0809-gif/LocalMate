import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowRight, Bell, ChartNoAxesCombined, Globe2, House, Package, Rocket, Search, ShieldCheck, Sparkles } from "lucide-react";
import { getRepositories } from "@/lib/repositories";
import { taskLabels } from "@/lib/localmate/team-model";

const menu = [
  ["home", "/", "工作台", House],
  ["products", "/workspace?view=products", "商品档案", Package],
  ["market", "/workspace?view=market", "市场研究", Globe2],
  ["board", "/workspace?view=board", "出海决策", ChartNoAxesCombined],
  ["compliance", "/workspace?view=compliance", "合规中心", ShieldCheck],
  ["launch", "/workspace?view=launch", "上架工作台", Rocket],
] as const;

export function LocalMateShell({ children, active = "home", overview = false, overviewMetrics }: {
  children: ReactNode; active?: string; overview?: boolean; overviewMetrics?: ReactNode;
}) {
  const repos = getRepositories();
  const updates = repos.missions.list().slice(0, 10).flatMap(mission => repos.team.list(mission.id).slice(0, 2))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 5);
  const navigation = <nav aria-label="主导航">{menu.map(([key, href, label, Icon]) =>
          <Link key={key} href={href} aria-current={key === active ? "page" : undefined}>{overview && <Icon size={18} aria-hidden/>}{label}</Link>)}</nav>;
  const profile = <Link className="lm-account-card" href="/workspace?view=resources" aria-label="出小海，Pro Plan，打开工作区资源">
    <span className="lm-account-avatar"><Image src="/localmate/default-profile.webp" alt="" width={280} height={256} unoptimized/></span>
    <span><strong>出小海</strong><small>Pro Plan</small></span>
  </Link>;
  return <div className={overview ? "lm-shell lm-v3 lm-v3-overview" : "lm-shell lm-v3"}><div className="lm-frame">
    <header className="lm-v3-header">
      <div className="lm-v3-header-inner">
        <Link href="/" className="lm-brand" aria-label="LocalMate 工作台">
          <span className="lm-brand-image">
            <Image src="/localmate/brand-transparent.webp" width={800} height={172} alt="LocalMate" priority unoptimized/>
          </span>
        </Link>
        {!overview && navigation}
        <div className="lm-v3-tools">
          <form className="lm-search" action="/workspace">
            <Search size={16} aria-hidden/><input name="q" type="search" aria-label="搜索项目、商品或市场" placeholder="搜索项目、商品或市场" maxLength={100}/>
            <button type="submit" aria-label="搜索"><ArrowRight size={15}/></button>
          </form>
          <details className="lm-notifications">
            <summary className="lm-icon-button" aria-label="任务通知"><Bell size={17}/>{updates.length > 0 && <i/>}</summary>
            <div className="lm-popover"><b>任务动态</b>{updates.length ? <ul className="lm-list">{updates.map(task =>
              <li key={task.id}><Link href={`/workspace/${task.missionId}?view=board&team=1#team-tasks`}>{task.agent} · {taskLabels[task.status]}<small className="lm-clamp">{task.title}</small></Link></li>)}</ul> : <p>暂无通知</p>}</div>
          </details>
          {overview && <a className="lm-primary lm-overview-new" href="#task-intent"><Sparkles size={16} aria-hidden/>开始新任务</a>}
        </div>
      </div>
    </header>
    {overview && <div className="lm-overview-nav">{navigation}</div>}
    <div className="lm-content">{children}</div>
    {overview && <footer className="lm-overview-footer">{profile}{overviewMetrics}</footer>}
  </div></div>;
}
