import { isDirectoryView, ModuleDirectory } from "@/components/localmate/ModuleDirectory";
import { MethodLibrary } from "@/components/localmate/MethodLibrary";
import Link from "next/link";
import { ArrowUpRight, BookOpen, FolderKanban, Layers3, Package, Plus, Sparkles } from "lucide-react";
import { LocalMateShell } from "@/components/localmate/Shell";
import { ProjectList } from "@/components/localmate/ProjectList";
import { reportTasks } from "@/lib/localmate/report-view";
import { markets } from "@/lib/localmate/mission-model";
import { getRepositories } from "@/lib/repositories";
import { publicConfigInfo } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function WorkspacePage({ searchParams }: { searchParams: Promise<{ q?: string; view?: string; mission?: string; task?: string }> }) {
  const { q = "", view, mission, task } = await searchParams;
  const { missions, products, methods, team, launch, compliance, research } = getRepositories();
  const query = q.trim();
  const board = view === "board";
  const resources = view === "resources";
  const projects = missions.list().filter(project => {
    if (!query) return true;
    const product = project.productId ? products.getById(project.productId)?.name : "";
    const market = markets.filter(item => project.markets.includes(item.code)).map(item => `${item.name} ${item.code}`).join(" ");
    return `${project.goal} ${product ?? ""} ${market}`.toLowerCase().includes(query.toLowerCase());
  });
  if (isDirectoryView(view)) {
    const items = view === "market" ? projects.map(project => {
      const path = `/workspace/${project.id}`;
      const run = reportTasks(team.list(project.id))[0]?.requestId;
      return {
        id: project.id, title: project.goal,
        status: project.markets.map(code => markets.find(item => item.code === code)?.name ?? code).join(" · ") || "待选目标市场",
        href: `${path}?view=board&step=research`, action: "查看项目研究",
        detail: run ? { label: "查看研究报告", href: `${path}?view=report&run=${run}` } : undefined,
      };
    }) : products.listRecent(100).map(product => {
      const project = projects.find(item => item.productId === product.id);
      const base = product.mode === "DEMO" ? "演示商品" : product.confirmed ? "资料已确认" : "待确认";
      const path = `/product/${product.id}`;
      if (view === "products") return { id: product.id, title: product.name, status: base,
        href: project ? `/workspace/${project.id}?edit=product` : path, action: "查看商品" };
      if (view === "compliance") return { id: product.id, title: product.name,
        status: `${base} · ${compliance.getByProduct(product.id).length} 份预检记录`,
        href: `/workspace/compliance/${product.id}`, action: "打开准入预检" };
      const drafts = launch.listByProduct(product.id);
      const run = project ? reportTasks(team.list(project.id))[0]?.requestId : undefined;
      const projectLaunch = project ? run
        ? `/workspace/${project.id}?view=report&run=${run}`
        : `/workspace/${project.id}?view=board&step=decide#proposal-versions` : undefined;
      const legacyLaunch = `/launch/${product.id}`;
      return { id: product.id, title: product.name, status: `${base} · ${drafts.length ? `${drafts.length} 份历史草稿` : run ? "可准备上架" : "暂无草稿"}`,
        href: run && projectLaunch ? `${projectLaunch}#delivery` : legacyLaunch,
        action: run ? "打开本地化上架" : drafts.length ? "编辑草稿" : "打开草稿编辑器",
        detail: run && drafts.length ? { label: "历史草稿", href: legacyLaunch } :
          !run && projectLaunch ? { label: "项目上架准备", href: projectLaunch } :
          research.getByProduct(product.id).length ? { label: "市场资料", href: `/discover/${product.id}` } : undefined };
    });
    return <LocalMateShell active={view}><ModuleDirectory view={view} items={items}/></LocalMateShell>;
  }
  const matchedProducts = query && !board && !resources
    ? products.listRecent(100).filter(product => product.name.toLowerCase().includes(query.toLowerCase()))
    : [];
  const config = publicConfigInfo();
  const fromTask = resources && mission && task ? team.list(mission).find(item => item.id === task) : undefined;
  const title = resources ? "资源中心" : board ? "出海决策" : query ? "搜索结果" : "我的项目";
  const Icon = resources ? BookOpen : board ? Layers3 : FolderKanban;
  return <LocalMateShell active={resources ? "resources" : board ? "board" : "projects"}>
    <div className="lm-heading"><div><small><Icon size={16}/> LocalMate</small><h1>{title}</h1>
      {board && <p>选择一个项目，查看团队任务与决策简报。</p>}
      {query && <p>「{query}」 · {projects.length} 个匹配项目{!board && !resources && ` · ${matchedProducts.length} 款商品`}</p>}
    </div><Link className="lm-primary" href={query ? `/?ask=${encodeURIComponent(query)}#new-project` : "/#new-project"}>{query ? <Sparkles size={17}/> : <Plus size={17}/>} {query ? "向 AI 团队提问" : "新建项目"}</Link></div>
    {resources ? <><MethodLibrary key={fromTask?.id ?? "library"} methods={methods.list()} initialInstructions={fromTask?.instruction.replace(/^@[A-Za-z]+\s*/, "")}/>
      {fromTask && <Link className="lm-link" href={`/workspace/${mission}?view=board#strategy`}>返回任务</Link>}
      <div className="lm-grid"><section className="lm-panel"><h2>商品资料</h2><p>导入 1688 商品链接、上传图片或手工录入商品。</p><Link className="lm-link" href="/workspace/import"><Package size={16}/> 打开商品导入 <ArrowUpRight size={15}/></Link></section>
      <section className="lm-panel"><h2>服务状态</h2><p>模型服务 · {config.ai.configured ? "已配置" : "待配置"}</p><p>搜索服务 · {config.search.mode}</p><Link className="lm-link" href="/api/system/status">查看服务详情 <ArrowUpRight size={15}/></Link></section></div></>
      : <>
        <ProjectList projects={projects} view={board ? "board" : "project"} heading={board ? "选择项目" : query ? "匹配项目" : "项目列表"}/>
        {matchedProducts.length > 0 && <section className="lm-panel"><h2>匹配商品</h2>
          <ul className="lm-module-list">{matchedProducts.map(product => <li key={product.id}>
            <div><h3>{product.name}</h3></div>
            <div><Link className="lm-secondary" href={`/product/${product.id}`}>查看商品 <ArrowUpRight size={15}/></Link></div>
          </li>)}</ul>
        </section>}
      </>}
  </LocalMateShell>;
}
