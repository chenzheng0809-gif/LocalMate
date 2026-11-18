"use client";

import { usePathname } from "next/navigation";
import { LocalMateLoading } from "@/components/localmate/Feedback";

export default function Loading() {
  const path = usePathname();
  if (path === "/" || path.startsWith("/workspace")) return <LocalMateLoading/>;
  return (
    <div className="container-page py-20">
      <div className="mx-auto max-w-xl">
        <div className="font-mono text-[9px] uppercase tracking-[0.22em] text-cyan-200/70">正在组装证据页面</div>
        <div className="mt-6 h-1 w-full overflow-hidden rounded bg-white/[0.06]">
          <div className="h-full w-1/3 animate-pulse rounded bg-cyan-300/70" />
        </div>
        <p className="mt-5 text-sm text-muted">正在读取本地护照、排名和合规状态……</p>
      </div>
    </div>
  );
}
