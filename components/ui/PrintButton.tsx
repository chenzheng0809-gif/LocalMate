"use client";

import { Printer } from "lucide-react";

export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className="btn-ghost !px-3.5 !py-2 text-[11px]">
      <Printer className="h-3.5 w-3.5" /> 打印 / PDF
    </button>
  );
}
