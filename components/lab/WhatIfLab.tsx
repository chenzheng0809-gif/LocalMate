"use client";

import { useMemo, useState } from "react";
import {
  CheckCircle2,
  CircleAlert,
  FlaskConical,
  Loader2,
  RefreshCw,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import type { Country, MarketResearchData, ProductDNA, SimulationResult } from "@/types/domain";
import { COUNTRY_META, COUNTRY_ORDER } from "@/types/domain";
import { api, errorMessage } from "@/lib/client/api";
import { formatMoney, percentage } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";
import { statusLabel } from "@/components/ui/primitives";

interface FormState {
  supplierCostCNY: string;
  shippingCost: string;
  dutyRatePct: string;
  platformFeePct: string;
  targetPrice: string;
  material: string;
  weight: string;
}

const EMPTY: FormState = {
  supplierCostCNY: "",
  shippingCost: "",
  dutyRatePct: "",
  platformFeePct: "",
  targetPrice: "",
  material: "",
  weight: "",
};

const MODULE_LABEL: Record<string, string> = {
  PRODUCT_DNA: "产品 DNA",
  PRICING: "定价情景",
  COMPLIANCE: "合规门",
  MARKET_MATCH: "市场匹配",
  LAUNCH_PAGE: "发布页",
};

const ACTION_LABEL: Record<string, string> = {
  RECOMPUTED: "已重算",
  INVALIDATED: "已失效",
  REQUIRES_RERUN: "需要重跑",
  UNCHANGED: "未变化",
};

const ACTION_TONE: Record<string, string> = {
  RECOMPUTED: "text-cyan-200 border-cyan-300/20 bg-cyan-300/[0.04]",
  INVALIDATED: "text-rose-200 border-rose-300/20 bg-rose-300/[0.04]",
  REQUIRES_RERUN: "text-amber-200 border-amber-300/20 bg-amber-300/[0.04]",
  UNCHANGED: "text-muted border-white/10 bg-white/[0.02]",
};

export function WhatIfLab({
  product,
  markets,
  initial,
}: {
  product: ProductDNA;
  markets: MarketResearchData[];
  initial: SimulationResult | null;
}) {
  const [form, setForm] = useState<FormState>({
    ...EMPTY,
    supplierCostCNY: product.sourcing.priceCNY?.toString() ?? "",
    weight: product.attributes.weight?.toString() ?? "",
    material: product.attributes.material ?? "",
  });
  const [selected, setSelected] = useState<Country[]>(markets.map((market) => market.country));
  const [result, setResult] = useState<SimulationResult | null>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const topCountry = useMemo(() => {
    const ranked = result?.after.match?.rankedCountries ?? [];
    return ranked[0] ?? selected[0] ?? "US";
  }, [result, selected]);

  const toggleCountry = (country: Country) => {
    setSelected((current) => (current.includes(country) ? current.filter((item) => item !== country) : [...current, country]));
  };

  const run = async () => {
    if (selected.length === 0) {
      setError("请至少选择一个市场。");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const overrides: Record<string, number | string | null> = {};
      if (form.supplierCostCNY.trim()) overrides.supplierCostCNY = Number(form.supplierCostCNY);
      if (form.shippingCost.trim()) overrides.shippingCost = Number(form.shippingCost);
      if (form.dutyRatePct.trim()) overrides.dutyRatePct = Number(form.dutyRatePct);
      if (form.platformFeePct.trim()) overrides.platformFeePct = Number(form.platformFeePct);
      if (form.targetPrice.trim()) overrides.targetPrice = Number(form.targetPrice);
      if (form.material.trim() !== (product.attributes.material ?? "")) overrides.material = form.material.trim() || null;
      if (form.weight.trim() !== (product.attributes.weight?.toString() ?? "")) overrides.weight = form.weight.trim() ? Number(form.weight) : null;
      const data = await api<{ simulation: SimulationResult }>(`/api/products/${product.id}/simulations`, {
        method: "POST",
        body: JSON.stringify({ overrides, countries: selected, label: "What-if 情景" }),
      });
      setResult(data.simulation);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const beforeMarket = result?.before.match?.countries.find((country) => country.country === topCountry);
  const afterCountry = result?.after.match?.countries.find((country) => country.country === topCountry);
  const beforeResearch = (result?.before.markets ?? markets).find((market) => market.country === topCountry);
  const afterResearch = result?.after.markets?.find((market) => market.country === topCountry);

  return (
    <div className="grid gap-6 xl:grid-cols-[0.78fr_1.22fr] xl:items-start">
      <div className="min-w-0 space-y-4 xl:sticky xl:top-24">
        <div className="panel rounded-2xl">
          <div className="flex items-center gap-2 border-b border-white/[0.06] px-5 py-4">
            <FlaskConical className="h-4 w-4 text-cyan-300" />
            <div className="text-sm text-soft">情景输入</div>
          </div>
          <div className="space-y-4 p-5">
            <div>
              <label className="label-mono mb-2 block" htmlFor="lab-cost">供应商成本（人民币）</label>
              <input id="lab-cost" className="input-field !py-2.5 text-[13px]" inputMode="decimal" value={form.supplierCostCNY} onChange={(event) => setForm({ ...form, supplierCostCNY: event.target.value })} placeholder={product.sourcing.priceCNY?.toString() ?? "未知"} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-mono mb-2 block" htmlFor="lab-shipping">运费 / 件</label>
                <input id="lab-shipping" className="input-field !py-2.5 text-[13px]" inputMode="decimal" value={form.shippingCost} onChange={(event) => setForm({ ...form, shippingCost: event.target.value })} placeholder="自动" />
              </div>
              <div>
                <label className="label-mono mb-2 block" htmlFor="lab-weight">带包装重量（kg）</label>
                <input id="lab-weight" className="input-field !py-2.5 text-[13px]" inputMode="decimal" value={form.weight} onChange={(event) => setForm({ ...form, weight: event.target.value })} placeholder="未知" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-mono mb-2 block" htmlFor="lab-duty">关税率（%）</label>
                <input id="lab-duty" className="input-field !py-2.5 text-[13px]" inputMode="decimal" value={form.dutyRatePct} onChange={(event) => setForm({ ...form, dutyRatePct: event.target.value })} placeholder="假设值" />
              </div>
              <div>
                <label className="label-mono mb-2 block" htmlFor="lab-fee">平台佣金（%）</label>
                <input id="lab-fee" className="input-field !py-2.5 text-[13px]" inputMode="decimal" value={form.platformFeePct} onChange={(event) => setForm({ ...form, platformFeePct: event.target.value })} placeholder="15" />
              </div>
            </div>
            <div>
              <label className="label-mono mb-2 block" htmlFor="lab-price">目标零售价（当地货币）</label>
              <input id="lab-price" className="input-field !py-2.5 text-[13px]" inputMode="decimal" value={form.targetPrice} onChange={(event) => setForm({ ...form, targetPrice: event.target.value })} placeholder="留空则使用基准价" />
              <p className="mt-1.5 text-[9px] leading-relaxed text-muted/60">按每个所选市场的当地货币解释。</p>
            </div>
            <div>
              <label className="label-mono mb-2 block" htmlFor="lab-material">材质</label>
              <input id="lab-material" className="input-field !py-2.5 text-[13px]" value={form.material} onChange={(event) => setForm({ ...form, material: event.target.value })} placeholder="修改会导致合规门失效" />
            </div>
            <div>
              <div className="label-mono mb-2">情景中的市场</div>
              <div className="grid grid-cols-2 gap-1.5">
                {COUNTRY_ORDER.map((country) => (
                  <button key={country} type="button" onClick={() => toggleCountry(country)} className={cn("flex items-center gap-2 rounded-lg border px-2.5 py-2 text-[10px] transition", selected.includes(country) ? "border-cyan-300/30 bg-cyan-300/[0.06] text-cyan-100" : "border-white/10 text-muted hover:border-white/20")}>
                    <span className="font-mono text-[8px]">{COUNTRY_META[country].flag}</span>
                    {COUNTRY_META[country].name}
                  </button>
                ))}
              </div>
            </div>
            <button type="button" onClick={run} disabled={loading} className="btn-primary w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
              {loading ? "正在重算……" : "运行 What-if"}
            </button>
            {error ? <div className="rounded-lg border border-rose-300/20 bg-rose-300/[0.04] px-3 py-2.5 text-[11px] leading-relaxed text-rose-200">{error}</div> : null}
          </div>
        </div>

        <div className="rounded-xl border border-gold-400/15 bg-gold-400/[0.03] p-4">
          <div className="flex items-center gap-2 font-mono text-[9px] uppercase tracking-[0.14em] text-gold-300/80"><TriangleAlert className="h-3 w-3" /> 依赖规则</div>
          <ul className="mt-2 space-y-1.5 text-[10px] leading-relaxed text-muted">
            <li>— 成本、运费、关税和费率变化会重算定价与利润。</li>
            <li>— 材质变化会使合规门失效，并强制重新运行。</li>
            <li>— 产品或价格事实变化时，现有发布文案会标记为过时。</li>
            <li>— 已保存的产品不会被修改；这只是一次情景。</li>
          </ul>
        </div>
      </div>

      <div className="min-w-0 space-y-5">
        {!result ? (
          <div className="panel flex min-h-[420px] flex-col items-center justify-center rounded-2xl p-8 text-center">
            <FlaskConical className="h-8 w-8 text-cyan-300/60" />
            <h3 className="mt-4 text-lg text-soft">先测试，再做决定。</h3>
            <p className="mt-2 max-w-md text-[12px] leading-relaxed text-muted">
              修改那些通常会让发布失败的数字：供应商成本、运费、关税、平台佣金或零售价。
              实验室会返回前后排名，并告诉你哪些依赖输出已经失效。
            </p>
          </div>
        ) : (
          <>
            <div className="panel rounded-2xl">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
                <div>
                  <div className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-300" /><div className="text-sm text-soft">情景结果</div></div>
                  <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.12em] text-muted">{new Date(result.createdAt).toLocaleString("en-GB", { hour12: false })} · {selected.join(" / ")}</p>
                </div>
                <div className="font-mono text-[9px] text-muted">仅为情景</div>
              </div>
              <div className="grid gap-2 p-5 sm:grid-cols-2">
                {result.impacts.map((impact) => (
                  <div key={impact.module} className={cn("rounded-xl border p-3.5", ACTION_TONE[impact.action])}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-[9px] uppercase tracking-[0.12em]">{MODULE_LABEL[impact.module] ?? impact.module}</span>
                      {impact.action === "INVALIDATED" || impact.action === "REQUIRES_RERUN" ? <XCircle className="h-3.5 w-3.5" /> : impact.changed ? <RefreshCw className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                    </div>
                    <div className="mt-1.5 text-[10px] font-medium uppercase tracking-[0.08em]">{ACTION_LABEL[impact.action] ?? impact.action}</div>
                    <p className="mt-1.5 text-[10px] leading-relaxed opacity-75">{impact.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="panel rounded-2xl">
              <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
                <div className="text-sm text-soft">排名变化</div>
                <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted">之前 → 之后</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[560px] text-left">
                  <thead>
                    <tr className="border-b border-white/[0.06] font-mono text-[8px] uppercase tracking-[0.14em] text-muted">
                      <th className="px-5 py-2.5 font-normal">市场</th>
                      <th className="px-3 py-2.5 font-normal">之前</th>
                      <th className="px-3 py-2.5 font-normal">之后</th>
                      <th className="px-3 py-2.5 font-normal">之前合规门</th>
                      <th className="px-3 py-2.5 font-normal">之后合规门</th>
                      <th className="px-5 py-2.5 font-normal">之后动作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.before.match?.countries.map((before) => {
                      const after = result.after.match?.countries.find((item) => item.country === before.country);
                      return (
                        <tr key={before.country} className={cn("border-b border-white/[0.05]", before.country === topCountry && "bg-gold-400/[0.025]")}>
                          <td className="px-5 py-3 text-[11px] text-soft">{COUNTRY_META[before.country].flag} {COUNTRY_META[before.country].name}</td>
                          <td className="px-3 py-3 font-mono text-[11px] text-muted">{before.weightedScore ?? "—"}</td>
                          <td className="px-3 py-3 font-mono text-[11px] text-cyan-200">{after?.weightedScore ?? "—"}</td>
                          <td className="px-3 py-3 font-mono text-[9px] text-muted">{statusLabel(before.complianceGate)}</td>
                          <td className="px-3 py-3 font-mono text-[9px] text-amber-200">{after?.complianceGate ? statusLabel(after.complianceGate) : "—"}</td>
                          <td className="px-5 py-3 font-mono text-[9px] text-muted">{after?.recommendation ? statusLabel(after.recommendation) : "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {beforeMarket && afterCountry ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="panel-flat rounded-2xl p-5">
                  <div className="label-mono">之前 · {COUNTRY_META[topCountry].name}</div>
                  <div className="mt-3 space-y-2 text-[11px]">
                    <div className="flex justify-between gap-3"><span className="text-muted">得分</span><span className="font-mono text-soft">{beforeMarket.weightedScore ?? "—"}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-muted">到岸成本</span><span className="font-mono text-soft">{beforeResearch ? formatMoney(beforeResearch.pricing.landedCost, COUNTRY_META[topCountry].currency) : "—"}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-muted">情景零售价</span><span className="font-mono text-soft">{beforeResearch ? formatMoney(beforeResearch.pricing.suggestedRetail, COUNTRY_META[topCountry].currency) : "—"}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-muted">毛利率</span><span className="font-mono text-soft">{beforeResearch ? percentage(beforeResearch.pricing.grossMarginPct, 1) : "—"}</span></div>
                  </div>
                </div>
                <div className="panel-flat rounded-2xl border-cyan-300/20 p-5">
                  <div className="label-mono">之后 · {COUNTRY_META[topCountry].name}</div>
                  <div className="mt-3 space-y-2 text-[11px]">
                    <div className="flex justify-between gap-3"><span className="text-muted">得分</span><span className="font-mono text-cyan-200">{afterCountry.weightedScore ?? "—"}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-muted">到岸成本</span><span className="font-mono text-soft">{afterResearch ? formatMoney(afterResearch.pricing.landedCost, COUNTRY_META[topCountry].currency) : "—"}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-muted">情景零售价</span><span className="font-mono text-soft">{afterResearch ? formatMoney(afterResearch.pricing.suggestedRetail, COUNTRY_META[topCountry].currency) : "—"}</span></div>
                    <div className="flex justify-between gap-3"><span className="text-muted">毛利率</span><span className="font-mono text-soft">{afterResearch ? percentage(afterResearch.pricing.grossMarginPct, 1) : "—"}</span></div>
                  </div>
                </div>
              </div>
            ) : null}

            {result.impacts.some((impact) => impact.action === "REQUIRES_RERUN" || impact.action === "INVALIDATED") ? (
              <div className="flex items-start gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.04] px-4 py-3">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                <p className="text-[11px] leading-relaxed text-muted">
                  本次情景使依赖材料失效。使用合规结果或发布页之前，请重新运行受影响的合规检查或重新生成发布页。
                  实验室不会悄悄沿用过期证据。
                </p>
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
