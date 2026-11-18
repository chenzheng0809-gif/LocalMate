import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  CircleAlert,
  ExternalLink,
  Gauge,
  Globe2,
  PackageSearch,
  ShieldCheck,
  Sparkles,
  TriangleAlert,
} from "lucide-react";
import {
  Chip,
  DataOriginBadge,
  Disclaimer,
  EmptyState,
  MetricBar,
  Panel,
  ScoreRing,
  StatusPill,
  searchModeLabel,
  statusLabel,
  signalLevelLabel,
  verificationLabel,
} from "@/components/ui/primitives";
import { getRepositories } from "@/lib/repositories";
import { buildMatchAnalysis } from "@/lib/matching/engine";
import { COUNTRY_META, METRIC_META, type Evidence, type MarketResearchData, type MetricKey } from "@/types/domain";
import { formatMoney, percentage } from "@/lib/utils/money";

export const dynamic = "force-dynamic";

const METRIC_ORDER: MetricKey[] = ["demand", "productMarketFit", "competition", "marginPotential", "localizationEffort", "entryFriction"];


function PricingPanel({ market }: { market: MarketResearchData }) {
  const meta = COUNTRY_META[market.country];
  return (
    <Panel flat className="p-5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-cyan-300" /><div className="text-sm text-soft">情景经济性</div></div>
        <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-muted">{meta.currency}</span>
      </div>
      <div className="mt-4">
        {market.pricing.lineItems.map((item) => (
          <div key={item.key} className="flex items-center justify-between gap-3 border-b border-white/[0.05] py-2">
            <div className="min-w-0">
              <div className="truncate text-[11px] text-muted">{item.label}</div>
              <div className="font-mono text-[8px] uppercase tracking-[0.1em] text-muted/50">{item.source === "USER_INPUT" ? "用户输入" : item.source === "SCENARIO_ASSUMPTION" ? "情景假设" : item.source === "BENCHMARK" ? "基准价" : "未知"}</div>
            </div>
            <div className="shrink-0 font-mono text-[11px] text-soft">{formatMoney(item.amount, item.currency)}</div>
          </div>
        ))}
      </div>
      <div className="mt-3 space-y-2">
        <div className="flex justify-between gap-3 text-[11px]"><span className="text-muted">到岸成本 / 件</span><span className="font-mono text-soft">{formatMoney(market.pricing.landedCost, meta.currency)}</span></div>
        <div className="flex justify-between gap-3 text-[11px]"><span className="text-muted">基准零售价</span><span className="font-mono text-soft">{formatMoney(market.pricing.benchmarkRetail, meta.currency)}</span></div>
        <div className="flex justify-between gap-3 text-[11px]"><span className="text-muted">建议情景零售价</span><span className="font-mono text-soft">{formatMoney(market.pricing.suggestedRetail, meta.currency)}</span></div>
        <div className="flex justify-between gap-3 text-[11px]"><span className="text-muted">情景毛利率</span><span className="font-mono text-soft">{percentage(market.pricing.grossMarginPct, 1)}</span></div>
      </div>
      <div className="mt-4 border-t border-white/[0.06] pt-3">
        <div className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.12em] text-gold-400/80"><CircleAlert className="h-3 w-3" /> "情景估算，不是报价"</div>
        <ul className="mt-2 space-y-1.5">
          {market.pricing.assumptions.slice(0, 6).map((assumption) => <li key={assumption} className="text-[10px] leading-relaxed text-muted">— {assumption}</li>)}
        </ul>
        <div className="mt-2 font-mono text-[8px] uppercase tracking-[0.1em] text-muted/50">FX {market.pricing.fxSource} {market.pricing.fxRate ? `· ${market.pricing.fxRate}` : ""}</div>
      </div>
    </Panel>
  );
}

function CompetitorTable({ market, evidence }: { market: MarketResearchData; evidence: Evidence[] }) {
  const meta = COUNTRY_META[market.country];
  return (
    <Panel className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
        <div>
          <div className="eyebrow">已观察可比商品</div>
          <h3 className="mt-1 text-sm text-soft">{market.competitors.length} 个公开商品页</h3>
        </div>
        <DataOriginBadge mode={market.searchMode} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-left">
          <thead>
            <tr className="border-b border-white/[0.06] font-mono text-[8px] uppercase tracking-[0.14em] text-muted">
              <th className="px-5 py-2.5 font-normal">商品</th>
              <th className="px-3 py-2.5 font-normal">价格</th>
              <th className="px-3 py-2.5 font-normal">评分</th>
              <th className="px-3 py-2.5 font-normal">评论数</th>
              <th className="px-5 py-2.5 text-right font-normal">来源</th>
            </tr>
          </thead>
          <tbody>
            {market.competitors.map((competitor) => (
              <tr key={competitor.sourceEvidenceId} className="border-b border-white/[0.05] last:border-0">
                <td className="px-5 py-3">
                  <div className="text-[11px] text-soft">{competitor.name}</div>
                  <div className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.1em] text-muted">{competitor.productType} · {new URL(competitor.url).hostname}</div>
                </td>
                <td className="px-3 py-3 font-mono text-[11px] text-soft">{formatMoney(competitor.price, competitor.currency ?? meta.currency)}</td>
                <td className="px-3 py-3 font-mono text-[11px] text-muted">{competitor.rating !== null && competitor.rating !== undefined ? `★ ${competitor.rating.toFixed(1)}` : "—"}</td>
                <td className="px-3 py-3 font-mono text-[11px] text-muted">{competitor.reviewCount !== null && competitor.reviewCount !== undefined ? competitor.reviewCount.toLocaleString("en-US") : "—"}</td>
                <td className="px-5 py-3 text-right">
                  {competitor.url ? <a href={competitor.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-mono text-[9px] text-cyan-300/80 hover:text-cyan-200">打开 <ExternalLink className="h-3 w-3" /></a> : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="border-t border-white/[0.06] px-5 py-3 text-[10px] leading-relaxed text-muted">
        评分和评论数是累计的平台信号，不是销量。这些观察是窄口径公开样本，不是全市场扫描。
        {evidence.length > 0 ? ` 该市场附有 ${evidence.length} 条证据。` : ""}
      </div>
    </Panel>
  );
}

export default async function MarketsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repos = getRepositories();
  const product = repos.products.getById(id);
  if (!product) notFound();
  const markets = repos.research.getByProduct(id);
  const compliance = repos.compliance.getByProduct(id);
  const match = repos.matches.getLatest(id) ?? (markets.length ? buildMatchAnalysis({ product, markets, compliance }) : null);
  const allEvidence = repos.evidence.listByProduct(id, 400);

  if (markets.length === 0) {
    return (
      <div className="container-page py-16">
        <EmptyState
          title="还没有市场详情"
          description="请先运行四市场研究。之后本页会展示完整证据链、价格明细和每个市场的指标覆盖。"
          icon={<Globe2 className="h-8 w-8" />}
          action={<Link href={`/product/${id}`} className="btn-primary">返回产品 <ArrowRight className="h-4 w-4" /></Link>}
        />
      </div>
    );
  }

  return (
    <div className="container-page py-8 lg:py-12">
      <div className="flex flex-wrap items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em] text-muted">
        <Link href="/" className="hover:text-soft">产品护照</Link>
        <span className="text-white/20">/</span>
        <Link href={`/product/${id}`} className="hover:text-soft">{product.name}</Link>
        <span className="text-white/20">/</span>
        <span className="text-cyan-300/80">市场详情</span>
      </div>

      <div className="mt-5 flex flex-col gap-4 border-b border-white/[0.08] pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap gap-2"><Chip tone="cyan">深入分析</Chip><DataOriginBadge mode={markets[0]?.dataMode ?? "LOCAL_EVIDENCE"} /></div>
          <h1 className="display-md mt-4 text-soft">排名背后的证据。</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">逐市场展示定价、需求代理、竞争观察，以及阻止分数更高的具体缺口。</p>
        </div>
        <div className="flex gap-2">
          <Link href={`/discover/${id}`} className="btn-ghost !px-4 !py-2.5 text-[11px]">返回比较</Link>
          <Link href={`/compliance/${id}`} className="btn-primary !px-4 !py-2.5 text-[11px]"><ShieldCheck className="h-3.5 w-3.5" /> 合规视图</Link>
        </div>
      </div>

      <div className="sticky top-[72px] z-30 -mx-5 mt-5 overflow-x-auto border-y border-white/[0.06] bg-[#040a12]/90 px-5 py-2 backdrop-blur-xl sm:mx-0 sm:rounded-xl sm:border">
        <div className="flex min-w-max items-center gap-1">
          {markets.map((market) => {
            const countryMatch = match?.countries.find((item) => item.country === market.country);
            return (
              <a key={market.country} href={`#${market.country}`} className="flex items-center gap-2 rounded-lg px-3 py-2 text-[10px] text-muted transition hover:bg-white/[0.04] hover:text-soft">
                <span className="font-mono text-[9px]">{COUNTRY_META[market.country].flag}</span>
                {COUNTRY_META[market.country].name}
                <span className="font-mono text-[9px] text-cyan-300/70">{countryMatch?.weightedScore ?? "—"}</span>
              </a>
            );
          })}
        </div>
      </div>

      <div className="mt-10 space-y-14">
        {markets.map((market) => {
          const countryMatch = match?.countries.find((item) => item.country === market.country);
          const meta = COUNTRY_META[market.country];
          const marketEvidence = allEvidence.filter((item) => item.country === market.country && item.kind === "MARKET").slice(0, 8);
          return (
            <section key={market.country} id={market.country} className="scroll-mt-36">
              <div className="flex flex-col gap-5 border-b border-white/[0.08] pb-6 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] font-mono text-[11px] text-cyan-200">{meta.flag}</span>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="display-md text-soft">{meta.name}</h2>
                        {countryMatch?.rank ? <Chip tone="gold">排名 0{countryMatch.rank}</Chip> : <Chip>未排名</Chip>}
                      </div>
                      <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.14em] text-muted">{meta.localName} · {meta.currency} · {searchModeLabel(market.searchMode)}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <StatusPill status={countryMatch?.complianceGate ?? "UNKNOWN"} />
                    <StatusPill status={market.status} />
                    <Chip tone="slate">覆盖率 {percentage(market.coverage)}</Chip>
                  </div>
                </div>
                <div className="flex items-center gap-5">
                  <ScoreRing score={countryMatch?.weightedScore ?? null} label="市场分" tone={countryMatch?.rank === 1 ? "gold" : "cyan"} />
                  <div className="hidden sm:block">
                    <div className="font-mono text-[8px] uppercase tracking-[0.12em] text-muted">合规门</div>
                    <div className="mt-1 text-xs text-soft">{countryMatch?.complianceGate ? statusLabel(countryMatch.complianceGate) : "未知"}</div>
                    <Link href={`/compliance/${id}#${market.country}`} className="link-cyan mt-2 inline-flex items-center gap-1 text-[10px]">打开合规预检 <ArrowUpRight className="h-3 w-3" /></Link>
                  </div>
                </div>
              </div>

              <div className="mt-6 grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
                <div className="min-w-0 space-y-5">
                  <Panel className="p-5">
                    <div className="flex items-center gap-2"><Sparkles className="h-4 w-4 text-cyan-300" /><div className="text-sm text-soft">市场景观解读</div></div>
                    <p className="mt-3 text-[12px] leading-relaxed text-muted">{market.narrative.landscapeSummary}</p>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <div className="label-mono">需求信号 · {signalLevelLabel(market.demandSignals.level)}</div>
                        <p className="mt-2 text-[11px] leading-relaxed text-muted">{market.demandSignals.summary}</p>
                      </div>
                      <div>
                        <div className="label-mono">竞争水平 · {signalLevelLabel(market.competition.level)}</div>
                        <p className="mt-2 text-[11px] leading-relaxed text-muted">{market.competition.summary}</p>
                      </div>
                    </div>
                  </Panel>

                  <Panel flat className="p-5">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2"><Gauge className="h-4 w-4 text-cyan-300" /><div className="text-sm text-soft">信号覆盖</div></div>
                      <span className="font-mono text-[9px] text-muted">权重按可用输入重新归一</span>
                    </div>
                    <div className="mt-5 grid gap-x-8 gap-y-5 sm:grid-cols-2">
                      {METRIC_ORDER.map((key) => (
                        <MetricBar key={key} label={METRIC_META[key].label} score={market.metrics[key].score} confidence={market.metrics[key].confidence} note={key === "entryFriction" ? "仅作合规门背景，不计入加权市场分。" : market.metrics[key].note} />
                      ))}
                    </div>
                    <div className="mt-5 border-t border-white/[0.06] pt-4">
                      <div className="label-mono">缺失数据</div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {market.missingData.length === 0 ? <Chip tone="green">未声明缺失</Chip> : market.missingData.map((item) => <Chip key={item} tone="gold">{item}</Chip>)}
                      </div>
                    </div>
                  </Panel>

                  <CompetitorTable market={market} evidence={marketEvidence} />

                  <Panel flat className="p-5">
                    <div className="flex items-center gap-2"><PackageSearch className="h-4 w-4 text-cyan-300" /><div className="text-sm text-soft">客户需求假设</div></div>
                    <p className="mt-2 text-[10px] leading-relaxed text-muted">{market.customerNeeds.note}</p>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                      <div>
                        <div className="label-mono">关注属性</div>
                        <div className="mt-2 flex flex-wrap gap-1.5">{market.customerNeeds.focusAttributes.map((item) => <Chip key={item}>{item}</Chip>)}</div>
                      </div>
                      <div>
                        <div className="label-mono">潜在缺口</div>
                        <div className="mt-2 flex flex-wrap gap-1.5">{market.customerNeeds.potentialGaps.map((item) => <Chip key={item} tone="gold">{item}</Chip>)}</div>
                      </div>
                    </div>
                    {market.customerNeeds.hypotheses.length > 0 ? (
                      <div className="mt-4 space-y-2 border-t border-white/[0.06] pt-3">
                        {market.customerNeeds.hypotheses.slice(0, 4).map((hypothesis) => (
                          <div key={hypothesis.statement} className="text-[11px] leading-relaxed text-muted">
                            <span className="mr-2 font-mono text-[8px] uppercase tracking-[0.1em] text-gold-400/70">假设</span>
                            {hypothesis.statement}
                            <span className="mt-0.5 block text-[9px] text-muted/60">依据：{hypothesis.basis}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </Panel>
                </div>

                <div className="min-w-0 space-y-4">
                  <PricingPanel market={market} />

                  <Panel flat className="p-5">
                    <div className="label-mono">阻力与风险</div>
                    <div className="mt-3 space-y-2">
                      {[...market.narrative.risks, ...market.warnings].slice(0, 6).map((item) => (
                        <p key={item} className="flex items-start gap-2 text-[11px] leading-relaxed text-muted"><TriangleAlert className="mt-0.5 h-3 w-3 shrink-0 text-gold-400" />{item}</p>
                      ))}
                      {market.narrative.risks.length === 0 && market.warnings.length === 0 ? <p className="text-[11px] text-muted">没有记录额外风险。</p> : null}
                    </div>
                    <div className="mt-4 border-t border-white/[0.06] pt-3">
                      <div className="label-mono">本地化说明</div>
                      <div className="mt-2 space-y-1.5">
                        {market.narrative.localizationNotes.slice(0, 4).map((item) => <p key={item} className="text-[10px] leading-relaxed text-muted">— {item}</p>)}
                      </div>
                    </div>
                  </Panel>

                  <Panel flat className="p-5">
                    <div className="label-mono">证据锚点</div>
                    <div className="mt-3 space-y-2">
                      {marketEvidence.slice(0, 5).map((item) => (
                        <div key={item.id} className="border-b border-white/[0.05] pb-2 last:border-0 last:pb-0">
                          <div className="text-[10px] leading-relaxed text-soft/80">{item.sourceTitle}</div>
                          <div className="mt-0.5 flex items-center justify-between gap-2">
                            <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-muted">{verificationLabel(item.verificationStatus)}</span>
                            {item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="font-mono text-[8px] text-cyan-300/70 hover:text-cyan-200">来源 <ExternalLink className="inline h-2.5 w-2.5" /></a> : null}
                          </div>
                        </div>
                      ))}
                      {marketEvidence.length === 0 ? <p className="text-[10px] text-muted">证据条目已附加到研究任务；完整集合请导出产品护照。</p> : null}
                    </div>
                  </Panel>

                  <div className="flex flex-wrap gap-2">
                    <Link href={`/lab/${id}`} className="btn-gold !px-4 !py-2 text-[11px]">压力测试该市场 <ArrowRight className="h-3.5 w-3.5" /></Link>
                    <Link href={`/launch/${id}`} className="btn-ghost !px-4 !py-2 text-[11px]">发布文案</Link>
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <Disclaimer className="mt-10">
        加权分是基于公开证据样本的比较工具，不是销量预测、财务预测或合规批准。
        合规门单独展示，可能不考虑商业分而直接阻断某个市场。
      </Disclaimer>
    </div>
  );
}
