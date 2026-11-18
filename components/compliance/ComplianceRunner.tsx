"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Play, RefreshCw } from "lucide-react";
import { api, errorMessage } from "@/lib/client/api";

export function ComplianceRunner({ productId, hasChecks }: { productId: string; hasChecks: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      await api(`/api/products/${productId}/compliance`, {
        method: "POST",
        body: JSON.stringify({ countries: ["US", "JP", "DE", "UK"] }),
      });
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button type="button" onClick={run} disabled={loading} className={hasChecks ? "btn-ghost" : "btn-primary"}>
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : hasChecks ? <RefreshCw className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        {loading ? "正在检查官方来源……" : hasChecks ? "重新运行预检" : "运行四国预检"}
      </button>
      {loading ? <p className="mt-2 max-w-xs text-[10px] leading-relaxed text-muted">抓取官方页面可能需要几分钟。已验证结论必须与抓取页面中的引文精确匹配。</p> : null}
      {error ? <p className="mt-2 max-w-xs text-[11px] leading-relaxed text-rose-300">{error}</p> : null}
    </div>
  );
}
