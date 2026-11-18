import Link from "next/link";
import { notFound } from "next/navigation";
import { LocalMateShell } from "@/components/localmate/Shell";
import { TeamBoard } from "@/components/localmate/TeamBoard";
import { ComplianceDesk } from "@/components/localmate/ComplianceDesk";
import { markets } from "@/lib/localmate/mission-model";
import { defaultMexicoMarketplace, reportMarkets } from "@/lib/localmate/report-model";
import { reportSummary, reportTasks } from "@/lib/localmate/report-view";
import { isFanReview, reviewSources } from "@/lib/localmate/compliance-review";
import { getRepositories } from "@/lib/repositories";

export const dynamic = "force-dynamic";

export default async function ComplianceDeskPage({ params, searchParams }: {
  params: Promise<{ id: string }>; searchParams: Promise<{ market?: string; mission?: string }>;
}) {
  const { id } = await params;
  const { market, mission } = await searchParams;
  const repos = getRepositories();
  const product = repos.products.getById(id);
  if (!product) notFound();
  const project = repos.missions.list().find(item => item.productId === id && (!mission || item.id === mission));
  const selected = reportMarkets.find(code => code === market) ?? reportMarkets.find(code => project?.markets[0] === code) ?? "MX";
  const name = markets.find(item => item.code === selected)?.name ?? selected;
  const tasks = project ? repos.team.list(project.id) : [];
  const selectedTasks = reportTasks(tasks);
  const latest = selectedTasks[0]?.report;
  const report = reportSummary(selectedTasks);
  const marketplace = latest?.mexicoMarketplace ?? defaultMexicoMarketplace(project?.goal ?? "");
  const projectLink = project ? `/workspace/${project.id}` : `/product/${id}`;
  const materialsReady = Boolean(project && report?.done && latest?.productUpdatedAt === product.updatedAt &&
    report.markets.some(item => item.code === selected) && selectedTasks[0]?.requestId);
  const next = materialsReady
    ? `${projectLink}?view=report&run=${selectedTasks[0]?.requestId}&market=${selected}#admission-materials`
    : project ? `${projectLink}${product.confirmed ? "" : "?edit=product"}`
      : `/?ask=${encodeURIComponent(product.name)}#new-project`;
  const desk = <ComplianceDesk key={`${selected}:${product.updatedAt}`} productId={id} revision={product.updatedAt}
    confirmed={product.confirmed} market={selected} name={name} next={next} materialsReady={materialsReady}
    marketplace={marketplace} sources={reviewSources(selected, marketplace, isFanReview(product))}/>;
  return <LocalMateShell active="compliance">
    <div className="lm-heading"><div><small>合规中心</small><h1>{product.name}</h1></div>
      <Link className="lm-link" href={projectLink}>查看商品资料</Link>
    </div>
    <nav className="lm-benchmark-markets" aria-label="选择合规市场">
      {reportMarkets.map(code => <Link key={code} href={`?market=${code}${project ? `&mission=${project.id}` : ""}`}
        aria-current={code === selected ? "true" : undefined}>{markets.find(item => item.code === code)?.name ?? code}</Link>)}
    </nav>
    {project ? <TeamBoard missionId={project.id} initialTasks={tasks} updatedAt={project.updatedAt}
      actions={[]} methods={repos.methods.list().filter(method => method.enabled)} openTeam sideTools>
      {desk}
    </TeamBoard> : <>{desk}<Link className="lm-secondary" href={`/?ask=${encodeURIComponent(product.name)}#new-project`}>建立项目以派发指令</Link></>}
    {repos.compliance.getByProduct(id).length > 0 && <Link className="lm-link" href={`/compliance/${id}`}>查看历史预检记录</Link>}
  </LocalMateShell>;
}
