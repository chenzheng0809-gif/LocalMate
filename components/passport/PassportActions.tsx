"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FilePlus2, Loader2, Printer } from "lucide-react";
import { api, errorMessage } from "@/lib/client/api";

export function PassportActions({
  productId,
  hasPassport,
  version,
}: {
  productId: string;
  hasPassport: boolean;
  version?: number;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setLoading(true);
    setError(null);
    try {
      await api(`/api/products/${productId}/passport`, { method: "POST" });
      router.refresh();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={create}
        disabled={loading}
        className="inline-flex items-center gap-1.5 rounded-full bg-[#0E5C4E] px-3.5 py-2 text-[10px] font-medium text-white transition hover:bg-[#0A4C40] disabled:opacity-50"
      >
        {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FilePlus2 className="h-3.5 w-3.5" />}
        {loading ? "正在生成…" : hasPassport ? "签发新版本" : "签发护照"}
      </button>
      {hasPassport ? (
        <>
          <a
            href={`/api/products/${productId}/passport/export${version ? `?version=${version}` : ""}`}
            download
            className="inline-flex items-center gap-1.5 rounded-full border border-[#DFD4C1] bg-[#FFFDF8] px-3 py-2 text-[10px] text-[#3A5A52] transition hover:border-[#0E5C4E]/40 hover:text-[#0E5C4E]"
          >
            <Download className="h-3.5 w-3.5" /> 导出 JSON
          </a>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#DFD4C1] bg-[#FFFDF8] px-3 py-2 text-[10px] text-[#3A5A52] transition hover:border-[#0E5C4E]/40 hover:text-[#0E5C4E]"
          >
            <Printer className="h-3.5 w-3.5" /> 打印 / PDF
          </button>
        </>
      ) : null}
      {error ? <span className="text-[10px] text-[#B3402C]">{error}</span> : null}
    </div>
  );
}
