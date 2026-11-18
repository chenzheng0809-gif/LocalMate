"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  Camera,
  ClipboardPaste,
  FileText,
  ImagePlus,
  Loader2,
  ScanLine,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { api, errorMessage } from "@/lib/client/api";
import type { ProductDNA } from "@/types/domain";
import { CATEGORY_LABELS, PRODUCT_CATEGORIES } from "@/types/domain";
import { cn } from "@/lib/utils/cn";

type Mode = "url" | "image" | "manual";

const CATEGORIES = PRODUCT_CATEGORIES.filter((category) => category !== "OUT_OF_SCOPE").map((category) => ({
  value: category,
  label: CATEGORY_LABELS[category],
}));

export function ProductQuickStart() {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("url");
  const [sourceUrl, setSourceUrl] = useState("");
  const [manual, setManual] = useState({
    name: "",
    category: "DESK_ORGANIZER",
    material: "",
    dimensions: "",
    weight: "",
    priceCNY: "",
  });
  const [images, setImages] = useState<{ name: string; dataUrl: string }[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const busy = isPending || isUploading;

  const handleFiles = async (files: FileList | null) => {
    setError(null);
    if (!files) return;
    const next: { name: string; dataUrl: string }[] = [];
    for (const file of Array.from(files).slice(0, 4)) {
      if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type)) {
        setError("请使用 PNG、JPEG、WebP 或 GIF 图片。");
        continue;
      }
      if (file.size > 8 * 1024 * 1024) {
        setError("单张图片必须小于 8 MB。");
        continue;
      }
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(new Error("无法读取图片。"));
        reader.readAsDataURL(file);
      });
      next.push({ name: file.name, dataUrl });
    }
    setImages((current) => [...current, ...next].slice(0, 4));
  };

  const submit = () => {
    setError(null);
    setStatus(null);
    startTransition(async () => {
      try {
        let body: Record<string, unknown>;
        if (mode === "url") {
          if (!sourceUrl.trim()) throw new Error("请先粘贴 1688 商品链接。");
          body = { sourceUrl: sourceUrl.trim(), mode: "LIVE" };
          setStatus("正在抓取商品页并整理产品简报……");
        } else if (mode === "image") {
          if (images.length === 0) throw new Error("请至少添加一张产品图片。");
          body = { images: images.map((image) => image.dataUrl), mode: "LIVE" };
          setStatus("正在读取图片并提取产品属性……");
        } else {
          if (!manual.name.trim()) throw new Error("请填写产品名称。");
          body = {
            mode: "LIVE",
            manual: {
              name: manual.name.trim(),
              category: manual.category,
              material: manual.material || undefined,
              dimensions: manual.dimensions || undefined,
              weight: manual.weight ? Number(manual.weight) : undefined,
              priceCNY: manual.priceCNY ? Number(manual.priceCNY) : undefined,
              electrical: false,
              sourcePlatform: "MANUAL",
            },
          };
          setStatus("正在创建产品简报……");
        }
        setIsUploading(true);
        const result = await api<{ product: ProductDNA; warnings?: string[] }>("/api/products/import", {
          method: "POST",
          body: JSON.stringify(body),
        });
        setStatus("产品简报已创建。研究前请先检查并确认。");
        router.push(`/product/${result.product.id}`);
      } catch (err) {
        setError(errorMessage(err));
        setStatus(null);
      } finally {
        setIsUploading(false);
      }
    });
  };

  return (
    <div className="lm-panel lm-import max-w-3xl">
      <div className="rounded-xl">
        <div className="flex items-center gap-2 pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[var(--lm-green)]" />
            <span className="font-semibold">商品资料</span>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {[
            { id: "url" as const, label: "1688 链接", icon: ClipboardPaste },
            { id: "image" as const, label: "图片", icon: Camera },
            { id: "manual" as const, label: "手动填写", icon: FileText },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={mode === item.id}
              onClick={() => {
                setMode(item.id);
                setError(null);
              }}
              className={cn(
                "lm-secondary px-2",
                mode === item.id
                  ? "!border-[var(--lm-active)] !bg-[var(--lm-secondary-surface)]"
                  : "text-[var(--lm-muted)]",
              )}
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          ))}
        </div>

        <div className="lm-form pt-5">
          <AnimatePresence mode="wait">
            <motion.div
              key={mode}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
            >
              {mode === "url" ? (
                <div className="space-y-4">
                  <div>
                    <label className="mb-1 font-semibold" htmlFor="source-url">1688 商品链接</label>
                    <div className="relative">
                      <ScanLine className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--lm-green)]" />
                      <input
                        id="source-url"
                        className="!pl-10"
                        placeholder="https://detail.1688.com/offer/…"
                        value={sourceUrl}
                        onChange={(event) => setSourceUrl(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") submit();
                        }}
                      />
                    </div>
                    <p className="mt-2 text-[11px] leading-relaxed text-[var(--lm-muted)]">
                      服务端会在 SSRF 防护下抓取公开商品页，然后整理标题、价格、图片和属性。
                      无法读取的字段会明确标记为缺失。
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSourceUrl("https://detail.1688.com/offer/1287456370.html")}
                      className="lm-secondary"
                    >
                      试用示例链接
                    </button>
                    <span className="self-center text-xs text-[var(--lm-muted)]">不访问登录后或私有页面</span>
                  </div>
                </div>
              ) : null}

              {mode === "image" ? (
                <div className="space-y-4">
                  <button
                    type="button"
                    onClick={() => inputRef.current?.click()}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={(event) => {
                      event.preventDefault();
                      void handleFiles(event.dataTransfer.files);
                    }}
                    className="group flex w-full flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-[var(--lm-active)] bg-[var(--lm-canvas)] px-5 py-9 text-center transition hover:border-[var(--lm-active)] hover:bg-[var(--lm-secondary-surface)]"
                  >
                    <span className="flex h-11 w-11 items-center justify-center rounded-full border border-[var(--lm-line)] bg-[var(--lm-secondary-surface)]">
                      <ImagePlus className="h-5 w-5 text-[var(--lm-green)]" />
                    </span>
                    <span className="text-sm text-[var(--lm-ink)]">拖入产品图片，或点击选择文件</span>
                    <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-[var(--lm-muted)]">
                      PNG / JPEG / WEBP · 单张最大 8 MB · 最多 4 张
                    </span>
                  </button>
                  <input
                    ref={inputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    multiple
                    className="hidden"
                    onChange={(event) => void handleFiles(event.target.files)}
                  />
                  {images.length > 0 ? (
                    <div className="grid grid-cols-4 gap-2">
                      {images.map((image) => (
                        <div key={image.name + image.dataUrl.slice(-24)} className="group relative overflow-hidden rounded-lg border border-[var(--lm-line)]">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={image.dataUrl} alt={image.name} className="h-20 w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => setImages((current) => current.filter((item) => item !== image))}
                            className="absolute right-1 top-1 rounded-full bg-black/70 p-1 text-white/80 opacity-0 transition group-hover:opacity-100"
                            aria-label={`移除 ${image.name}`}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  <div className="flex items-center gap-2 text-[11px] text-[var(--lm-muted)]">
                    <Upload className="h-3 w-3 text-[var(--lm-green)]" />
                    只有 AI 服务支持视觉输入时才会做图像提取；否则产品信息会保持不完整。
                  </div>
                </div>
              ) : null}

              {mode === "manual" ? (
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <label className="mb-1 font-semibold" htmlFor="manual-name">产品名称</label>
                    <input
                      id="manual-name"
                      placeholder="例如：带抽屉的胡桃木桌面收纳盒"
                      value={manual.name}
                      onChange={(event) => setManual({ ...manual, name: event.target.value })}
                    />
                  </div>
                  <div>
                    <label className="mb-1 font-semibold" htmlFor="manual-category">品类</label>
                    <select
                      id="manual-category"
                      value={manual.category}
                      onChange={(event) => setManual({ ...manual, category: event.target.value })}
                    >
                      {CATEGORIES.map((category) => (
                        <option key={category.value} value={category.value}>{category.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 font-semibold" htmlFor="manual-material">材质</label>
                    <input
                      id="manual-material"
                      placeholder="胡桃木 / 竹 / 亚克力"
                      value={manual.material}
                      onChange={(event) => setManual({ ...manual, material: event.target.value })}
                    />
                  </div>
                  <div>
                    <label className="mb-1 font-semibold" htmlFor="manual-dimensions">尺寸</label>
                    <input
                      id="manual-dimensions"
                      placeholder="32 × 18 × 12 cm"
                      value={manual.dimensions}
                      onChange={(event) => setManual({ ...manual, dimensions: event.target.value })}
                    />
                  </div>
                  <div>
                    <label className="mb-1 font-semibold" htmlFor="manual-weight">带包装重量（kg）</label>
                    <input
                      id="manual-weight"
                      inputMode="decimal"
                      placeholder="1.2"
                      value={manual.weight}
                      onChange={(event) => setManual({ ...manual, weight: event.target.value })}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1 font-semibold" htmlFor="manual-price">供应商价格（人民币，可选）</label>
                    <input
                      id="manual-price"
                      inputMode="decimal"
                      placeholder="68"
                      value={manual.priceCNY}
                      onChange={(event) => setManual({ ...manual, priceCNY: event.target.value })}
                    />
                  </div>
                </div>
              ) : null}
            </motion.div>
          </AnimatePresence>

          <div className="mt-5 flex flex-col gap-3 border-t border-[var(--lm-line)] pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-[11px] leading-relaxed text-[var(--lm-muted)]">
              {status ? (
                <span className="flex items-center gap-2 text-[var(--lm-green)]">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  {status}
                </span>
              ) : (
                <span>电动、食品、化妆品、医疗和儿童用品不在本版本范围内。</span>
              )}
            </div>
            <button type="button" onClick={submit} disabled={busy} className="lm-primary shrink-0">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />}
              {busy ? "提取中……" : "创建商品简报"}
            </button>
          </div>

          {error ? (
            <div role="alert" className="lm-error rounded-lg border border-[#f1ced5] bg-[#fff6f8] px-3 py-2">
              {error}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
