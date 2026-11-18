"use client";

import { useEffect, useState } from "react";
import {
  Check,
  Loader2,
  Pencil,
  Rocket,
  Save,
  Sparkles,
  TriangleAlert,
  X,
} from "lucide-react";
import type { ComplianceData, Country, LaunchPageContent, MarketResearchData, ProductDNA } from "@/types/domain";
import { COUNTRY_META, COUNTRY_ORDER } from "@/types/domain";
import { api, errorMessage } from "@/lib/client/api";
import { cn } from "@/lib/utils/cn";
import {
  ActionButton,
  CountryMark,
  EmptySurface,
  Kicker,
  Meta,
  Rule,
  Tag,
  WorkbenchHeading,
} from "@/components/agent/workbench";

type Payload = {
  product: ProductDNA;
  launch: LaunchPageContent | null;
  versions: LaunchPageContent[];
  markets: MarketResearchData[];
  compliance: ComplianceData[];
};

function money(value: number | null, currency: string): string {
  if (value === null || value === undefined) return "价格待定";
  try {
    return new Intl.NumberFormat("zh-CN", { style: "currency", currency, maximumFractionDigits: currency === "JPY" ? 0 : 2 }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

export function LaunchCanvas({
  product,
  country,
  revision,
  onCountryChange,
  onGoProduct,
}: {
  product: ProductDNA;
  country: Country | null;
  revision: number;
  onCountryChange: (country: Country) => void;
  onGoProduct?: () => void;
}) {
  const [data, setData] = useState<Payload | null>(null);
  const [selected, setSelected] = useState<Country>(country ?? "JP");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ headline: "", subheadline: "", description: "" });

  useEffect(() => {
    let alive = true;
    setError(null);
    fetch(`/api/products/${product.id}/launch`, { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as Payload & { error?: { message?: string } };
        if (!response.ok) throw new Error(payload.error?.message ?? "加载失败。");
        if (!alive) return;
        setData(payload);
        setSelected((current) => country ?? payload.versions[0]?.country ?? payload.markets[0]?.country ?? current);
      })
      .catch((err) => {
        if (alive) setError(errorMessage(err));
      });
    return () => {
      alive = false;
    };
  }, [product.id, revision, country]);

  useEffect(() => {
    if (country) setSelected(country);
  }, [country]);

  useEffect(() => {
    onCountryChange(selected);
  }, [onCountryChange, selected]);

  const current = data?.versions.find((version) => version.country === selected) ?? null;
  const currentMarket = data?.markets.find((market) => market.country === selected);
  const currentCheck = data?.compliance.find((check) => check.country === selected);
  const openTasks = [
    ...(currentCheck?.actionItems ?? []),
    ...(current?.complianceChecklist ?? []).filter((item) => item.status !== "DONE").map((item) => item.item),
  ].filter((item, index, all) => item && all.indexOf(item) === index);

  useEffect(() => {
    if (current) {
      setDraft({ headline: current.headline, subheadline: current.subheadline, description: current.description });
      setEditing(false);
    }
  }, [current]);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await api<{ launch: LaunchPageContent }>(`/api/products/${product.id}/launch`, {
        method: "POST",
        body: JSON.stringify({ country: selected, tone: "MINIMAL" }),
      });
      setData((prev) => {
        if (!prev) return prev;
        const versions = [result.launch, ...prev.versions.filter((version) => version.country !== result.launch.country)];
        return { ...prev, launch: result.launch, versions };
      });
      onCountryChange(selected);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const save = async () => {
    if (!current) return;
    setSaving(true);
    setError(null);
    try {
      const payload = await api<{ launch: LaunchPageContent }>(`/api/products/${product.id}/launch?country=${current.country}`, {
        method: "PATCH",
        body: JSON.stringify(draft),
      });
      setData((prev) => prev ? { ...prev, launch: payload.launch, versions: prev.versions.map((version) => version.country === payload.launch.country ? payload.launch : version) } : prev);
      setEditing(false);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (error && !data) return <EmptySurface icon={TriangleAlert} title="Market Switch 加载失败" body={error} />;
  if (!data) {
    return (
      <div className="mx-auto max-w-[1120px]">
        <div className="flex items-center gap-2 rounded-[20px] border border-[#EBE1D1] bg-[#FFFDF8] px-5 py-8 text-[11px] text-[#77857D]">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0E5C4E]" /> 正在读取已有版本…
        </div>
      </div>
    );
  }

  const meta = COUNTRY_META[selected];
  const generated = data.versions.length;
  const otherCountries = COUNTRY_ORDER.filter((item) => item !== selected);

  return (
    <div className="mx-auto max-w-[1180px] space-y-5 pb-4">
      <WorkbenchHeading
        eyebrow="03 · 启动验证 / Market Switch"
        title="一套产品，四个市场的说法。"
        description="切换国家，读取或生成本地语言版本。没有版本的国家保持真实空状态；不会预造四份完整页面。"
        action={<Tag tone={generated > 0 ? "teal" : "neutral"}>{generated}/4 个市场已有版本</Tag>}
      />

      {error ? <div className="rounded-xl border border-[#F3D0C4] bg-[#FBEBE4] px-4 py-3 text-[9.5px] leading-relaxed text-[#B3402C]">{error}</div> : null}

      {!product.confirmed ? <div className="rounded-xl border border-[#EFDCB4] bg-[#FCF2DF] px-4 py-3 text-[9.5px] leading-relaxed text-[#8A6F3C]">商品简报未确认。已有版本是基于当前未确认事实的验证素材；确认前不会生成或保存新文案。{onGoProduct ? <button type="button" onClick={onGoProduct} className="ml-2 underline decoration-[#d8c4a2] underline-offset-2">先确认商品简报</button> : null}</div> : null}

      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        {COUNTRY_ORDER.map((item) => {
          const version = data.versions.find((entry) => entry.country === item);
          const active = item === selected;
          return (
            <button
              key={item}
              type="button"
              onClick={() => {
                setSelected(item);
                onCountryChange(item);
                setEditing(false);
              }}
              className={cn(
                "flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition",
                active ? "border-[#0E5C4E] bg-[#0E5C4E] text-white" : "border-[#E3D8C6] bg-[#FFFDF8] text-[#3A5A52] hover:border-[#0E5C4E]/40",
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[8px]", active ? "border-white/30 bg-white/10" : "border-[#E3D8C6] bg-[#FBF3E7]")}>{COUNTRY_META[item].flag}</span>
                <span className="min-w-0">
                  <span className="block text-[10px] font-medium">{COUNTRY_META[item].name}</span>
                  <span className={cn("mt-0.5 block truncate text-[8px]", active ? "text-white/60" : "text-[#A2AEA6]")}>{version ? `${COUNTRY_META[item].language} · 已生成` : "未生成"}</span>
                </span>
              </span>
              <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", version ? "bg-[#0E5C4E]" : "bg-[#d9cdbb]", active && version ? "bg-white/70" : "")} />
            </button>
          );
        })}
      </div>

      {current ? (
        <div className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
          <section className="overflow-hidden rounded-[20px] border border-[#EBE1D1] bg-[#FFFDF8]">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#EFE6D8] px-5 py-3">
              <div className="flex items-center gap-2">
                <CountryMark country={current.country} size="sm" />
                <span className="text-[10px] font-medium text-[#1E413A]">{meta.name} · {meta.language}</span>
                <Tag tone={current.generatedBy === "AI" ? "teal" : "neutral"}>{current.generatedBy === "AI" ? "AI 生成" : "确定性模板"}</Tag>
              </div>
              <div className="flex items-center gap-2">
                {editing ? (
                  <>
                    <button type="button" onClick={() => void save()} disabled={saving || !product.confirmed} className="inline-flex items-center gap-1 rounded-full bg-[#0E5C4E] px-3 py-1.5 text-[9px] text-white disabled:opacity-50">
                      {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />} {saving ? "保存中…" : "保存文案"}
                    </button>
                    <button type="button" onClick={() => { setEditing(false); if (current) setDraft({ headline: current.headline, subheadline: current.subheadline, description: current.description }); }} className="rounded-full border border-[#DFD4C1] px-2.5 py-1.5 text-[9px] text-[#6B7A72]"><X className="h-3 w-3" /></button>
                  </>
                ) : (
                  <button type="button" onClick={() => setEditing(true)} disabled={!product.confirmed} className="inline-flex items-center gap-1 rounded-full border border-[#DFD4C1] px-2.5 py-1.5 text-[9px] text-[#6B7A72] hover:border-[#0E5C4E]/40 hover:text-[#0E5C4E]"><Pencil className="h-3 w-3" /> 编辑文案</button>
                )}
              </div>
            </div>

            <div className="grid gap-0 sm:grid-cols-[0.8fr_1.2fr]">
              <div className="border-b border-[#EFE6D8] bg-[#FBF3E7] p-5 sm:border-b-0 sm:border-r">
                {product.images[0] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={product.images[0]} alt={product.name} referrerPolicy="no-referrer" className="aspect-square w-full rounded-xl border border-[#E6DCCB] object-cover" />
                ) : (
                  <div className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-[#DED2BE] text-[9px] text-[#B4BEB7]">未提供商品图</div>
                )}
                <div className="mt-3 text-[8.5px] uppercase tracking-[0.12em] text-[#A2AEA6]">买家看到的第一屏</div>
                <div className="mt-1 text-[10px] text-[#6B7B72]">{meta.language} · {meta.currency}</div>
              </div>
              <div className="p-5 sm:p-6">
                {editing ? (
                  <div className="space-y-2">
                    <input value={draft.headline} maxLength={160} onChange={(event) => setDraft((value) => ({ ...value, headline: event.target.value }))} className="w-full rounded-lg border border-[#DFD4C1] bg-[#FFFDF8] px-3 py-2 text-[18px] font-medium text-[#12312A] outline-none focus:border-[#0E5C4E]" aria-label="本地化标题" />
                    <input value={draft.subheadline} maxLength={260} onChange={(event) => setDraft((value) => ({ ...value, subheadline: event.target.value }))} className="w-full rounded-lg border border-[#DFD4C1] bg-[#FFFDF8] px-3 py-2 text-[11px] text-[#1E413A] outline-none focus:border-[#0E5C4E]" aria-label="本地化副标题" />
                    <textarea value={draft.description} maxLength={1800} rows={7} onChange={(event) => setDraft((value) => ({ ...value, description: event.target.value }))} className="w-full resize-y rounded-lg border border-[#DFD4C1] bg-[#FFFDF8] px-3 py-2 text-[10.5px] leading-relaxed text-[#1E413A] outline-none focus:border-[#0E5C4E]" aria-label="本地化描述" />
                    <p className="text-[8.5px] text-[#A2AEA6]">只修改该市场的买家可见文案；产品事实、证据和合规状态不变。</p>
                  </div>
                ) : (
                  <>
                    <Kicker>{meta.localName} · buyer-facing draft</Kicker>
                    <h2 className="mt-2 text-[clamp(1.4rem,2.4vw,2rem)] font-medium leading-[1.15] tracking-[-0.035em] text-[#12312A]">{current.headline}</h2>
                    <p className="mt-2 text-[11px] leading-relaxed text-[#6B7B72]">{current.subheadline}</p>
                    <p className="mt-4 text-[10px] leading-[1.9] text-[#5A746C]">{current.description}</p>
                  </>
                )}
                <div className="mt-5 grid gap-2">
                  {current.features.slice(0, 4).map((feature) => (
                    <div key={feature.title} className="border-t border-[#F0E8DB] pt-2.5">
                      <div className="text-[10px] font-medium text-[#1E413A]">{feature.title}</div>
                      <div className="mt-0.5 text-[9px] leading-relaxed text-[#77857D]">{feature.description}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex flex-wrap items-end justify-between gap-3 border-t border-[#EFE6D8] pt-4">
                  <div>
                    <div className="font-mono text-[22px] text-[#0E5C4E]">{money(current.price, current.currency)}</div>
                    <div className="mt-0.5 max-w-[360px] text-[8.5px] leading-relaxed text-[#A2AEA6]">{current.priceNote}</div>
                  </div>
                  <span className="rounded-full bg-[#0E5C4E] px-4 py-2 text-[10px] text-white">{current.ctaLabel}</span>
                </div>
              </div>
            </div>
          </section>

          <div className="space-y-3">
            <section className="rounded-[20px] border border-[#EBE1D1] bg-[#FFFDF8] p-5">
              <div className="flex items-center justify-between gap-2">
                <Kicker>本地化营销表达</Kicker>
                <Sparkles className="h-3.5 w-3.5 text-[#B8862F]" />
              </div>
              <div className="mt-2 space-y-2">
                <Meta label="目标受众" value={current.targetAudience.join(" · ") || "未填写"} />
                <Meta label="当前市场待办" value={`${openTasks.length} 项`} note={openTasks.slice(0, 2).join("；") || "没有记录开放任务"} />
                <Meta label="生成方式" value={current.generatedBy === "AI" ? "模型生成，已按语言校验" : "确定性模板"} />
              </div>
              {currentMarket?.narrative.localizationNotes.length ? (
                <div className="mt-3 border-t border-[#F0E8DB] pt-3">
                  <Kicker>本地化注意</Kicker>
                  <ul className="mt-1.5 space-y-1">
                    {currentMarket.narrative.localizationNotes.slice(0, 3).map((note) => <li key={note} className="flex gap-1.5 text-[9px] leading-relaxed text-[#68796F]"><span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-[#B8862F]" />{note}</li>)}
                  </ul>
                </div>
              ) : null}
            </section>

            <section className="rounded-[20px] border border-[#EBE1D1] bg-[#FFFDF8] p-5">
              <div className="flex items-center justify-between gap-2">
                <Kicker>发布前清单</Kicker>
                <Tag tone="neutral">{current.complianceChecklist.length} 项</Tag>
              </div>
              <div className="mt-2 space-y-1.5">
                {current.complianceChecklist.length === 0 ? <p className="text-[9px] text-[#A2AEA6]">没有记录清单项。</p> : current.complianceChecklist.slice(0, 6).map((item) => (
                  <div key={`${item.item}-${item.sourceUrl ?? ""}`} className="flex items-start justify-between gap-2 border-t border-[#F0E8DB] py-1.5 first:border-t-0 first:pt-0">
                    <span className="text-[9px] leading-relaxed text-[#6B7B72]">{item.item}</span>
                    <Tag tone={item.status === "DONE" ? "teal" : "gold"}>{item.status === "DONE" ? "已完成" : item.status === "OPEN" ? "待完成" : "待核实"}</Tag>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[20px] border border-[#EBE1D1] bg-[#FFFDF8] p-5">
              <Kicker>供应商问题</Kicker>
              <ul className="mt-2 space-y-1.5">
                {current.supplierQuestions.slice(0, 5).map((question) => <li key={question} className="flex gap-1.5 text-[9px] leading-relaxed text-[#6B7B72]"><span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-[#B8862F]" />{question}</li>)}
              </ul>
            </section>

            <div className="flex flex-wrap gap-2">
              <ActionButton href={`/launch/${product.id}/preview?country=${current.country}`} variant="secondary">买家预览页</ActionButton>
              <ActionButton href={`/agent/${product.id}?view=markets&country=${current.country}`} variant="secondary">回到市场档案</ActionButton>
            </div>
          </div>
        </div>
      ) : (
        <section className="grid gap-0 overflow-hidden rounded-[20px] border border-[#EBE1D1] bg-[#FFFDF8] lg:grid-cols-[1.1fr_0.9fr]">
          <div className="p-6 sm:p-8">
            <CountryMark country={selected} />
            <Kicker className="mt-4">真实空状态</Kicker>
            <h2 className="mt-2 text-[26px] font-medium leading-[1.2] tracking-[-0.04em] text-[#12312A]">还没有{meta.name}版本。</h2>
            <p className="mt-2 max-w-[520px] text-[10.5px] leading-[1.9] text-[#68796F]">
              这个市场尚未生成本地化测试页。不会预先伪造标题、卖点或价格；可以直接从已确认产品事实和已有市场记录生成。
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              {product.confirmed ? (
                <ActionButton onClick={() => void generate()} disabled={busy} icon={busy ? Loader2 : Rocket}>{busy ? "正在生成本地页…" : `生成${meta.name}版本`}</ActionButton>
              ) : (
                <ActionButton onClick={onGoProduct} disabled={!onGoProduct} icon={TriangleAlert}>先确认商品简报</ActionButton>
              )}
              <ActionButton variant="secondary" href={`/agent/${product.id}?view=markets&country=${selected}`}>先看市场档案</ActionButton>
            </div>
            {error ? <p className="mt-3 rounded-lg border border-[#F3D0C4] bg-[#FBEBE4] px-3 py-2 text-[9px] text-[#B3402C]">{error}</p> : null}
            <div className="mt-5 flex items-center gap-2 text-[8.5px] text-[#A2AEA6]"><TriangleAlert className="h-3 w-3" /> 生成的是验证素材，不是正式发布或受监管声明。</div>
          </div>
          <div className="bg-[#FBF3E7] p-6 sm:p-8">
            <Kicker>已有版本</Kicker>
            <div className="mt-3 space-y-1">
              {data.versions.length === 0 ? <p className="text-[9px] text-[#A2AEA6]">还没有任何本地化版本。</p> : data.versions.map((version) => (
                <button key={version.country} type="button" onClick={() => { setSelected(version.country); onCountryChange(version.country); }} className="flex w-full items-start justify-between gap-3 border-t border-[#ECE3D5] py-2.5 text-left first:border-t-0 first:pt-0">
                  <span><span className="block text-[10px] font-medium text-[#1E413A]">{COUNTRY_META[version.country].name} · {COUNTRY_META[version.country].language}</span><span className="mt-0.5 line-clamp-1 block text-[9px] text-[#8A988F]">{version.headline}</span></span>
                  <span className="font-mono text-[8px] text-[#0E5C4E]">{COUNTRY_META[version.country].currency}</span>
                </button>
              ))}
            </div>
            <Rule className="my-3" />
            <Kicker>其他市场</Kicker>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {otherCountries.map((item) => (
                <button key={item} type="button" onClick={() => { setSelected(item); onCountryChange(item); }} className="rounded-full border border-[#E3D8C6] bg-[#FFFDF8] px-2.5 py-1 text-[8.5px] text-[#6B7A72] hover:border-[#0E5C4E]/40">
                  {COUNTRY_META[item].name}{data.versions.some((version) => version.country === item) ? " · 已生成" : " · 未生成"}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[20px] border border-[#EBE1D1] bg-[#FBF3E7] px-5 py-3.5 text-[8.5px] leading-relaxed text-[#8A988F]">
        <span>切换国家只会读取或生成该市场版本；不会复制其他国家的文案或合规判断。</span>
        <span className="inline-flex items-center gap-1"><Check className="h-3 w-3 text-[#0E5C4E]" /> 真实空状态保留</span>
      </div>
    </div>
  );
}
