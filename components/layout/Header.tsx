"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, Command, Globe2, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";

const NAV = [
  { href: "/#team", label: "AI 团队" },
  { href: "/workspace?view=board", label: "AI 董事会" },
  { href: "/workspace", label: "我的项目" },
  { href: "/workspace?view=resources", label: "资源中心" },
];

export function Header({
  appMode,
  searchMode,
  aiConfigured,
  aiModel,
}: {
  appMode: string;
  searchMode: string;
  aiConfigured: boolean;
  aiModel: string;
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const warm = pathname.startsWith("/agent") || pathname.startsWith("/passport") || (pathname.startsWith("/launch/") && pathname.endsWith("/preview"));

  useEffect(() => {
    document.body.classList.toggle("warm-body", warm);
    return () => document.body.classList.remove("warm-body");
  }, [warm]);

  // These routes render their own navigation.
  if (
    pathname === "/" || pathname.startsWith("/workspace") || pathname === "/passport-home" ||
    pathname.startsWith("/agent") ||
    pathname.startsWith("/passport") ||
    (pathname.startsWith("/launch/") && pathname.endsWith("/preview"))
  ) {
    return null;
  }

  return (
    <header className="sticky top-0 z-50 border-b border-white/[0.06] bg-[#040a12]/80 backdrop-blur-xl no-print">
      <div className="container-page flex h-[72px] items-center justify-between gap-6">
        <Link href="/" className="group flex items-center gap-3">
          <span className="relative flex h-9 w-9 items-center justify-center border border-cyan-300/30 bg-cyan-300/[0.06]">
            <span className="absolute -right-1.5 -top-1.5 h-2.5 w-2.5 border border-gold-400/60 bg-[#040a12]" />
            <Globe2 className="h-4 w-4 text-cyan-300 transition group-hover:rotate-12" strokeWidth={1.5} />
          </span>
          <span className="leading-none">
            <span className="block text-[13px] font-medium tracking-[0.18em] text-soft">PRODUCT PASSPORT</span>
            <span className="mt-1 block font-mono text-[8px] uppercase tracking-[0.26em] text-muted">
              全球市场情报
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-7 lg:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "font-mono text-[10px] uppercase tracking-[0.18em] transition",
                pathname === item.href ? "text-cyan-300" : "text-muted hover:text-soft",
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 sm:flex">
          <div className="flex items-center gap-2 border border-white/10 bg-white/[0.025] px-3 py-2">
            <Activity className="h-3 w-3 text-cyan-300" />
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted">
              {appMode === "LIVE" ? "实时模式" : "演示模式"}
            </span>
          </div>
          <div className="hidden border border-white/10 bg-white/[0.025] px-3 py-2 xl:block">
            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
              {searchMode === "LIVE_SEARCH" ? "实时搜索" : searchMode === "LOCAL_CORPUS" ? "本地证据" : "未配置搜索"}
            </span>
          </div>
          <Link href="/workspace/import" className="btn-primary !px-4 !py-2.5 text-[12px]">
            <Command className="h-3.5 w-3.5" />
            导入商品
          </Link>
          <div className="hidden text-right xl:block">
            <div className="font-mono text-[8px] uppercase tracking-[0.16em] text-muted/60">AI 引擎</div>
            <div className="font-mono text-[9px] text-cyan-300/80">{aiConfigured ? aiModel : "未配置"}</div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          className="btn-ghost !p-2.5 sm:hidden"
          aria-label="切换导航"
        >
          {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </button>
      </div>

      {open ? (
        <div className="border-t border-white/[0.06] bg-[#040a12] px-5 py-4 sm:hidden">
          <div className="flex flex-col gap-4">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted"
              >
                {item.label}
              </Link>
            ))}
            <Link href="/workspace/import" onClick={() => setOpen(false)} className="btn-primary w-full">
              导入商品
            </Link>
            <div className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">
              {appMode} · {searchMode.replaceAll("_", " ")}
            </div>
          </div>
        </div>
      ) : null}
    </header>
  );
}
