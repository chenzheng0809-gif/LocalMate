"use client";

import { useEffect, useState } from "react";
import {
  BadgeCheck,
  Check,
  CircleDashed,
  ExternalLink,
  FileText,
  Globe2,
  Loader2,
  Pencil,
  ShieldCheck,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import type { ProductDNA, SimulationResult } from "@/types/domain";
import { COUNTRY_META } from "@/types/domain";
import { api, errorMessage } from "@/lib/client/api";
import { cn } from "@/lib/utils/cn";
import { missingFieldLabel } from "@/lib/agent/labels";
import {
  ActionButton,
  CountryMark,
  EmptySurface,
  Kicker,
  Meta,
  Rule,
  Surface,
  Tag,
  WorkbenchHeading,
} from "@/components/agent/workbench";

const SOURCE_LABEL: Record<string, string> = {
  "1688": "1688 来源页",
  TAOBAO: "淘宝来源页",
  MANUAL: "手动输入",
  IMAGE: "图片识别",
  DEMO: "演示产品",
};

export function ProductCanvas({
  product,
  busy,
  onConfirm,
  onResearch,
  revision,
  onProductChange,
}: {
  product: ProductDNA;
  busy: boolean;
  onConfirm: () => void;
  onResearch: () => void;
  revision: number;
  onProductChange?: (product: ProductDNA) => void;
}) {
  const [editing, setEditing] = useState(false);
  const outOfScope = product.category === "OUT_OF_SCOPE" || product.attributes.electrical === true;
  const packageDimensions = product.attributes.packagingDimensions;
  const packageIsPlaceholder = Boolean(packageDimensions && /^\s*0(?:\.0+)?\s*[×x*]\s*0(?:\.0+)?(?:\s*[×x*]\s*0(?:\.0+)?)?/i.test(packageDimensions));
  const packageValid = Boolean(packageDimensions) && !packageIsPlaceholder && product.attributes.weight !== null && product.attributes.weight > 0;
  const specifications = Object.entries(product.attributes.specifications ?? {});
  const packageSource =
    product.sourcePlatform === "1688"
      ? packageDimensions
        ? "来自 1688 商品件重尺，是供应商页面观察值，不是出货实测。"
        : "1688 页面未给出可用件重尺，需向供应商索取后补齐。"
      : packageDimensions
        ? "来自商品档案，需与实际出货包装核对。"
        : "未提供包装信息，物流与利润情景只能使用默认假设。";
  const readiness = [
    { label: "产品简报已确认", done: product.confirmed, note: product.confirmed ? "用户确认证据已写入" : "确认前不启动研究" },
    { label: "包装尺寸与重量", done: packageValid, note: packageIsPlaceholder ? "来源为 0 × 0 × 0 cm，需实测后重填" : "用于物流与利润情景" },
    { label: "采购价与起订量", done: product.sourcing.priceCNY !== null && product.sourcing.MOQ !== null, note: "缺失时利润只能显示为情景假设" },
    { label: "来源与图片", done: product.images.length > 0 && (Boolean(product.sourceUrl) || product.sourcePlatform !== "MANUAL"), note: "用于核对商品形态与详情" },
  ];
  const readyCount = readiness.filter((item) => item.done).length;

  return (
    <div className="mx-auto max-w-[1120px] space-y-5 pb-4" data-revision={revision}>
      <WorkbenchHeading
        eyebrow="01 · 全球侦察 / Product DNA"
        title="先把产品事实看对。"
        description="每一条事实都保留来源和缺口。确认后才启动市场研究；没有提供的字段不会被默认值填满。"
        action={<ActionButton variant="secondary" onClick={() => setEditing((value) => !value)} icon={Pencil}>{editing ? "收起编辑" : "编辑商品事实"}</ActionButton>}
      />

      {editing ? (
        <ProductEditPanel
          key={`${product.id}-${product.updatedAt}`}
          product={product}
          onCancel={() => setEditing(false)}
          onSaved={(next) => {
            onProductChange?.(next);
            setEditing(false);
          }}
        />
      ) : null}

      {outOfScope ? (
        <div className="flex items-start gap-2 rounded-xl border border-[#F3D0C4] bg-[#FBEBE4] px-4 py-3 text-[10px] leading-relaxed text-[#B3402C]">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          该产品超出第一版范围（仅非电动家居收纳）。系统不会启动研究、合规预检或生成市场结论。
        </div>
      ) : null}

      <Surface className="overflow-hidden">
        <div className="grid gap-0 lg:grid-cols-[0.38fr_0.62fr]">
          <div className="border-b border-[#EFE6D8] bg-[#FBF1E2] p-5 sm:p-7 lg:border-b-0 lg:border-r">
            {product.images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.images[0]} alt={product.name} referrerPolicy="no-referrer" className="aspect-square w-full rounded-xl border border-[#E6DCCB] object-cover" />
            ) : (
              <div className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-[#DED2BE] text-[9px] text-[#B4BEB7]">未提供商品图</div>
            )}
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Tag tone={product.sourcePlatform === "1688" ? "teal" : "neutral"}>{SOURCE_LABEL[product.sourcePlatform] ?? product.sourcePlatform}</Tag>
              {product.sourceUrl ? <a href={product.sourceUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 rounded-full border border-[#DFD4C1] bg-[#FFFDF8] px-2 py-1 text-[8.5px] text-[#6B7A72] hover:text-[#0E5C4E]">打开来源 <ExternalLink className="h-2.5 w-2.5" /></a> : null}
            </div>
            {product.images.length > 1 ? (
              <div className="mt-3">
                <div className="text-[8px] uppercase tracking-[0.12em] text-[#A2AEA6]">来源图片 · {product.images.length} 张</div>
                <div className="mt-1.5 grid grid-cols-4 gap-1.5">
                  {product.images.slice(1, 9).map((src, index) => (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={`${src.slice(0, 24)}-${index}`} src={src} alt={`${product.name} 来源图 ${index + 2}`} referrerPolicy="no-referrer" loading="lazy" className="aspect-square rounded-md border border-[#E6DCCB] object-cover" />
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="p-5 sm:p-7">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Tag tone={product.confirmed ? "teal" : "gold"}>{product.confirmed ? "简报已确认" : "待确认"}</Tag>
                  <Tag tone="neutral">{product.category === "OUT_OF_SCOPE" ? "超出范围" : "非电动家居收纳"}</Tag>
                  <Tag tone="neutral">{product.extractionStatus === "COMPLETE" ? "字段完整" : product.extractionStatus === "PARTIAL" ? "部分字段" : "待复核"}</Tag>
                </div>
                <h2 className="mt-3 max-w-[620px] text-[clamp(1.4rem,2.5vw,2rem)] font-medium leading-[1.18] tracking-[-0.04em] text-[#12312A]">{product.name}</h2>
                {product.description ? (
                  <p
                    className={cn(
                      "mt-2 max-w-[620px] text-[10.5px] leading-[1.85] text-[#68796F]",
                      specifications.length > 0 && "line-clamp-2",
                    )}
                  >
                    {product.description}
                  </p>
                ) : null}
              </div>
              <div className="flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-full border border-[#DED2BE] bg-[#FFFBF3]">
                <span className="font-mono text-[13px] text-[#0E5C4E]">{readyCount}</span>
                <span className="text-[7px] text-[#A2AEA6]">/ {readiness.length}</span>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2 border-t border-[#EFE6D8] pt-4">
              {outOfScope ? null : !product.confirmed ? (
                <ActionButton onClick={onConfirm} disabled={busy} icon={busy ? Loader2 : BadgeCheck}>{busy ? "确认中…" : "确认产品简报"}</ActionButton>
              ) : (
                <ActionButton onClick={onResearch} icon={Globe2}>研究美国、日本、德国、英国</ActionButton>
              )}
              <ActionButton variant="secondary" href={`/passport/${product.id}`} icon={FileText}>打开数字护照</ActionButton>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
              <Meta label="材质" value={product.attributes.material ?? "未提供"} />
              <Meta label="产品尺寸" value={product.attributes.dimensions ?? "未提供"} />
              <Meta label="颜色" value={product.attributes.color ?? "未提供"} />
              <Meta label="使用场景" value={product.attributes.intendedUse ?? "未提供"} />
              <Meta label="采购价" value={product.sourcing.priceCNY !== null ? `¥${product.sourcing.priceCNY}` : "未提供"} />
              <Meta label="起订量" value={product.sourcing.MOQ ?? "未提供"} />
              <Meta label="供应商" value={product.sourcing.supplier ?? "未提供"} />
            </div>
          </div>
        </div>

        <div className="grid gap-0 border-t border-[#EFE6D8] lg:grid-cols-[1.08fr_0.92fr]">
          <div className="border-b border-[#EFE6D8] p-5 sm:p-6 lg:border-b-0 lg:border-r">
            <div className="flex items-center justify-between gap-2">
              <Kicker>商品属性</Kicker>
              <span className="text-[8px] text-[#A2AEA6]">
                {specifications.length > 0 ? `${specifications.length} 项 · 来源页原文` : "来源页未提供属性表"}
              </span>
            </div>
            {specifications.length > 0 ? (
              <dl className="mt-2.5 grid gap-x-6 gap-y-0 sm:grid-cols-2">
                {specifications.map(([name, value]) => (
                  <div key={name} className="flex items-baseline gap-3 border-t border-[#F0E8DB] py-1.5">
                    <dt className="w-[38%] shrink-0 text-[9px] leading-[1.6] text-[#8A988F]">{name}</dt>
                    <dd className="min-w-0 flex-1 text-[9.5px] leading-[1.6] text-[#3A5A52]">{value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="mt-2.5 text-[9.5px] leading-[1.8] text-[#A2AEA6]">
                来源页没有暴露可解析的属性表。可以改用「上传产品图」识别，或直接编辑上方字段；两者都会标注来源。
              </p>
            )}
            <p className="mt-3 text-[8.5px] leading-[1.8] text-[#B4BEB7]">
              属性按来源页原文保留，不做翻译或改写。用于合规预检时，商品本体属性与包装属性分开判断。
            </p>
          </div>

          <div className="p-5 sm:p-6">
            <Kicker>包装与运输</Kicker>
            <div className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-3">
              <Meta
                label="包装尺寸"
                value={packageDimensions ? `${packageDimensions}${packageIsPlaceholder ? " · 待核实" : ""}` : "未提供"}
              />
              <Meta
                label="带包装重量"
                value={product.attributes.weight !== null ? `${product.attributes.weight} kg` : "未提供"}
              />
            </div>
            <p className="mt-2 text-[8.5px] leading-[1.8] text-[#B4BEB7]">{packageSource}</p>

            <Rule className="my-4" />

            <div className="flex items-center justify-between gap-2">
              <Kicker>研究准备度</Kicker>
              <span className="text-[8px] text-[#A2AEA6]">{readyCount}/{readiness.length} 已就绪</span>
            </div>
            <div className="mt-2 space-y-2">
              {readiness.map((item) => (
                <div key={item.label} className="flex items-start gap-2 border-t border-[#F0E8DB] py-2 first:border-t-0 first:pt-0">
                  {item.done ? <Check className="mt-0.5 h-3 w-3 shrink-0 text-[#0E5C4E]" /> : <CircleDashed className="mt-0.5 h-3 w-3 shrink-0 text-[#B8862F]" />}
                  <div>
                    <div className="text-[9.5px] text-[#3A5A52]">{item.label}</div>
                    <div className="mt-0.5 text-[8.5px] leading-relaxed text-[#A2AEA6]">{item.note}</div>
                  </div>
                </div>
              ))}
            </div>

            <Rule className="my-4" />

            <Kicker>缺失 / 待补</Kicker>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {product.missingFields.length === 0 ? <Tag tone="teal">关键字段已完整</Tag> : product.missingFields.map((field) => <Tag key={field} tone="gold">{missingFieldLabel(field)}</Tag>)}
            </div>
            <p className="mt-3 text-[9px] leading-[1.8] text-[#68796F]">
              来源页提取、图片识别和用户输入分开记录。模型推断不能替代包装实测、供应商报价或官方归类。
            </p>
          </div>
        </div>
      </Surface>

      {!product.confirmed ? (
        <div className="rounded-[20px] border border-[#EFDCB4] bg-[#FCF2DF] px-5 py-4 text-[9.5px] leading-relaxed text-[#8A6F3C]">
          确认不是形式动作：系统会把当前字段和用户确认写入证据账本，之后的研究、合规和护照都引用这份确认。缺失字段不会因确认而消失。
        </div>
      ) : null}
    </div>
  );
}


function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: "text" | "number";
  hint?: string;
}) {
  return (
    <label className="block">
      <span className="block text-[8px] uppercase tracking-[0.12em] text-[#A2AEA6]">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-lg border border-[#E4D9C7] bg-[#FFFDF8] px-2.5 py-2 text-[10px] text-[#1E413A] outline-none transition focus:border-[#0E5C4E]"
      />
      {hint ? <span className="mt-1 block text-[7.5px] leading-relaxed text-[#B4BEB7]">{hint}</span> : null}
    </label>
  );
}

function ProductEditPanel({
  product,
  onCancel,
  onSaved,
}: {
  product: ProductDNA;
  onCancel: () => void;
  onSaved: (product: ProductDNA) => void;
}) {
  const [form, setForm] = useState({
    name: product.name,
    description: product.description ?? "",
    material: product.attributes.material ?? "",
    dimensions: product.attributes.dimensions ?? "",
    packagingDimensions: product.attributes.packagingDimensions ?? "",
    weight: product.attributes.weight !== null ? String(product.attributes.weight) : "",
    color: product.attributes.color ?? "",
    intendedUse: product.attributes.intendedUse ?? "",
    priceCNY: product.sourcing.priceCNY !== null ? String(product.sourcing.priceCNY) : "",
    MOQ: product.sourcing.MOQ !== null ? String(product.sourcing.MOQ) : "",
    supplier: product.sourcing.supplier ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (key: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [key]: value }));

  const save = async () => {
    setSaving(true);
    setError(null);
    const number = (value: string): number | null => {
      if (!value.trim()) return null;
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : NaN;
    };
    const weight = number(form.weight);
    const price = number(form.priceCNY);
    const moq = number(form.MOQ);
    if ([weight, price, moq].some((value) => Number.isNaN(value))) {
      setError("重量、采购价和起订量必须是有效数字；留空表示未提供。");
      setSaving(false);
      return;
    }
    try {
      const payload = await api<{ product: ProductDNA }>(`/api/products/${product.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: form.name.trim(),
          description: form.description.trim() || null,
          material: form.material.trim() || null,
          dimensions: form.dimensions.trim() || null,
          packagingDimensions: form.packagingDimensions.trim() || null,
          weight,
          color: form.color.trim() || null,
          intendedUse: form.intendedUse.trim() || null,
          priceCNY: price,
          MOQ: moq,
          supplier: form.supplier.trim() || null,
        }),
      });
      onSaved(payload.product);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Surface className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Kicker>编辑商品事实</Kicker>
          <h2 className="mt-1 text-[16px] font-medium text-[#1C3E36]">只改事实，不改证据。</h2>
          <p className="mt-1 text-[9px] leading-relaxed text-[#8A988F]">保存会标注为用户确认字段，并让产品回到“待确认”；已有市场研究不会自动重算。确认后再运行研究或合规核查。</p>
        </div>
        <Tag tone="gold">用户编辑</Tag>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div className="sm:col-span-2 lg:col-span-3">
          <Field label="商品名称" value={form.name} onChange={set("name")} placeholder="必填" />
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <label className="block">
            <span className="block text-[8px] uppercase tracking-[0.12em] text-[#A2AEA6]">商品描述</span>
            <textarea value={form.description} rows={3} onChange={(event) => set("description")(event.target.value)} className="mt-1 w-full resize-y rounded-lg border border-[#E4D9C7] bg-[#FFFDF8] px-2.5 py-2 text-[10px] leading-relaxed text-[#1E413A] outline-none focus:border-[#0E5C4E]" />
          </label>
        </div>
        <Field label="材质" value={form.material} onChange={set("material")} />
        <Field label="颜色" value={form.color} onChange={set("color")} />
        <Field label="产品尺寸" value={form.dimensions} onChange={set("dimensions")} placeholder="例如 32 × 18 × 12 cm" />
        <Field label="包装尺寸" value={form.packagingDimensions} onChange={set("packagingDimensions")} placeholder="用于物流情景" />
        <Field label="带包装重量（kg）" value={form.weight} onChange={set("weight")} type="number" placeholder="未提供" />
        <Field label="使用场景" value={form.intendedUse} onChange={set("intendedUse")} />
        <Field label="采购价（CNY）" value={form.priceCNY} onChange={set("priceCNY")} type="number" />
        <Field label="起订量" value={form.MOQ} onChange={set("MOQ")} type="number" />
        <Field label="供应商" value={form.supplier} onChange={set("supplier")} />
      </div>
      {error ? <div className="mt-3 rounded-lg border border-[#F3D0C4] bg-[#FBEBE4] px-3 py-2 text-[9px] text-[#B3402C]">{error}</div> : null}
      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#EFE6D8] pt-3">
        <ActionButton onClick={() => void save()} disabled={saving || form.name.trim().length < 2} icon={saving ? Loader2 : Check}>{saving ? "保存中…" : "保存商品事实"}</ActionButton>
        <ActionButton variant="secondary" onClick={onCancel}>取消</ActionButton>
        <span className="text-[8px] text-[#B4BEB7]">不会自动创建新证据或市场结论。</span>
      </div>
    </Surface>
  );
}

type SimulationPayload = { latest: SimulationResult | null; simulations: SimulationResult[] };

export function SimulationCanvas({
  productId,
  initial,
  revision,
  onRequestScenario,
}: {
  productId: string;
  initial: SimulationResult | null;
  revision: number;
  onRequestScenario?: () => void;
}) {
  const [data, setData] = useState<SimulationResult | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let alive = true;
    setError(null);
    fetch(`/api/products/${productId}/simulations`, { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as SimulationPayload & { error?: { message?: string } };
        if (!response.ok) throw new Error(payload.error?.message ?? "加载失败。");
        if (alive) setData(payload.latest);
        if (alive) setLoaded(true);
      })
      .catch((err) => {
        if (alive) {
          setError(errorMessage(err));
          setLoaded(true);
        }
      });
    return () => {
      alive = false;
    };
  }, [productId, revision]);

  if (error) return <EmptySurface icon={TriangleAlert} title="价格情景加载失败" body={error} />;
  if (!loaded && !data) {
    return (
      <div className="mx-auto max-w-[1000px]">
        <div className="flex items-center gap-2 rounded-[20px] border border-[#EBE1D1] bg-[#FFFDF8] px-5 py-8 text-[11px] text-[#77857D]"><Loader2 className="h-3.5 w-3.5 animate-spin text-[#0E5C4E]" /> 读取情景记录…</div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="mx-auto max-w-[1000px] space-y-5">
        <WorkbenchHeading eyebrow="02 · 出海决策 / 价格情景" title="先问“如果”，再决定投入。" description="价格模拟是可回滚的假设，不会覆盖采购价、市场证据或合规状态。" />
        <EmptySurface
          icon={Wallet}
          title="还没有价格情景"
          body="在右侧 Copilot 说“采购价降到20元会怎样？”。系统会用真实市场基准重算，并把变化和未变化分开显示。"
          action={onRequestScenario ? <ActionButton onClick={onRequestScenario}>在 Copilot 发起情景</ActionButton> : undefined}
        />
      </div>
    );
  }
  const after = data.after.match;
  return (
    <div className="mx-auto max-w-[1080px] space-y-5 pb-4">
      <WorkbenchHeading eyebrow="02 · 出海决策 / 价格情景" title="采购价变了，判断怎么变？" description="情景只用于比较，不会覆盖产品事实，也不会改写市场证据或合规状态。" action={<Tag tone="gold">可回滚假设</Tag>} />
      <Surface className="overflow-hidden">
        <div className="grid gap-5 p-5 sm:grid-cols-[1fr_auto_1fr] sm:items-center sm:p-7">
          <div className="rounded-xl border border-[#EBE0CF] bg-[#FBF3E7] p-4">
            <Kicker>商品事实</Kicker>
            <div className="mt-1 text-[28px] font-medium tracking-[-0.04em] text-[#12312A]">¥{data.before.product.sourcing.priceCNY?.toFixed(2) ?? "—"}</div>
            <div className="mt-1 text-[9px] text-[#77857D]">采购价 · 未被覆盖</div>
          </div>
          <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-full border border-[#DFD4C1] bg-[#FFFDF8] text-[#0E5C4E]"><span className="text-[13px]">→</span></div>
          <div className="rounded-xl border border-[#C4DED2] bg-[#F2F8F3] p-4">
            <Kicker>假设情景</Kicker>
            <div className="mt-1 text-[28px] font-medium tracking-[-0.04em] text-[#0E5C4E]">¥{data.overrides.supplierCostCNY?.toFixed(2) ?? "—"}</div>
            <div className="mt-1 text-[9px] text-[#7E8C84]">{data.label}</div>
          </div>
        </div>
        <div className="border-t border-[#EFE6D8] px-5 py-4 sm:px-7">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[9px] leading-relaxed text-[#77857D]">价格情景只用于比较，不会覆盖产品事实，也不会改写市场证据或合规状态。</p>
            <Tag tone="neutral">事实 / 情景分离</Tag>
          </div>
        </div>
      </Surface>

      <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <Surface className="p-5 sm:p-6">
          <Kicker>情景影响</Kicker>
          <h2 className="mt-1 text-[16px] font-medium text-[#1C3E36]">哪些模块被重算，哪些没有。</h2>
          <div className="mt-3">
            {data.impacts.map((impact) => {
              const labels = { PRODUCT_DNA: "商品事实", PRICING: "定价情景", MARKET_MATCH: "市场匹配", COMPLIANCE: "合规", LAUNCH_PAGE: "发布页" };
              return (
                <div key={impact.module} className="flex items-start justify-between gap-3 border-t border-[#F0E8DB] py-3 first:border-t-0 first:pt-0">
                  <div>
                    <div className="text-[9px] font-medium uppercase tracking-[0.1em] text-[#A2AEA6]">{labels[impact.module] ?? impact.module}</div>
                    <p className="mt-0.5 text-[9.5px] leading-[1.75] text-[#6B7B72]">{impact.detail}</p>
                  </div>
                  <Tag tone={impact.changed ? "gold" : "neutral"}>{impact.changed ? "已重算" : "未变化"}</Tag>
                </div>
              );
            })}
          </div>
        </Surface>
        <Surface className="p-5 sm:p-6">
          <Kicker>重算后的验证优先级</Kicker>
          <h2 className="mt-1 text-[16px] font-medium text-[#1C3E36]">排名变化只对情景有效。</h2>
          <div className="mt-3">
            {(after?.countries ?? []).map((row) => (
              <div key={row.country} className="flex items-center justify-between gap-3 border-t border-[#F0E8DB] py-3 first:border-t-0 first:pt-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[9px] text-[#A2AEA6]">{String(row.rank ?? "—").padStart(2, "0")}</span>
                  <CountryMark country={row.country} size="sm" />
                  <div>
                    <div className="text-[10px] text-[#1E413A]">{COUNTRY_META[row.country].name}</div>
                    <div className="mt-0.5 text-[8px] text-[#A2AEA6]">{row.complianceGate === "CAUTION" ? "合规门 · 谨慎" : row.complianceGate}</div>
                  </div>
                </div>
                <div className="font-mono text-[12px] text-[#0E5C4E]">{row.weightedScore?.toFixed(1) ?? "—"}</div>
              </div>
            ))}
          </div>
        </Surface>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[20px] border border-[#EBE1D1] bg-[#FBF3E7] px-5 py-3.5 text-[8.5px] leading-relaxed text-[#8A988F]">
        <span>想改变事实成本，需要回到 Product DNA 修改并重新确认；不是用情景覆盖。</span>
        <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3 w-3 text-[#0E5C4E]" /> 已记录模拟版本</span>
      </div>
    </div>
  );
}
