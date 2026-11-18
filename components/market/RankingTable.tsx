import Link from "next/link";
import type { CountryMatch, MarketResearchData } from "@/types/domain";
import { COUNTRY_META } from "@/types/domain";
import { StatusPill } from "@/components/ui/primitives";
import { formatMoney, percentage } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";

const ACTION: Record<string, string> = {
  PRIORITY_TEST: "优先测试",
  SECONDARY_TEST: "次级测试",
  VALIDATE_FIRST: "先验证",
  BLOCKED: "已阻断",
  INSUFFICIENT_DATA: "数据不足",
};

export function RankingTable({
  productId,
  countries,
  markets,
}: {
  productId: string;
  countries: CountryMatch[];
  markets: MarketResearchData[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[760px] border-collapse text-left">
        <thead>
          <tr className="border-b border-white/[0.08] font-mono text-[8px] uppercase tracking-[0.16em] text-muted">
            <th className="py-3 pr-4 font-normal">排名</th>
            <th className="py-3 pr-4 font-normal">市场</th>
            <th className="py-3 pr-4 font-normal">得分</th>
            <th className="py-3 pr-4 font-normal">覆盖率</th>
            <th className="py-3 pr-4 font-normal">合规门</th>
            <th className="py-3 pr-4 font-normal">观察零售价</th>
            <th className="py-3 pr-4 font-normal">利润情景</th>
            <th className="py-3 font-normal">动作</th>
          </tr>
        </thead>
        <tbody>
          {countries.map((country) => {
            const market = markets.find((item) => item.country === country.country);
            const meta = COUNTRY_META[country.country];
            return (
              <tr key={country.country} className={cn("border-b border-white/[0.05] text-xs transition hover:bg-white/[0.02]", country.rank === 1 && "bg-gold-400/[0.025]")}>
                <td className="py-3.5 pr-4 font-mono text-muted">{country.rank ? `0${country.rank}` : "—"}</td>
                <td className="py-3.5 pr-4">
                  <Link href={`/markets/${productId}#${country.country}`} className="flex items-center gap-2 text-soft hover:text-cyan-200">
                    <span className="font-mono text-[9px] text-muted">{meta.flag}</span>
                    {meta.name}
                  </Link>
                </td>
                <td className="py-3.5 pr-4 font-mono text-soft">{country.weightedScore ?? "—"}</td>
                <td className="py-3.5 pr-4 font-mono text-muted">{percentage(country.coverage)}</td>
                <td className="py-3.5 pr-4"><StatusPill status={country.complianceGate} /></td>
                <td className="py-3.5 pr-4 font-mono text-muted">{market ? formatMoney(market.pricing.benchmarkRetail, meta.currency) : "—"}</td>
                <td className="py-3.5 pr-4 font-mono text-muted">{market ? percentage(market.pricing.grossMarginPct, 1) : "—"}</td>
                <td className="py-3.5"><StatusPill status={ACTION[country.recommendation] ?? country.recommendation} /></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
