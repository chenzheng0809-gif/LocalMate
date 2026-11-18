import { ConfirmProjectProduct, ImportProjectProduct, PlanResearch, SaveCandidate, ScoutProgress } from "@/components/localmate/ProjectPreparation";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Boardroom, LinkProduct, QuickCost } from "@/components/localmate/MissionActions";
import { LocalMateShell } from "@/components/localmate/Shell";
import { MarketObservations } from "@/components/localmate/MarketObservations";
import { CompliancePrecheckPanel } from "@/components/localmate/CompliancePrecheck";
import { supportsGbPrecheck } from "@/lib/localmate/compliance-kb";
import { currentGbPrecheck, GB_PREFLIGHT_INSTRUCTION } from "@/lib/localmate/team-model";
import { DecisionBrief } from "@/components/localmate/DecisionBrief";
import { TeamBoard } from "@/components/localmate/TeamBoard";
import { legacyCountry, markets } from "@/lib/localmate/mission-model";
import { shopifyTestShop } from "@/lib/localmate/shopify";
import { comparablesFor } from "@/lib/localmate/benchmarks";
import { highSales, marketSamples, sampleDescription } from "@/lib/localmate/market-samples";
import { AgentAtWork } from "@/components/localmate/AgentAtWork";
import { CompetitorShortlist } from "@/components/localmate/CompetitorShortlist";
import { reportDimensions, reportMarkets } from "@/lib/localmate/report-model";
import { reportTasks } from "@/lib/localmate/report-view";
import { MarketReport } from "@/components/localmate/MarketReport";
import { getRepositories } from "@/lib/repositories";

export const dynamic = "force-dynamic";

const money = new Intl.NumberFormat("zh-CN", { style: "currency", currency: "CNY" });
const stamp = new Intl.DateTimeFormat("zh-CN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Shanghai" });
const boardSteps = [
  { id: "research", title: "选市场与竞品" },
  { id: "evaluate", title: "对标测算" },
  { id: "decide", title: "是否试卖" },
] as const;

function safeLink(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

export default async function MissionPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ view?: string; step?: string; team?: string; market?: string; run?: string; edit?: string }> }) {
  const { id } = await params;
  const { view, step: requestedStep, team, market: requestedMarket, run, edit } = await searchParams;
  const repos = getRepositories();
  const mission = repos.missions.get(id);
  if (!mission) notFound();
  const product = mission.productId ? repos.products.getById(mission.productId) : null;
  const tasks = repos.team.list(id);
  const latestReport = reportTasks(tasks);
  if (view === "report") {
    const selected = reportTasks(tasks, run);
    const requestId = selected[0]?.requestId;
    if (!requestId) notFound();
    return <LocalMateShell active="board">
      <div className="lm-heading"><h1>研究与交付</h1><Link className="lm-link" href={`/workspace/${id}`}>返回项目</Link></div>
      <TeamBoard missionId={id} initialTasks={tasks} updatedAt={mission.updatedAt} actions={[]} openTeam sideTools
        methods={repos.methods.list().filter(method => method.enabled)}>
      <MarketReport key={requestId} missionId={id} run={requestId} initialTasks={selected} requestedMarket={requestedMarket}
        costs={selected[0]?.report?.productUpdatedAt === product?.updatedAt ? repos.missions.costs(id) : []}/>
      </TeamBoard>
    </LocalMateShell>;
  }
  const proposals = repos.board.list(id);
  const observations = repos.observations.list(id);
  const observationPanel = <MarketObservations missionId={id} markets={markets.filter(market => mission.markets.includes(market.code))} observations={observations}/>;
  if (view !== "board") {
    const plan = repos.missions.plan(id);
    const productFirst = mission.direction === "product_to_market";
    const confirmed = product?.confirmed === true;
    const scout = tasks.find(task => task.agent === "Scout" && !task.method && task.markets.length > 0 && task.markets.every(code => mission.markets.includes(code)));
    const showProduct = !!product && (!confirmed || edit === "product" ||
      (productFirst && (!reportDimensions(product.attributes.dimensions) || !reportDimensions(product.attributes.packagingDimensions) ||
        product.attributes.weight == null || product.sourcing.priceCNY == null)));
    const existingRun = latestReport[0];
    const canResume = productFirst && !showProduct && Boolean(existingRun?.requestId && existingRun.report?.productUpdatedAt === product?.updatedAt);
    const researchForm = ((confirmed && !showProduct) || !productFirst) && <PlanResearch
      key={mission.revision} mission={mission} plan={plan}
      markets={productFirst ? reportMarkets.flatMap(code => markets.find(market => market.code === code) ?? []) : markets}
      budget={repos.team.budget(id)} previousMexicoMarketplace={existingRun?.report?.mexicoMarketplace}/>;
    return <LocalMateShell active="projects">
      <div className="lm-heading">
        <div><small>{productFirst ? "从商品找市场" : "从市场找商品"}</small><h1>{product?.name ?? "市场机会项目"}</h1>
          <p>{mission.goal}</p></div>
        <Link className="lm-link" href="/workspace">返回项目列表</Link>
      </div>
      {showProduct && <ConfirmProjectProduct key={`${product.id}:${product.updatedAt}`} product={product} requireSpecs={productFirst}/>}
      {!confirmed || showProduct || !productFirst ? <details className="lm-panel">
        <summary>使用 1688、淘宝或天猫链接自动录入</summary>
        <ImportProjectProduct mission={mission} existingSource={product?.sourceUrl} confirmed={confirmed}/>
      </details> : <section className="lm-panel lm-form">
        <p>商品参数已确认 · {product?.name} · {product?.attributes.dimensions}</p>
        <Link className="lm-link" href={`/workspace/${id}?edit=product`}>编辑商品参数或从链接更新</Link>
      </section>}
      {canResume && existingRun?.requestId ? <section className="lm-panel lm-form">
        <h2>继续研究与交付</h2>
        <Link className="lm-primary" href={`/workspace/${id}?view=report&run=${existingRun.requestId}`}>打开报告和交付文件</Link>
        <details><summary>调整市场并重新研究</summary>{researchForm}</details>
      </section> : researchForm}
      {productFirst && !canResume && existingRun?.requestId && <Link className="lm-link"
        href={`/workspace/${id}?view=report&run=${existingRun.requestId}`}>查看上一版报告</Link>}
      {!productFirst && scout && <ScoutProgress mission={mission} task={scout}/>}
      <details className="lm-panel"><summary>补充市场来源</summary>{observationPanel}</details>
      {!product && !productFirst && mission.markets.length > 0 && <SaveCandidate mission={mission}
        procurementLimit={plan?.procurementLimit ?? null}/>}
      {(productFirst ? !!latestReport.length : !!product) && <div className="lm-actions">
        {!productFirst && <Link className="lm-primary" href={`/workspace/${id}?view=board`}>打开试卖工作台</Link>}
        {confirmed && <Link className="lm-link" href={`/product/${product.id}`}>查看完整商品资料</Link>}
      </div>}
    </LocalMateShell>;
  }
  const projectPath = `/workspace/${id}`;
  const boardPath = `${projectPath}?view=board`;
  const guidedReportUrl = latestReport[0]?.requestId ? `${projectPath}?view=report&run=${latestReport[0].requestId}` : undefined;
  const comparison = mission.markets.flatMap(code => markets.find(market => market.code === code) ?? []);
  const canEvaluate = !!product?.confirmed && comparison.length > 0;
  const gbPrecheckAvailable = !!product && supportsGbPrecheck(product) && mission.markets.includes("GB");
  const gbPrecheck = gbPrecheckAvailable ? currentGbPrecheck(tasks, product) : undefined;
  const costs = repos.missions.costs(id);
  const approvals = repos.board.approvals(id);
  const currentIds = canEvaluate ? proposals.filter(proposal =>
    mission.markets.includes(proposal.snapshot.market) && repos.board.isCurrent(proposal),
  ).map(proposal => proposal.id) : [];
  const approved = approvals.filter(item => currentIds.includes(item.proposalId));
  const marketSummaries = comparison.map(market => {
    const country = legacyCountry(market.code);
    const research = country && product ? repos.research.get(product.id, country) : null;
    const check = country && product ? repos.compliance.get(product.id, country) : null;
    const scout = tasks.find(task => task.agent === "Scout" &&
      task.result?.evidence?.some(item => item.market === market.code && item.origin !== "USER_INPUT"));
    const sources = [
      ...observations.filter(item => item.market === market.code && item.productId === (product?.id ?? null))
        .map(item => ({ title: item.title, url: item.url, note: `用户提供 · ${item.observedAt} · ${item.excerpt}` })),
      ...(research && research.dataMode !== "DEMO" ? repos.evidence.getByIds(research.evidenceIds)
        .filter(item => item.country === country && item.kind === "MARKET" && item.origin !== "MODEL_INFERENCE")
        .map(item => ({ title: item.sourceTitle, url: item.sourceUrl, note: item.relevantExcerpt })) : []),
      ...(scout?.result?.evidence ?? []).filter(item => item.market === market.code && item.origin !== "USER_INPUT"),
    ].flatMap(item => {
      const url = safeLink(item.url);
      return url ? [{ ...item, url }] : [];
    });
    const samples = product ? marketSamples(product.name, market.code) : [];
    const links = [...new Map(sources.flatMap(item => {
      const sample = samples.find(sample => sample.url === item.url);
      return !sample ? [item] : highSales(sample) ? [{ ...item, note: sampleDescription(sample) }] : [];
    }).map(item => [item.url, item])).values()];
    return {
      ...market, links, candidates: comparablesFor(repos, mission, market.code),
      benchmark: repos.benchmarks.get(mission.id, market.code, product?.id ?? null),
      cost: costs.find(cost => cost.market === market.code),
      check: check?.dataMode === "DEMO" ? null : check,
      precheck: market.code === "GB" ? gbPrecheck : undefined,
    };
  });
  const withSources = marketSummaries.filter(market => market.links.length || market.candidates.length).length;
  const withCosts = marketSummaries.filter(market => market.cost).length;
  const focused = marketSummaries.find(item => item.code === requestedMarket) ??
    marketSummaries.find(item => item.benchmark) ?? marketSummaries.find(item => item.candidates.length) ?? marketSummaries[0];
  const costMatchesBenchmark = focused?.cost?.benchmark?.url === focused?.benchmark?.url &&
    focused?.cost?.benchmark?.selectedAt === focused?.benchmark?.selectedAt;
  const canDecide = focused?.benchmark && focused.cost && costMatchesBenchmark && (focused.check || focused.precheck);
  const recommended = !canEvaluate ? "research" : approved.length || canDecide ? "decide" :
    focused?.benchmark || marketSummaries.some(market => market.precheck) ? "evaluate" : "research";
  const marketQuery = focused ? `&market=${focused.code}` : "";
  const selectedStage = boardSteps.find(item => item.id === requestedStep);
  const stage = selectedStage ?? boardSteps.find(item => item.id === recommended) ?? boardSteps[0];
  const files = repos.team.files(id);
  const actionForStage = stage.id === "research" && focused && (canEvaluate || !product)
    ? [{ agent: "Scout" as const, label: `查找${focused.name}竞品`, instruction: `@Scout 核查 ${focused.code} 的可比商品、售价和上架渠道。`, markets: [focused.code] }]
    : stage.id === "evaluate" && canEvaluate && focused ? [
      { agent: "Guard" as const, label: `核查${focused.name}准入`, instruction: `@Guard 核查 ${focused.code} 的合规要求`, markets: [focused.code] },
      ...(gbPrecheckAvailable && focused.code === "GB" ? [{ agent: "Guard" as const, label: "运行英国 Amazon UK 合规预检", instruction: GB_PREFLIGHT_INSTRUCTION, markets: ["GB"], exact: true }] : []),
    ] : [];
  const descriptions = {
    research: !mission.markets.length ? "先确定要比较的市场，再收集需求、竞品和售价证据。" :
      `${withSources}/${comparison.length} 个市场已有来源。按页面销量筛选竞品，再对比定位和挂牌价。`,
    evaluate: focused?.benchmark ? `用「${focused.benchmark.title}」的挂牌价做参考，填写你的成交价和实际成本。` : "选一个同市场竞品，再用它的挂牌价做参考。",
    decide: "比较市场，选择一个准备方案，并跟踪已授权的内部工作。",
  };

  return <LocalMateShell active="board">
    <div className="lm-heading">
      <div><small>AI 董事会</small><h1>{product?.name ?? "市场机会项目"}</h1>
        <p>{mission.goal} · {comparison.length ? comparison.map(item => item.name).join("、") : "待选市场"}</p></div>
      <Link className="lm-link" href={projectPath}>编辑商品与目标市场</Link>
    </div>
    <nav className="lm-board-steps" aria-label="董事会流程">
      {boardSteps.map(({ id: stepId, title }, index) => <Link
        key={stepId} href={`${boardPath}&step=${stepId}${marketQuery}`} aria-current={stage.id === stepId ? "step" : undefined}>
        <span>{index + 1}</span><strong>{title}</strong>
      </Link>)}
    </nav>
    <section className="lm-panel lm-board-stage">
      <div><h2>{stage.title}</h2><p>{descriptions[stage.id]}</p></div>
      {!canEvaluate
        ? <Link className="lm-primary" href={projectPath}>{!product ? "关联商品" : !product.confirmed ? "确认商品资料" : "设置目标市场"}</Link>
        : stage.id !== recommended && <Link className="lm-secondary" href={`${boardPath}&step=${recommended}${marketQuery}`}>建议先{boardSteps.find(item => item.id === recommended)?.title}</Link>}
    </section>
    {stage.id !== "decide" && marketSummaries.length > 0 && <nav className="lm-benchmark-markets" aria-label="选择目标市场">
      {marketSummaries.map(item => <Link key={item.code} href={`${boardPath}&step=${stage.id}&market=${item.code}`}
        aria-current={item.code === focused?.code ? "true" : undefined}>
        <strong>{item.name}</strong><small>{item.benchmark ? "已选对标" : `${item.candidates.filter(highSales).length} 个候选`}</small>
      </Link>)}
    </nav>}
    <TeamBoard sideTools key={id} missionId={id} initialTasks={tasks} updatedAt={mission.updatedAt} actions={actionForStage} openTeam={team === "1"} defaultStep={selectedStage ? undefined : stage.id}
      methods={repos.methods.list().filter(method => method.enabled)}>
      {stage.id === "research" && <>
        {focused && <>
          {guidedReportUrl && <Link className="lm-link" href={`${guidedReportUrl}${marketQuery}`}>返回研究与交付</Link>}
          <CompetitorShortlist key={focused.code} missionId={id} market={focused} candidates={focused.candidates} selected={focused.benchmark}
            researching={tasks.some(task => task.agent === "Scout" && task.status === "running" && task.markets.includes(focused.code))}/>
          <MarketObservations key={focused.code} missionId={id} markets={[focused]}
            observations={observations.filter(item => item.market === focused.code)}/>
          {focused.links.length > 0 && <details className="lm-panel">
            <summary>市场来源与需求线索 · {focused.links.length}</summary>
            <ul className="lm-list">{focused.links.map(item => <li key={item.url}>
              <a className="lm-link" href={item.url} target="_blank" rel="noreferrer">{item.title}</a>
              {item.note && <small>{item.note}</small>}
            </li>)}</ul>
          </details>}
        </>}
      </>}
      {stage.id === "evaluate" && canEvaluate && <>
          <section className="lm-panel lm-form" id="project-cost">
            <div className="lm-section-heading lm-agent-header"><div><h3>算一件能赚多少</h3>
              {guidedReportUrl && <Link className="lm-link" href={`${guidedReportUrl}${marketQuery}`}>返回研究与交付</Link>}</div>
              <AgentAtWork agent="Margin" busy={tasks.some(task => task.agent === "Margin" && task.status === "running" &&
                (!focused || task.markets.includes(focused.code)))}/>
            </div>
            <p>用同一币种填写售价和成本。没有对应费用时填 0。</p>
            {focused?.benchmark ? <div className="lm-benchmark-reference">
              <strong>对标商品</strong>
              <a className="lm-link" href={focused.benchmark.url} target="_blank" rel="noreferrer">{focused.benchmark.title}</a>
              {focused.benchmark.notes && <small>{focused.benchmark.notes}</small>}
              <Link className="lm-link" href={`${boardPath}&step=research${marketQuery}`}>更换对标</Link>
            </div> : <Link className="lm-link" href={`${boardPath}&step=research${marketQuery}`}>去选择对标商品</Link>}
            {focused?.cost && !costMatchesBenchmark && <p>已有测算使用旧的对标依据，请核对后重新保存。</p>}
            <QuickCost key={`${mission.revision}:${focused?.code}`} mission={mission}
              markets={focused ? [focused] : comparison} benchmark={focused?.benchmark} saved={costMatchesBenchmark ? focused?.cost : undefined}
              preferMxn={focused?.code === "MX" && latestReport[0]?.report?.mexicoMarketplace === "mercado_libre"} />
            {!!withCosts && <ul className="lm-list">{marketSummaries.flatMap(({ cost, name }) => cost ? [<li key={cost.version}>
              <b>{name} · 单件贡献 {new Intl.NumberFormat("zh-CN", { style: "currency", currency: cost.currency }).format(cost.contributionMinor / 100)}</b>
              {cost.currency !== "CNY" && <small>折合 {money.format(cost.valuation.contributionCnyMinor / 100)} · {cost.valuation.fxSource}</small>}
              {(cost.valuation.lowContributionMinor !== null || cost.valuation.highContributionMinor !== null) && <small>
                低价／高价贡献 · {cost.currency} {cost.valuation.lowContributionMinor === null ? "—" : (cost.valuation.lowContributionMinor / 100).toFixed(2)}
                {" / "}{cost.valuation.highContributionMinor === null ? "—" : (cost.valuation.highContributionMinor / 100).toFixed(2)}
              </small>}
              {cost.valuation.breakEvenUnits !== undefined && <small>
                {cost.valuation.breakEvenUnits === null ? "单件贡献非正，无法达到盈亏平衡。" : `盈亏平衡 ${cost.valuation.breakEvenUnits} 件`}
              </small>}
              <small>成本 V{cost.version} · {cost.source} · {stamp.format(new Date(cost.createdAt))}</small>
            </li>] : [])}</ul>}
          </section>
          <section className="lm-panel lm-form" id="project-risks">
            <h3>哪些风险还要核实</h3>
            <ul className="lm-list">{marketSummaries.map(market => <li key={market.code}>
              <b>{market.name}</b>
              <p>{market.precheck?.answer ?? market.check?.statusReason ??
                "需专业复核"}</p>
              <Link className="lm-link" href={`/workspace/compliance/${product!.id}?market=${market.code}&mission=${id}`}>核对准入材料</Link>
              {market.precheck && <a className="lm-link" href="#gb-compliance-precheck">查看原文与缺件</a>}
              {!!market.check?.missingAttributes.length && <small>{market.check.missingAttributes.join("、")}</small>}
            </li>)}</ul>
          </section>
        {gbPrecheck && <CompliancePrecheckPanel check={gbPrecheck}/>}
        <div className="lm-actions">
          {guidedReportUrl && focused?.cost && <Link className="lm-primary" href={`${guidedReportUrl}${marketQuery}#delivery`}>下一步 · 生成文件</Link>}
          <Link className={guidedReportUrl ? "lm-secondary" : "lm-primary"} href={`${boardPath}&step=decide${marketQuery}`}>比较结果并选方案</Link>
        </div>
      </>}
      {stage.id === "decide" && canEvaluate && <>
        <DecisionBrief mission={mission} productName={product?.name} procurementPrice={product?.sourcing.priceCNY}
          scope={comparison} tasks={tasks} proposals={proposals} approvals={approvals} currentIds={currentIds}/>
        <Boardroom key={focused?.code} missionId={id} markets={comparison} defaultMarket={focused?.code} shopifyShop={shopifyTestShop()}
          proposals={proposals} approvals={approvals} currentIds={currentIds} />
      </>}
      {files.length > 0 && <details className="lm-panel"><summary>项目附件 · {files.length}</summary>
          <ul className="lm-list">{files.map(file => <li key={file.requestId}>
            <a className="lm-link" href={`/api/localmate/missions/${id}/tasks?file=${file.requestId}`} download>{file.name}</a>
          </li>)}</ul>
        </details>}
    </TeamBoard>
    {!product && <section className="lm-panel"><h3>关联已有商品</h3><LinkProduct mission={mission}
      products={repos.products.listRecent(100).filter(item => item.mode === "LIVE").map(({ id, name }) => ({ id, name }))}/></section>}
  </LocalMateShell>;
}
