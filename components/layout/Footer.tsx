"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";

export function Footer() {
  const pathname = usePathname();
  if (pathname === "/" || pathname.startsWith("/workspace") || pathname.startsWith("/agent") || pathname.startsWith("/passport") || (pathname.startsWith("/launch/") && pathname.endsWith("/preview"))) return null;
  return (
    <footer className="no-print mt-24 border-t border-white/[0.06]">
      <div className="container-page py-12">
        <div className="grid gap-10 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-cyan-300/70">Product Passport</div>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted">
              一个产品，无限可能。为跨境电商卖家打造的决策支持工作区：先判断哪个市场值得验证，
              再找出花钱之前必须补齐的问题。
            </p>
          </div>
          <div>
            <div className="label-mono">导航</div>
            <div className="mt-4 flex flex-col gap-2.5 text-xs text-muted">
              <Link href="/#team" className="hover:text-soft">AI 团队</Link>
              <Link href="/workspace?view=board" className="hover:text-soft">AI 董事会</Link>
              <Link href="/workspace?view=resources" className="hover:text-soft">资源中心</Link>
              <Link href="/workspace/import" className="hover:text-soft">导入商品</Link>
            </div>
          </div>
          <div>
            <div className="label-mono">请先读清边界</div>
            <p className="mt-4 text-[11px] leading-relaxed text-muted">
              市场观察有日期、有样本限制。搜索结果只是线索，不是已核实的事实。
              HS 编码只是候选，不是有约束力的归类。合规预检不构成法律意见或官方认证。
            </p>
            <Link href="/workspace?view=resources" className="link-cyan mt-4 inline-flex items-center gap-1 text-[11px]">
              查看资源中心 <ArrowUpRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
        <div className="mt-10 flex flex-col gap-3 border-t border-white/[0.06] pt-5 font-mono text-[9px] uppercase tracking-[0.16em] text-muted/60 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Product Passport · 黑客松构建</span>
          <span>先证据，后投入 · 不制造虚假确定性</span>
        </div>
      </div>
    </footer>
  );
}
