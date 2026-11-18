"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Save, ShieldAlert, Sparkles } from "lucide-react";
import { api, errorMessage } from "@/lib/client/api";
import type { ProductDNA } from "@/types/domain";
import { CATEGORY_LABELS, PRODUCT_CATEGORIES } from "@/types/domain";
import { cn } from "@/lib/utils/cn";

const FIELD_CLASS = "input-field !py-2.5 text-[13px]";

export function ProductEditor({ product }: { product: ProductDNA }) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: product.name,
    category: product.category,
    description: product.description ?? "",
    material: product.attributes.material ?? "",
    dimensions: product.attributes.dimensions ?? "",
    packagingDimensions: product.attributes.packagingDimensions ?? "",
    weight: product.attributes.weight?.toString() ?? "",
    color: product.attributes.color ?? "",
    intendedUse: product.attributes.intendedUse ?? "",
    priceCNY: product.sourcing.priceCNY?.toString() ?? "",
    MOQ: product.sourcing.MOQ?.toString() ?? "",
    supplier: product.sourcing.supplier ?? "",
    electrical: product.attributes.electrical === true,
  });
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const dirty = JSON.stringify({
    name: product.name,
    category: product.category,
    description: product.description ?? "",
    material: product.attributes.material ?? "",
    dimensions: product.attributes.dimensions ?? "",
    packagingDimensions: product.attributes.packagingDimensions ?? "",
    weight: product.attributes.weight?.toString() ?? "",
    color: product.attributes.color ?? "",
    intendedUse: product.attributes.intendedUse ?? "",
    priceCNY: product.sourcing.priceCNY?.toString() ?? "",
    MOQ: product.sourcing.MOQ?.toString() ?? "",
    supplier: product.sourcing.supplier ?? "",
    electrical: product.attributes.electrical === true,
  }) !== JSON.stringify(form);

  const save = async () => {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const payload = {
        name: form.name.trim(),
        category: form.category,
        description: form.description.trim() || null,
        material: form.material.trim() || null,
        dimensions: form.dimensions.trim() || null,
        packagingDimensions: form.packagingDimensions.trim() || null,
        weight: form.weight ? Number(form.weight) : null,
        color: form.color.trim() || null,
        intendedUse: form.intendedUse.trim() || null,
        priceCNY: form.priceCNY ? Number(form.priceCNY) : null,
        MOQ: form.MOQ ? Number(form.MOQ) : null,
        supplier: form.supplier.trim() || null,
        electrical: form.electrical,
      };
      const result = await api<{ product: ProductDNA }>(`/api/products/${product.id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setMessage(result.product.confirmed ? "已保存，确认状态仍有效。" : "已保存。研究前需要重新确认简报。");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const confirm = async () => {
    setConfirming(true);
    setError(null);
    setMessage(null);
    try {
      await api(`/api/products/${product.id}/confirm`, {
        method: "POST",
        body: JSON.stringify({ confirm: true }),
      });
      setMessage("简报已确认。研究现在可以将这些字段视为用户核验过的事实。");
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="panel rounded-2xl">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-cyan-200/80">产品 DNA</div>
          <p className="mt-1 text-[11px] text-muted">所有字段都可以修改；实质性修改会清除确认状态。</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={save} disabled={saving || !dirty} className="btn-ghost !px-3.5 !py-2 text-[11px]">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            保存
          </button>
          <button
            type="button"
            onClick={confirm}
            disabled={confirming || product.confirmed || dirty}
            className={cn("!px-3.5 !py-2 text-[11px]", product.confirmed ? "btn-ghost text-emerald-200" : "btn-primary")}
          >
            {confirming ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            {product.confirmed ? "已确认" : "确认简报"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 p-5 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label-mono mb-2 block" htmlFor="product-name">产品名称</label>
          <input id="product-name" className={FIELD_CLASS} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        </div>
        <div>
          <label className="label-mono mb-2 block" htmlFor="product-category">品类</label>
          <select id="product-category" className={FIELD_CLASS} value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value as ProductDNA["category"] })}>
            {PRODUCT_CATEGORIES.map((category) => (
              <option key={category} value={category}>{CATEGORY_LABELS[category]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label-mono mb-2 block" htmlFor="product-material">材质</label>
          <input id="product-material" className={FIELD_CLASS} placeholder="未知" value={form.material} onChange={(event) => setForm({ ...form, material: event.target.value })} />
        </div>
        <div>
          <label className="label-mono mb-2 block" htmlFor="product-dimensions">尺寸</label>
          <input id="product-dimensions" className={FIELD_CLASS} placeholder="例如：32 × 18 × 12 cm" value={form.dimensions} onChange={(event) => setForm({ ...form, dimensions: event.target.value })} />
        </div>
        <div>
          <label className="label-mono mb-2 block" htmlFor="product-package-dimensions">包装尺寸</label>
          <input id="product-package-dimensions" className={FIELD_CLASS} placeholder="例如：48 × 35 × 35.5 cm" value={form.packagingDimensions} onChange={(event) => setForm({ ...form, packagingDimensions: event.target.value })} />
        </div>
        <div>
          <label className="label-mono mb-2 block" htmlFor="product-weight">带包装重量（kg）</label>
          <input id="product-weight" className={FIELD_CLASS} inputMode="decimal" placeholder="缺少重量会削弱运费估算" value={form.weight} onChange={(event) => setForm({ ...form, weight: event.target.value })} />
        </div>
        <div>
          <label className="label-mono mb-2 block" htmlFor="product-color">颜色 / 表面处理</label>
          <input id="product-color" className={FIELD_CLASS} value={form.color} onChange={(event) => setForm({ ...form, color: event.target.value })} />
        </div>
        <div>
          <label className="label-mono mb-2 block" htmlFor="product-use">使用场景</label>
          <input id="product-use" className={FIELD_CLASS} value={form.intendedUse} onChange={(event) => setForm({ ...form, intendedUse: event.target.value })} />
        </div>
        <div>
          <label className="label-mono mb-2 block" htmlFor="product-price">供应商价格（人民币）</label>
          <input id="product-price" className={FIELD_CLASS} inputMode="decimal" placeholder="计算利润情景时必填" value={form.priceCNY} onChange={(event) => setForm({ ...form, priceCNY: event.target.value })} />
        </div>
        <div>
          <label className="label-mono mb-2 block" htmlFor="product-moq">起订量</label>
          <input id="product-moq" className={FIELD_CLASS} inputMode="numeric" value={form.MOQ} onChange={(event) => setForm({ ...form, MOQ: event.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <label className="label-mono mb-2 block" htmlFor="product-supplier">供应商</label>
          <input id="product-supplier" className={FIELD_CLASS} placeholder="供应商或工厂名称" value={form.supplier} onChange={(event) => setForm({ ...form, supplier: event.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <label className="label-mono mb-2 block" htmlFor="product-description">产品简报 / 备注</label>
          <textarea id="product-description" className="input-field min-h-24 resize-y text-[13px]" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <label className={cn("flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition", form.electrical ? "border-rose-300/25 bg-rose-300/[0.04]" : "border-white/10 bg-white/[0.02]")}>
            <input
              type="checkbox"
              checked={form.electrical}
              onChange={(event) => setForm({ ...form, electrical: event.target.checked })}
              className="mt-0.5 h-4 w-4 accent-cyan-400"
            />
            <span>
              <span className="flex items-center gap-2 text-xs text-soft"><ShieldAlert className="h-3.5 w-3.5 text-gold-400" /> 该产品包含电子元件</span>
              <span className="mt-1 block text-[10px] leading-relaxed text-muted">
                勾选后，该产品将超出第一版范围，不会获得市场排名。
              </span>
            </span>
          </label>
        </div>
      </div>

      {message ? <div className="mx-5 mb-5 flex items-start gap-2 rounded-lg border border-emerald-300/20 bg-emerald-300/[0.05] px-3 py-2.5 text-[11px] text-emerald-200"><Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0" />{message}</div> : null}
      {error ? <div className="mx-5 mb-5 rounded-lg border border-rose-300/20 bg-rose-300/[0.05] px-3 py-2.5 text-[11px] text-rose-200">{error}</div> : null}
    </div>
  );
}
