import type { CompliancePrecheck } from "@/lib/localmate/compliance-kb";

const classifications = {
  insufficient_scope: "超出试点范围",
  insufficient_data: "资料不足",
  source_pending: "来源待补",
  pending_human_review: "需专业复核",
  not_applicable: "按已声明事实不适用",
};

export function CompliancePrecheckPanel({ check }: { check: CompliancePrecheck }) {
  const gaps = [...new Map(check.missing_facts.map(item => [item.fact, item])).values()];
  const documents = [...new Map(check.missing_evidence.map(item => [item.evidence_id, item])).values()];
  return <section className="lm-panel lm-form" id="gb-compliance-precheck">
    <div className="lm-section-heading"><h2>英国 Amazon UK 合规预检</h2><span className="lm-badge">需专业复核</span></div>
    <p>{check.answer} · 截至 <time dateTime={check.as_of}>{check.as_of}</time></p>
    {check.channel_policy_status === "not_loaded" && <p>待补 Amazon UK 卖家后台政策导出。</p>}
    {gaps.length > 0 && <details open><summary>待确认的商品事实 · {gaps.length}</summary>
      <ul className="lm-list">{gaps.map(item => <li key={item.fact}>{item.question}</li>)}</ul>
    </details>}
    {documents.length > 0 && <details open><summary>待提供的文件 · {documents.length}</summary>
      <ul className="lm-list">{documents.map(item => <li key={item.evidence_id}>{item.description || item.evidence_id}</li>)}</ul>
    </details>}
    {check.rule_results.length > 0 && <details><summary>候选规则及适用条件 · {check.rule_results.length}</summary>
      <ul className="lm-list">{check.rule_results.map(rule => <li key={rule.rule_id}>
        <b>{rule.title}</b>
        <small>{classifications[rule.classification]} · {rule.rule_id}</small>
        {rule.next_step && <p>{rule.next_step}</p>}
        {check.source_issues.filter(item => item.rule_id === rule.rule_id).map((item, index) =>
          <small key={index}>{item.source_id && `${item.source_id} · `}{item.reason}</small>)}
      </li>)}</ul>
    </details>}
    {check.citations.length > 0 && <details open><summary>引用与原文 · {check.citations.length}</summary>
      <ul className="lm-list">{check.citations.map((item, index) => <li key={index}>
        <a className="lm-link" href={item.url} target="_blank" rel="noreferrer">{item.title}</a>
        <small>{[item.locator, item.version, item.retrieved_at && `采集 ${item.retrieved_at}`,
          item.effective_from && `生效 ${item.effective_from}`].filter(Boolean).join(" · ")}</small>
        {item.excerpt && <p>{item.excerpt}</p>}
      </li>)}</ul>
    </details>}
  </section>;
}
