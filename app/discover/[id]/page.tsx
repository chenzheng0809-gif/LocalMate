import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Boxes,
  CircleAlert,
  Compass,
  ExternalLink,
  Gauge,
  Globe2,
  LineChart,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { WorldMap } from "@/components/market/WorldMap";
import { MarketCard } from "@/components/market/MarketCard";
import { RankingTable } from "@/components/market/RankingTable";
import {
  Chip,
  DataOriginBadge,
  Disclaimer,
  EmptyState,
  Panel,
  ScoreRing,
  SectionHeading,
  StatusPill,
  dataModeLabel,
  searchModeLabel,
  statusLabel,
} from "@/components/ui/primitives";
import { getRepositories } from "@/lib/repositories";
import { buildMatchAnalysis } from "@/lib/matching/engine";
import { COUNTRY_META } from "@/types/domain";
import { formatDate } from "@/lib/utils/date";
import { formatMoney, percentage } from "@/lib/utils/money";

export const dynamic = "force-dynamic";

export default async function DiscoverPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repos = getRepositories();
  const product = repos.products.getById(id);
  if (!product) notFound();
  const markets = repos.research.getByProduct(id);
  const compliance = repos.compliance.getByProduct(id);
  const match = repos.matches.getLatest(id) ?? (markets.length ? buildMatchAnalysis({ product, markets, compliance }) : null);
  const outOfScope = product.category === "OUT_OF_SCOPE" || product.attributes.electrical === true;

  if (markets.length === 0) {
    return (
      <div className="container-page py-16">
        <EmptyState
          title="还没有市场研究"
          description="确认产品简报并运行四市场研究。市场视图会填入已观察商品、价格情景和合规门。"
          icon={<Compass className="h-8 w-8" />}
          action={<Link href={`/product/${id}`} className="btn-primary">返回产品简报 <ArrowRight className="h-4 w-4" /></Link>}
        />
      </div>
    );
  }

  const recommended = match?.countries.find((country) => country.country === match.recommendedCountry) ?? match?.countries.find((country) => country.rank === 1) ?? null;
  const recommendedMarket = recommended ? markets.find((market) => market.country === recommended.country) : null;
  const totalComparables = markets.reduce((sum, market) => sum + market.competitors.length, 0);
  const warnings = Array.from(new Set(markets.flatMap((market) => market.warnings))).slice(0, 6);
  const evidence = recommendedMarket ? [...recommendedMarket.competitors].slice(0, 8) : [];

  return (
    <div className="container-page py-8 lg:py-12">
      <div className="flex flex-wrap items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em] text-muted">
        <Link href="/" className="hover:text-soft">产品护照</Link>
        <span className="text-white/20">/</span>
        <Link href={`/product/${id}`} className="hover:text-soft">{product.name}</Link>
        <span className="text-white/20">/</span>
        <span className="text-cyan-300/80">市场视图</span>
      </div>

      <div className="mt-5 flex flex-col gap-4 border-b border-white/[0.08] pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone="cyan">四市场比较</Chip>
            <DataOriginBadge mode={markets[0]?.dataMode ?? "LOCAL_EVIDENCE"} />
            <StatusPill status={match?.status ?? "COMPARISON_INCOMPLETE"} />
          </div>
          <h1 className="display-md mt-4 text-soft">这个产品应该先测试哪个市场？</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            商业排名与合规门分开计算。高分代表验证优先级，不代表发布批准。
            下面每个判断都能追溯到已观察商品或官方来源。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={`/markets/${id}`} className="btn-ghost !px-4 !py-2.5 text-[11px]">完整市场分析</Link>
          <Link href={`/compliance/${id}`} className="btn-ghost !px-4 !py-2.5 text-[11px]"><ShieldCheck className="h-3.5 w-3.5" /> 合规预检</Link>
          <Link href={`/lab/${id}`} className="btn-gold !px-4 !py-2.5 text-[11px]">假设实验室 <ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>
      </div>

      {outOfScope ? (
        <div className="mt-6 rounded-2xl border border-rose-300/25 bg-rose-300/[0.05] p-5">
          <div className="flex items-center gap-2 text-sm text-rose-100"><TriangleAlert className="h-4 w-4" /> OUT_OF_SCOPE · 不应使用排名</div>
          <p className="mt-2 text-[12px] leading-relaxed text-muted">这份简报被判定为超出第一版范围。下方数据仅保留供查看，不要用于发布决策。</p>
        </div>
      ) : null}

      <div className="mt-7 grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <Panel className="relative overflow-hidden p-5 sm:p-6">
          <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-cyan-400/[0.08] blur-[60px]" />
          <div className="relative">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="eyebrow">验证优先级</div>
                <h2 className="display-md mt-2 text-soft">
                  {recommended ? COUNTRY_META[recommended.country].name : "没有可排名市场"}
                </h2>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {recommended ? <StatusPill status={recommended.recommendation} /> : <StatusPill status="INSUFFICIENT EVIDENCE" />}
                  {recommended ? <Chip tone={recommended.complianceGate === "BLOCKED" ? "red" : recommended.complianceGate === "CLEAR" ? "green" : "amber"}>合规门 · {statusLabel(recommended.complianceGate)}</Chip> : null}
                  <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">更新于 {formatDate(match?.generatedAt)}</span>
                </div>
              </div>
              {recommended ? <ScoreRing score={recommended.weightedScore} size={118} label="市场分" tone={recommended.complianceGate === "BLOCKED" ? "gold" : "cyan"} /> : null}
            </div>

            <p className="mt-5 max-w-2xl text-[13px] leading-relaxed text-muted">
              {match?.explanation ?? "可比证据不足以对四个市场排名。请补充缺失输入或重新研究。"}
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
                <div className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.12em] text-muted"><Boxes className="h-3 w-3" /> 可比商品</div>
                <div className="mt-2 font-mono text-lg text-soft">{totalComparables}</div>
                <div className="mt-0.5 text-[10px] text-muted">已观察商品</div>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
                <div className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.12em] text-muted"><Gauge className="h-3 w-3" /> 覆盖率</div>
                <div className="mt-2 font-mono text-lg text-soft">{recommended ? percentage(recommended.coverage) : "—"}</div>
                <div className="mt-0.5 text-[10px] text-muted">加权输入可用比例</div>
              </div>
              <div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
                <div className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.12em] text-muted"><Globe2 className="h-3 w-3" /> 数据模式</div>
                <div className="mt-2 font-mono text-xs text-soft">{dataModeLabel(markets[0]?.dataMode)}</div>
                <div className="mt-0.5 text-[10px] text-muted">{searchModeLabel(markets[0]?.searchMode)}</div>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              {recommended ? (
                <>
                  <Link href={`/markets/${id}#${recommended.country}`} className="btn-primary !px-4 !py-2.5 text-[11px]">查看{COUNTRY_META[recommended.country].name} <ArrowRight className="h-3.5 w-3.5" /></Link>
                  <Link href={`/launch/${id}`} className="btn-ghost !px-4 !py-2.5 text-[11px]">生成发布页草稿</Link>
                </>
              ) : null}
            </div>
          </div>
        </Panel>

        <Panel flat className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
            <div className="label-mono">机会地图</div>
            <div className="font-mono text-[8px] uppercase tracking-[0.12em] text-muted">来源 → 市场</div>
          </div>
          <WorldMap activeCountry={recommended?.country ?? null} ranked={match?.rankedCountries} compact className="p-2" />
          <div className="grid grid-cols-2 gap-px border-t border-white/[0.06] bg-white/[0.06]">
            {match?.countries.slice(0, 4).map((country) => (
              <Link key={country.country} href={`/markets/${id}#${country.country}`} className="bg-[#07141f] px-3 py-2.5 transition hover:bg-[#0a1a28]">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[9px] text-soft">{COUNTRY_META[country.country].flag} {COUNTRY_META[country.country].name}</span>
                  <span className="font-mono text-[10px] text-cyan-200">{country.weightedScore ?? "—"}</span>
                </div>
                <div className="mt-1 font-mono text-[8px] uppercase tracking-[0.1em] text-muted">{statusLabel(country.complianceGate)}</div>
              </Link>
            ))}
          </div>
        </Panel>
      </div>

      <section className="mt-10">
        <SectionHeading
          eyebrow="比较"
          title="四个市场判断，一个证据基础。"
          description="加权分使用需求、产品市场匹配、竞争空间、利润潜力和本地化准备度。合规门不计入加权分。"
          action={<Link href={`/markets/${id}`} className="btn-ghost !px-4 !py-2 text-[11px]">打开深入分析 <ArrowUpRight className="h-3.5 w-3.5" /></Link>}
        />
        <Panel className="mt-5 overflow-hidden">
          <RankingTable productId={id} countries={match?.countries ?? []} markets={markets} />
        </Panel>
      </section>

      <section className="mt-8 grid gap-5 xl:grid-cols-2">
        {match?.countries.map((country) => {
          const market = markets.find((item) => item.country === country.country);
          return market ? <MarketCard key={country.country} productId={id} match={country} market={market} /> : null;
        })}
      </section>

      {recommended && recommendedMarket ? (
        <section className="mt-10 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
          <Panel className="overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
              <div>
                <div className="eyebrow">可观察样本</div>
                <h3 className="mt-1 text-sm text-soft">{COUNTRY_META[recommended.country].name} · 已观察可比商品</h3>
              </div>
              <DataOriginBadge mode={recommendedMarket.searchMode} />
            </div>
            <div className="divide-y divide-white/[0.06]">
              {evidence.map((competitor) => (
                <div key={competitor.sourceEvidenceId} className="px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-xs text-soft">
                        <span className="truncate">{competitor.name}</span>
                        <span className="shrink-0 font-mono text-[8px] uppercase tracking-[0.12em] text-muted">{competitor.productType}</span>
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-3 font-mono text-[9px] text-muted">
                        <span>{formatMoney(competitor.price, competitor.currency ?? COUNTRY_META[recommended.country].currency)}</span>
                        {competitor.rating !== null && competitor.rating !== undefined ? <span>★ {competitor.rating.toFixed(1)}</span> : null}
                        {competitor.reviewCount !== null && competitor.reviewCount !== undefined ? <span>{competitor.reviewCount.toLocaleString("en-US")} ratings</span> : null}
                        <span>{new URL(competitor.url).hostname}</span>
                      </div>
                    </div>
                    {competitor.url ? <a href={competitor.url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1 font-mono text-[9px] text-cyan-300/80 hover:text-cyan-200">来源 <ExternalLink className="h-3 w-3" /></a> : null}
                  </div>
                </div>
              ))}
              {evidence.length === 0 ? <div className="px-5 py-8 text-center text-xs text-muted">本次运行没有观察到可比商品。</div> : null}
            </div>
            <div className="border-t border-white/[0.06] px-5 py-3">
              <div className="flex items-start gap-2 text-[10px] leading-relaxed text-muted">
                <CircleAlert className="mt-0.5 h-3 w-3 shrink-0 text-gold-400" />
                这些是公开商品页观察，不是全市场扫描。评分和评论数是累计的平台信号，不是销量。
              </div>
            </div>
          </Panel>

          <div className="space-y-4">
            <Panel flat className="p-5">
              <div className="flex items-center gap-2"><BarChart3 className="h-4 w-4 text-cyan-300" /><div className="text-sm text-soft">分数由什么构成</div></div>
              <div className="mt-4 space-y-3">
                {recommended.strengths.slice(0, 4).map((strength) => (
                  <div key={strength} className="flex items-start gap-2 text-[11px] leading-relaxed text-muted"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-300" />{strength}</div>
                ))}
                {recommended.risks.slice(0, 4).map((risk) => (
                  <div key={risk} className="flex items-start gap-2 text-[11px] leading-relaxed text-muted"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-gold-400" />{risk}</div>
                ))}
              </div>
              <div className="mt-4 border-t border-white/[0.06] pt-3">
                <div className="font-mono text-[8px] uppercase tracking-[0.14em] text-muted">缺失数据</div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {recommended.missingData.length === 0 ? <Chip tone="green">未声明缺失</Chip> : recommended.missingData.slice(0, 6).map((item) => <Chip key={item} tone="gold">{item}</Chip>)}
                </div>
              </div>
            </Panel>

            <Panel flat className="p-5">
              <div className="flex items-center gap-2"><LineChart className="h-4 w-4 text-cyan-300" /><div className="text-sm text-soft">情景经济性</div></div>
              <div className="mt-3 space-y-2.5 text-[11px]">
                <div className="flex justify-between gap-3"><span className="text-muted">到岸成本 / 件</span><span className="font-mono text-soft">{formatMoney(recommendedMarket.pricing.landedCost, COUNTRY_META[recommended.country].currency)}</span></div>
                <div className="flex justify-between gap-3"><span className="text-muted">基准零售价</span><span className="font-mono text-soft">{formatMoney(recommendedMarket.pricing.benchmarkRetail, COUNTRY_META[recommended.country].currency)}</span></div>
                <div className="flex justify-between gap-3"><span className="text-muted">建议情景零售价</span><span className="font-mono text-soft">{formatMoney(recommendedMarket.pricing.suggestedRetail, COUNTRY_META[recommended.country].currency)}</span></div>
                <div className="flex justify-between gap-3"><span className="text-muted">毛利率</span><span className="font-mono text-soft">{percentage(recommendedMarket.pricing.grossMarginPct, 1)}</span></div>
              </div>
              <p className="mt-3 text-[10px] leading-relaxed text-muted">{recommendedMarket.pricing.fxSource === "live" ? "实时参考汇率" : "规划备用汇率"} · scenario only. {recommendedMarket.pricing.assumptions.slice(0, 1).join("")}</p>
            </Panel>
          </div>
        </section>
      ) : null}

      {warnings.length > 0 ? (
        <section className="mt-8">
          <Panel flat className="p-5">
            <div className="flex items-center gap-2"><TriangleAlert className="h-4 w-4 text-gold-400" /><div className="text-sm text-soft">本次运行不主张什么</div></div>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {warnings.map((warning) => <p key={warning} className="text-[11px] leading-relaxed text-muted">— {warning}</p>)}
            </div>
          </Panel>
        </section>
      ) : null}

      <Disclaimer className="mt-8">
        产品护照只排序验证优先级，不预测销量、不保证利润，也不认证合规。
        市场观察是有日期的公开快照；用它设计下一轮测试，而不是替代测试。
      </Disclaimer>
    </div>
  );
}
