"use client";

import { Printer } from "lucide-react";

export function PreviewPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex items-center gap-1.5 rounded-full border border-[#d9d0c0] bg-[#fffdf8] px-3 py-2 text-[10px] text-[#43534f] transition hover:border-[#0f6f67]/40 hover:text-[#0f6f67]"
    >
      <Printer className="h-3.5 w-3.5" /> 打印 / PDF
    </button>
  );
}
