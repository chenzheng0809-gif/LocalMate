"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Play } from "lucide-react";
import { api, errorMessage } from "@/lib/client/api";
import type { ProductDNA } from "@/types/domain";

export function DemoLauncher({ variant = "primary" }: { variant?: "primary" | "quiet" }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api<{ product: ProductDNA }>("/api/demo/seed", { method: "POST" });
      router.push(`/product/${result.product.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={load}
        disabled={loading}
        className={variant === "primary" ? "btn-gold" : "btn-ghost"}
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
        {loading ? "正在载入演示简报……" : "载入演示产品"}
        {!loading ? <ArrowRight className="h-4 w-4" /> : null}
      </button>
      {error ? <p className="mt-2 max-w-xs text-[11px] text-rose-300">{error}</p> : null}
      <p className="mt-2 max-w-xs text-[10px] leading-relaxed text-muted/70">
        仅演示简报：供应商价格和 MOQ 为示意数据。市场页面使用真实公开商品页。
      </p>
    </div>
  );
}
