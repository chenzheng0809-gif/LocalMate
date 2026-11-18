"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  ChevronDown,
  Loader2,
  Pencil,
  Save,
  Sparkles,
  Wand2,
} from "lucide-react";
import type { Country, LaunchPageContent } from "@/types/domain";
import { COUNTRY_META, COUNTRY_ORDER } from "@/types/domain";
import { statusLabel } from "@/components/ui/primitives";
import { api, errorMessage } from "@/lib/client/api";
import { formatMoney } from "@/lib/utils/money";
import { cn } from "@/lib/utils/cn";

const TONES = [
  { value: "MINIMAL", label: "极简" },
  { value: "PREMIUM", label: "高端" },
  { value: "PRACTICAL", label: "实用" },
] as const;

export function LaunchEditor({
  productId,
  initial,
  availableCountries,
}: {
  productId: string;
  initial: LaunchPageContent | null;
  availableCountries: Country[];
}) {
  const router = useRouter();
  const [launch, setLaunch] = useState<LaunchPageContent | null>(initial);
  const [country, setCountry] = useState<Country>(initial?.country ?? availableCountries[0] ?? "US");
  const [tone, setTone] = useState<(typeof TONES)[number]["value"]>("MINIMAL");
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const generate = async () => {
    setLoading(true);
    setError(null);
    setMessage(null);
    try {
      const data = await api<{ launch: LaunchPageContent }>(`/api/products/${productId}/launch`, {
        method: "POST",
        body: JSON.stringify({ country, tone }),
      });
      setLaunch(data.launch);
      setCountry(data.launch.country);
      setMessage("发布页已生成。使用前请检查和编辑。");
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const save = async () => {
    if (!launch) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const data = await api<{ launch: LaunchPageContent }>(
        `/api/products/${productId}/launch?country=${launch.country}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            headline: launch.headline,
            subheadline: launch.subheadline,
            description: launch.description,
            features: launch.features,
            targetAudience: launch.targetAudience,
            priceNote: launch.priceNote,
            ctaLabel: launch.ctaLabel,
            supplierQuestions: launch.supplierQuestions,
          }),
        },
      );
      setLaunch(data.launch);
      setMessage("已保存。");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const update = <K extends keyof LaunchPageContent>(key: K, value: LaunchPageContent[K]) => {
    if (!launch) return;
    setLaunch({ ...launch, [key]: value });
  };

  return (
    <div className="space-y-5">
      <div className="panel rounded-2xl">
        <div className="flex flex-wrap items-end gap-4 border-b border-white/[0.06] p-5">
          <div>
            <label className="label-mono mb-2 block" htmlFor="launch-country">市场</label>
            <div className="relative">
              <select id="launch-country" className="input-field min-w-40 appearance-none pr-9 !py-2.5 text-[13px]" value={country} onChange={(event) => setCountry(event.target.value as Country)}>
                {COUNTRY_ORDER.map((item) => (
                  <option key={item} value={item} disabled={!availableCountries.includes(item)}>{COUNTRY_META[item].name}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            </div>
          </div>
          <div>
            <label className="label-mono mb-2 block" htmlFor="launch-tone">语气</label>
            <div className="relative">
              <select id="launch-tone" className="input-field min-w-32 appearance-none pr-9 !py-2.5 text-[13px]" value={tone} onChange={(event) => setTone(event.target.value as typeof tone)}>
                {TONES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            </div>
          </div>
          <button type="button" onClick={generate} disabled={loading} className="btn-primary !px-4 !py-2.5 text-[12px]">
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
            {loading ? "正在生成……" : launch ? "重新生成" : "生成发布页"}
          </button>
          {launch ? (
            <div className="ml-auto flex gap-2">
              <button type="button" onClick={() => setEditing((value) => !value)} className="btn-ghost !px-3.5 !py-2.5 text-[11px]">
                {editing ? <Sparkles className="h-3.5 w-3.5" /> : <Pencil className="h-3.5 w-3.5" />}
                {editing ? "预览" : "编辑文案"}
              </button>
              <button type="button" onClick={save} disabled={saving} className="btn-gold !px-3.5 !py-2.5 text-[11px]">
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                保存
              </button>
            </div>
          ) : null}
        </div>
        {message ? <div className="border-b border-white/[0.06] px-5 py-2.5 text-[11px] text-emerald-200">{message}</div> : null}
        {error ? <div className="border-b border-white/[0.06] px-5 py-2.5 text-[11px] text-rose-200">{error}</div> : null}
        <div className="flex flex-wrap items-center gap-3 px-5 py-3 font-mono text-[9px] uppercase tracking-[0.12em] text-muted">
          <span>{launch?.generatedBy === "AI" ? `AI 生成 · ${launch.model ?? "模型"}` : launch ? "确定性模板" : "还没有页面"}</span>
          <span className="text-white/15">/</span>
          <span>{launch ? `${launch.language} · ${launch.currency}` : "语言跟随所选市场"}</span>
          <span className="text-white/15">/</span>
          <span>价格为情景，不是报价</span>
          {launch ? <a href={`/launch/${productId}/preview?country=${launch.country}`} target="_blank" rel="noreferrer" className="ml-auto inline-flex items-center gap-1 text-cyan-300/80 hover:text-cyan-200">完整预览 <ArrowUpRight className="h-3 w-3" /></a> : null}
        </div>
      </div>

      {!launch ? (
        <div className="panel flex min-h-[360px] flex-col items-center justify-center rounded-2xl p-8 text-center">
          <Wand2 className="h-8 w-8 text-cyan-300/60" />
          <h3 className="mt-4 text-lg text-soft">本地化验证页，不是上线声明。</h3>
          <p className="mt-2 max-w-lg text-[12px] leading-relaxed text-muted">
            选择市场和语气。生成器会使用已确认的产品简报、已观察定位和合规清单。
            它不能编造认证、评论或销量。
          </p>
        </div>
      ) : editing ? (
        <div className="panel rounded-2xl p-5">
          <div className="grid gap-4">
            <div>
              <label className="label-mono mb-2 block" htmlFor="launch-headline">主标题</label>
              <input id="launch-headline" className="input-field" value={launch.headline} onChange={(event) => update("headline", event.target.value)} />
            </div>
            <div>
              <label className="label-mono mb-2 block" htmlFor="launch-sub">副标题</label>
              <input id="launch-sub" className="input-field" value={launch.subheadline} onChange={(event) => update("subheadline", event.target.value)} />
            </div>
            <div>
              <label className="label-mono mb-2 block" htmlFor="launch-description">描述</label>
              <textarea id="launch-description" className="input-field min-h-32 resize-y" value={launch.description} onChange={(event) => update("description", event.target.value)} />
            </div>
            <div>
              <label className="label-mono mb-2 block">卖点</label>
              <div className="space-y-3">
                {launch.features.map((feature, index) => (
                  <div key={`${feature.title}-${index}`} className="grid gap-2 rounded-xl border border-white/[0.06] p-3 sm:grid-cols-[0.4fr_1fr]">
                    <input className="input-field !py-2 text-[12px]" value={feature.title} onChange={(event) => {
                      const next = [...launch.features];
                      next[index] = { ...next[index], title: event.target.value };
                      update("features", next);
                    }} />
                    <input className="input-field !py-2 text-[12px]" value={feature.description} onChange={(event) => {
                      const next = [...launch.features];
                      next[index] = { ...next[index], description: event.target.value };
                      update("features", next);
                    }} />
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label-mono mb-2 block" htmlFor="launch-audience">目标受众（逗号分隔）</label>
                <input id="launch-audience" className="input-field" value={launch.targetAudience.join(", ")} onChange={(event) => update("targetAudience", event.target.value.split(",").map((item) => item.trim()).filter(Boolean))} />
              </div>
              <div>
                <label className="label-mono mb-2 block" htmlFor="launch-cta">CTA 文案</label>
                <input id="launch-cta" className="input-field" value={launch.ctaLabel} onChange={(event) => update("ctaLabel", event.target.value)} />
              </div>
            </div>
            <div>
              <label className="label-mono mb-2 block" htmlFor="launch-price-note">价格说明</label>
              <input id="launch-price-note" className="input-field" value={launch.priceNote} onChange={(event) => update("priceNote", event.target.value)} />
            </div>
            <div>
              <label className="label-mono mb-2 block">供应商问题</label>
              <div className="space-y-2">
                {launch.supplierQuestions.map((question, index) => (
                  <div key={`${question}-${index}`} className="flex items-center gap-2">
                    <span className="font-mono text-[9px] text-muted">0{index + 1}</span>
                    <input className="input-field !py-2 text-[12px]" value={question} onChange={(event) => {
                      const next = [...launch.supplierQuestions];
                      next[index] = event.target.value;
                      update("supplierQuestions", next);
                    }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <LaunchPreview launch={launch} />
      )}
    </div>
  );
}

export function LaunchPreview({ launch }: { launch: LaunchPageContent }) {
  const meta = COUNTRY_META[launch.country];
  return (
    <div className="overflow-hidden rounded-2xl border border-white/[0.1] bg-[#07131e]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/[0.08] bg-white/[0.03] px-5 py-3">
        <div className="flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.16em] text-cyan-200/70">
          <span className="h-1.5 w-1.5 rounded-full bg-cyan-300" /> 验证页预览
        </div>
        <div className="font-mono text-[8px] uppercase tracking-[0.14em] text-muted">{meta.flag} {meta.name} · {launch.language}</div>
      </div>
      <div className="grid gap-8 px-6 py-10 sm:px-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
        <div>
          <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-gold-300/70">发布前概念 · {meta.name}</div>
          <h2 className="mt-4 text-[clamp(2rem,4vw,3.4rem)] font-medium leading-[0.98] tracking-[-0.04em] text-soft">{launch.headline}</h2>
          <p className="mt-4 max-w-xl text-[13px] leading-relaxed text-muted">{launch.subheadline}</p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <span className="btn-primary pointer-events-none">{launch.ctaLabel}</span>
            <span className="font-mono text-[9px] uppercase tracking-[0.12em] text-muted">无结账 · 验证素材</span>
          </div>
        </div>
        <div className="relative aspect-square overflow-hidden rounded-2xl border border-white/[0.1] bg-[radial-gradient(circle_at_30%_20%,rgba(46,232,245,0.16),transparent_55%),linear-gradient(150deg,#0c2433,#071018)]">
          <div className="absolute inset-0 grid-overlay opacity-60" />
          <div className="absolute left-1/2 top-1/2 h-36 w-44 -translate-x-1/2 -translate-y-1/2 rotate-[-6deg] rounded-lg border border-gold-400/25 bg-gradient-to-br from-[#b98954]/30 to-[#3b2415]/40 shadow-2xl">
            <div className="mx-3 mt-3 h-1.5 w-16 rounded bg-gold-300/30" />
            <div className="mx-3 mt-2 h-1 w-24 rounded bg-white/10" />
            <div className="mx-3 mt-6 h-8 rounded border border-white/10 bg-black/20" />
            <div className="mx-3 mt-2 h-5 w-16 rounded bg-cyan-300/10" />
          </div>
          <div className="absolute bottom-4 left-4 font-mono text-[8px] uppercase tracking-[0.14em] text-muted/60">产品图片占位</div>
          {launch.price !== null ? (
            <div className="absolute right-4 top-4 rounded-lg border border-white/10 bg-black/40 px-3 py-2 backdrop-blur">
              <div className="font-mono text-[8px] uppercase tracking-[0.12em] text-muted">情景价格</div>
              <div className="mt-0.5 font-mono text-sm text-soft">{formatMoney(launch.price, launch.currency)}</div>
            </div>
          ) : null}
        </div>
      </div>
      <div className="border-t border-white/[0.08] px-6 py-8 sm:px-10">
        <p className="max-w-3xl text-[13px] leading-relaxed text-muted">{launch.description}</p>
        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {launch.features.map((feature) => (
            <div key={feature.title} className="border-t border-white/[0.1] pt-4">
              <div className="text-sm text-soft">{feature.title}</div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted">{feature.description}</p>
            </div>
          ))}
        </div>
        <div className="mt-8 flex flex-wrap gap-2">
          {launch.targetAudience.map((audience) => <span key={audience} className="chip border-white/10 text-muted">{audience}</span>)}
        </div>
        <div className="mt-6 rounded-xl border border-gold-400/15 bg-gold-400/[0.03] px-4 py-3">
          <div className="font-mono text-[8px] uppercase tracking-[0.14em] text-gold-300/70">价格与主张说明</div>
          <p className="mt-1.5 text-[10px] leading-relaxed text-muted">{launch.priceNote}</p>
        </div>
        {launch.complianceChecklist.length > 0 ? (
          <div className="mt-6">
            <div className="font-mono text-[8px] uppercase tracking-[0.14em] text-muted">发布前合规清单</div>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {launch.complianceChecklist.map((item) => (
                <div key={item.item} className="flex items-start gap-2 rounded-lg border border-white/[0.07] px-3 py-2">
                  <span className={cn("mt-1 h-1.5 w-1.5 shrink-0 rounded-full", item.status === "DONE" ? "bg-emerald-300" : item.status === "OPEN" ? "bg-amber-300" : "bg-gold-400")} />
                  <div>
                    <div className="text-[10px] leading-relaxed text-muted">{item.item}</div>
                    <div className="font-mono text-[8px] uppercase tracking-[0.1em] text-muted/50">{statusLabel(item.status)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
        {launch.supplierQuestions.length > 0 ? (
          <div className="mt-6">
            <div className="font-mono text-[8px] uppercase tracking-[0.14em] text-muted">需要与供应商确认的问题</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {launch.supplierQuestions.slice(0, 4).map((question) => <span key={question} className="rounded-full border border-white/10 px-3 py-1 text-[9px] text-muted">{question}</span>)}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
