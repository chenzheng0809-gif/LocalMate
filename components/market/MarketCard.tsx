import Link from "next/link";
import { ArrowUpRight, Info, ShieldAlert, ShieldCheck } from "lucide-react";
import type { CountryMatch, MarketResearchData } from "@/types/domain";
import { COUNTRY_META, METRIC_META } from "@/types/domain";
import { Chip, DataOriginBadge, MetricBar, ScoreRing, StatusPill } from "@/components/ui/primitives";
import { formatMoney, percentage } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";

const GATE_LABEL: Record<string, string> = {
  CLEAR: "预检完成",
  CAUTION: "合规需谨慎",
  BLOCKED: "合规被阻断",
  UNKNOWN: "合规状态未知",
};

const RECOMMENDATION_LABEL: Record<string, string> = {
  PRIORITY_TEST: "优先验证",
  SECONDARY_TEST: "次级测试",
  VALIDATE_FIRST: "先验证",
  BLOCKED: "不要发布",
  INSUFFICIENT_DATA: "数据不足",
};

export function MarketCard({
  productId,
  match,
  market,
}: {
  productId: string;
  match: CountryMatch;
  market: MarketResearchData;
}) {
  const meta = COUNTRY_META[match.country];
  const gateTone = match.complianceGate === "CLEAR" ? "green" : match.complianceGate === "BLOCKED" ? "red" : match.complianceGate === "UNKNOWN" ? "gold" : "amber";
  const topMetrics = (["demand", "productMarketFit", "competition", "marginPotential"] as const).slice(0, 4);
  return (
    <div className={cn("panel relative overflow-hidden rounded-2xl", match.rank === 1 && "border-gold-400/25")}>
      {match.rank === 1 ? <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold-400/70 to-transparent" /> : null}
      <div className="flex items-start justify-between gap-4 border-b border-white/[0.06] px-5 py-4">
        <div>
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] font-mono text-[9px] text-cyan-200">{meta.flag}</span>
            <div>
              <div className="text-sm text-soft">{meta.name}</div>
              <div className="font-mono text-[8px] uppercase tracking-[0.14em] text-muted">{meta.localName} · {meta.currency}</div>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <StatusPill status={RECOMMENDATION_LABEL[match.recommendation]} />
            <DataOriginBadge mode={market.dataMode} />
          </div>
        </div>
        <div className="text-right">
          <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">{match.rank ? `排名 0${match.rank}` : "未排名"}</div>
          <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-muted">
            <Info className="h-3 w-3" /> {percentage(match.coverage)} 覆盖率
          </div>
        </div>
      </div>

      <div className="grid gap-5 px-5 py-5 sm:grid-cols-[auto_1fr] sm:items-center">
        <div className="flex items-center gap-4">
          <ScoreRing score={match.weightedScore} label="市场分" tone={match.rank === 1 ? "gold" : "cyan"} />
          <div className="sm:hidden">
            <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">合规门</div>
            <Chip tone={gateTone} className="mt-1">{GATE_LABEL[match.complianceGate]}</Chip>
          </div>
        </div>
        <div className="space-y-3">
          {topMetrics.map((key) => (
            <MetricBar key={key} label={METRIC_META[key].label} score={match.metrics[key].score} confidence={match.metrics[key].confidence} />
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-px border-y border-white/[0.06] bg-white/[0.06]">
        <div className="bg-[#07141f] px-3 py-3">
          <div className="font-mono text-[8px] uppercase tracking-[0.12em] text-muted">观察零售价</div>
          <div className="mt-1 font-mono text-xs text-soft">{formatMoney(market.pricing.benchmarkRetail, meta.currency)}</div>
        </div>
        <div className="bg-[#07141f] px-3 py-3">
          <div className="font-mono text-[8px] uppercase tracking-[0.12em] text-muted">情景毛利</div>
          <div className="mt-1 font-mono text-xs text-soft">{percentage(market.pricing.grossMarginPct, 1)}</div>
        </div>
        <div className="bg-[#07141f] px-3 py-3">
          <div className="font-mono text-[8px] uppercase tracking-[0.12em] text-muted">可比商品</div>
          <div className="mt-1 font-mono text-xs text-soft">{market.competitors.length}</div>
        </div>
      </div>

      <div className="px-5 py-4">
        <div className="flex items-start gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
          {match.complianceGate === "BLOCKED" ? <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-300" /> : <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-300/70" />}
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted">合规门 · 单独展示</div>
            <div className="mt-0.5 text-[11px] text-soft">{GATE_LABEL[match.complianceGate]}</div>
          </div>
        </div>
        <p className="mt-3 line-clamp-3 text-[11px] leading-relaxed text-muted">{match.rationale}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Link href={`/markets/${productId}#${match.country}`} className="btn-ghost !px-3 !py-1.5 text-[10px]">深入分析 <ArrowUpRight className="h-3 w-3" /></Link>
          <Link href={`/compliance/${productId}#${match.country}`} className="btn-quiet !px-2 !py-1.5 text-[10px]">合规预检</Link>
        </div>
      </div>
    </div>
  );
}
