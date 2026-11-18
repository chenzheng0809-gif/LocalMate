import { CircleAlert, FlaskConical, Layers3, Target } from "lucide-react";
import type { Approval, Proposal } from "@/lib/localmate/board";
import type { Mission } from "@/lib/localmate/mission-model";
import { legacyCountry } from "@/lib/localmate/mission-model";
import { currentGbPrecheck, projectProgress, type TeamTask } from "@/lib/localmate/team-model";
import Link from "next/link";
import { getRepositories } from "@/lib/repositories";

const asMoney = (value: number, currency = "CNY") => new Intl.NumberFormat("zh-CN", { style: "currency", currency }).format(value / 100);

export function DecisionBrief({ mission, productName, procurementPrice, scope, tasks, proposals, approvals, currentIds }: {
  mission: Mission; productName?: string; procurementPrice?: number | null; scope: { code: string; name: string }[]; tasks: TeamTask[];
  proposals: Proposal[]; approvals: Approval[]; currentIds: string[];
}) {
  const repos = getRepositories();
  const costs = repos.missions.costs(mission.id);
  const budget = repos.team.budget(mission.id);
  const product = mission.productId ? repos.products.getById(mission.productId) : null;
  const gbPrecheck = product && currentGbPrecheck(tasks, product);
  const analyses = scope.map(({ code, name }) => {
    const country = legacyCountry(code);
    const proposal = proposals.find(item => item.snapshot.market === code);
    const cost = costs.find(item => item.market === code);
    const research = mission.productId && country ? repos.research.get(mission.productId, country) : null;
    const compliance = mission.productId && country ? repos.compliance.get(mission.productId, country) : null;
    const observations = research?.dataMode !== "DEMO" ? research : null;
    const check = compliance?.dataMode !== "DEMO" ? compliance : null;
    const scout = tasks.find(task => task.agent === "Scout" && task.result?.evidence?.some(item => item.market === code));
    const references = [
      ...(proposal?.snapshot.evidence ?? []).map(item => ({ title: item.title, url: item.url })),
      ...(scout?.result?.evidence?.filter(item => item.market === code) ?? []),
    ];
    const location = tasks.find(task => task.agent === "Localizer" && task.status === "completed" && task.markets.includes(code));
    const scopeSummary = observations?.demandSignals.level !== "NOT_ENOUGH_DATA" ? observations?.demandSignals.summary : null;
    const precheck = code === "GB" ? gbPrecheck : null;
    const benchmark = repos.benchmarks.get(mission.id, code, mission.productId);
    const costOutdated = !!cost && (cost.benchmark?.url !== benchmark?.url || cost.benchmark?.selectedAt !== benchmark?.selectedAt);
    return { code, name, proposal, cost, benchmark, costOutdated, check, precheck, references: [...new Map(references.map(item => [item.url, item])).values()],
      demand: scopeSummary || (references.length ? "已收集市场线索，需求强度待核验" : "待核验"),
      localization: observations?.narrative.localizationNotes.slice(0, 2).join("；") || (location ? "已有卖点草稿，落地难度待核验" : "待核验"),
      actions: [!references.length && "核验需求与竞品", !cost && "补充同口径报价", check?.status !== "PRECHECK_COMPLETE" && "补充准入资料",
        !location && "验证本地卖点"].filter(Boolean).join(" · ") || "复查实测转化和成本假设",
    };
  });
  const progress = projectProgress(tasks);
  const current = new Set(currentIds);
  const status = progress.total && (progress.state === "running" || progress.state === "queued") ? progress.status :
    approvals.some(approval => current.has(approval.proposalId)) ? "已记录准备授权" : current.size ? "待确认" : progress.status;
  const candidates = analyses.filter(item => item.proposal?.snapshot.pilotGate?.status === "READY_FOR_PILOT" && current.has(item.proposal.id) && item.cost &&
    item.cost.version === item.proposal.snapshot.cost?.version && (item.proposal.snapshot.budgetMinor ?? null) === budget)
    .sort((a, b) => b.cost!.valuation.contributionCnyMinor - a.cost!.valuation.contributionCnyMinor);
  const recommendation = candidates[0];
  return <>
    <section className="lm-panel lm-brief">
      <div className="lm-section-heading"><h2><Layers3 size={19}/> 决策简报</h2><span className="lm-badge">{status}</span></div>
      <h3>{mission.goal}</h3>
      <dl className="lm-brief-meta">
        <div><dt>当前项目</dt><dd>{productName ?? "机会筛选"}</dd></div>
        <div><dt>目标市场</dt><dd>{scope.map(item => item.name).join("、") || "待选择"}</dd></div>
        <div><dt>试卖预算</dt><dd>{budget === null ? "待补充" : asMoney(budget)}</dd></div>
        {procurementPrice != null && <div><dt>单件采购报价</dt><dd>{asMoney(Math.round(procurementPrice * 100))}</dd></div>}
      </dl>
      {analyses.length ? <div className="lm-table-scroll" tabIndex={0} aria-label="方案对比">
        <table className="lm-comparison"><thead><tr><th scope="col">对比维度</th>{analyses.map(item => <th scope="col" key={item.code}>{item.name}{item.proposal && <small>方案 V{item.proposal.version}{!current.has(item.proposal.id) && " · 待更新"}</small>}</th>)}</tr></thead>
          <tbody>
            <tr><th scope="row">需求机会</th>{analyses.map(item => <td key={item.code}>{item.demand}</td>)}</tr>
            <tr><th scope="row">对标商品</th>{analyses.map(({ code, benchmark }) => <td key={code}>{benchmark
              ? <><a className="lm-link" href={benchmark.url} target="_blank" rel="noreferrer">{benchmark.title}</a>
                {benchmark.notes && <small>{benchmark.notes}</small>}</>
              : <Link className="lm-link" href={`/workspace/${mission.id}?view=board&step=research&market=${code}`}>去选对标</Link>}</td>)}</tr>
            <tr><th scope="row">预计单件贡献</th>{analyses.map(({ code, cost, costOutdated }) => <td key={code}>{costOutdated
              ? <Link className="lm-link" href={`/workspace/${mission.id}?view=board&step=evaluate&market=${code}`}>对标已变更，重新测算</Link>
              : cost ? <><strong>{asMoney(cost.contributionMinor, cost.currency)}</strong>
              <details><summary>成本 V{cost.version} 与假设</summary><p>{cost.source}</p><small>成交价 {asMoney(cost.inputMinor.price, cost.currency)}，扣除采购、物流、渠道费、税费及获客费用。</small></details></> : "待测算"}</td>)}</tr>
            <tr><th scope="row">风险与准入</th>{analyses.map(item => <td key={item.code}>{item.check?.statusReason ?? (item.precheck
              ? <a className="lm-link" href={`/workspace/${mission.id}?view=board&step=evaluate#gb-compliance-precheck`}>{item.precheck.answer} · 查看预检</a> : "待核验")}</td>)}</tr>
            <tr><th scope="row">本土化难度</th>{analyses.map(item => <td key={item.code}>{item.localization}</td>)}</tr>
            <tr><th scope="row">核心依据</th>{analyses.map(item => <td key={item.code}>{item.references.length ? <ul>{item.references.slice(0, 3).map(source =>
              <li key={source.url}><a href={source.url} className="lm-link lm-clamp" target="_blank" rel="noreferrer">{source.title}</a></li>)}</ul> : "待核验"}</td>)}</tr>
            <tr><th scope="row">下一步验证</th>{analyses.map(item => <td key={item.code}>{item.actions}</td>)}</tr>
          </tbody></table>
      </div> : <div className="lm-decision-empty"><Target size={24}/><p>先在项目中选择要比较的市场。</p><Link href={`/workspace/${mission.id}`} className="lm-link">设置目标市场</Link></div>}
    </section>
    <section className="lm-panel lm-recommendation">
      <h2><FlaskConical size={18}/> 董事会建议</h2>
      <h3>{recommendation ? `优先准备${recommendation.name}试卖方案` : "先补齐决策依据，再选择试卖市场"}</h3>
      {recommendation ? <p>基于方案 V{recommendation.proposal!.version} 的可追溯证据、准入预检与单件贡献 {asMoney(recommendation.cost!.valuation.contributionCnyMinor)}。</p>
        : <p>当前记录尚不足以确定优先市场。可先批准指定版本的内部准备清单。</p>}
      <ul className="lm-recommendation-gaps">{analyses.map(item => <li key={item.code}><CircleAlert size={15}/><span><b>{item.name}</b> · {(item.proposal && current.has(item.proposal.id) && item.proposal.snapshot.pilotGate?.reasons.join(" ")) || item.actions}</span></li>)}</ul>
      <div className="lm-actions">
        <Link className="lm-secondary" href={`/workspace/${mission.id}?view=board&step=evaluate`}>回到利润与风险</Link>
        <a className="lm-secondary" href="#proposal-versions">查看方案与执行清单</a>
      </div>
    </section>
  </>;
}
