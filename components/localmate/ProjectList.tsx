import Link from "next/link";
import { ArrowUpRight, FolderKanban, FolderOpen } from "lucide-react";
import type { Mission } from "@/lib/localmate/mission-model";
import { getRepositories } from "@/lib/repositories";
import { projectProgress } from "@/lib/localmate/team-model";

const date = new Intl.DateTimeFormat("zh-CN", { month: "numeric", day: "numeric", timeZone: "Asia/Shanghai" });

export function ProjectList({ projects, compact = false, view = "project", heading = "我的项目" }: { projects: Mission[]; compact?: boolean; view?: "project" | "board"; heading?: string }) {
  const { team } = getRepositories();
  return <section className="lm-panel lm-projects">
    <div className="lm-section-heading"><h2>{heading}</h2>{compact && <Link className="lm-project-all" href="/workspace">查看全部 <ArrowUpRight size={15}/></Link>}</div>
    {projects.length ? <ul>{projects.map(project => {
      const { status, done, total } = projectProgress(team.list(project.id));
      return <li key={project.id}><Link href={`/workspace/${project.id}${view === "board" ? "?view=board" : ""}`} className="lm-project-row">
        <span className="lm-project-icon"><FolderKanban size={19}/></span>
        <span className="lm-project-summary"><b className="lm-clamp">{project.goal}</b>
          <span className="lm-project-meta"><time dateTime={project.updatedAt}>{date.format(new Date(project.updatedAt))} 更新</time><span className="lm-badge">{status}</span></span>
          {total > 0 && <span className="lm-project-progress"><progress value={done} max={total} aria-label="已完成任务进度"/><small>{done}/{total}</small></span>}
        </span></Link></li>;
    })}</ul> : <div className="lm-project-empty"><span className="lm-project-icon"><FolderOpen size={23}/></span><b>暂无出海项目</b>
      <p>创建项目后，可在这里查看团队进度。</p><Link className="lm-secondary" href="/#new-project">创建项目</Link></div>}
  </section>;
}
