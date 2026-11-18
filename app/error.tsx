"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LocalMateError } from "@/components/localmate/Feedback";
import { CircleAlert, RotateCcw } from "lucide-react";

export default function ErrorBoundary({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const path = usePathname();
  if (path === "/" || path.startsWith("/workspace")) return <LocalMateError retry={reset}/>;
  return (
    <div className="container-page flex min-h-[60vh] items-center justify-center py-20">
      <div className="panel max-w-xl rounded-2xl p-8">
        <CircleAlert className="h-5 w-5 text-red-300/80" />
        <div className="mt-4 font-mono text-[9px] uppercase tracking-[0.2em] text-red-200/70">运行时错误</div>
        <h1 className="mt-3 text-2xl font-medium tracking-[-0.03em] text-soft">页面无法渲染。</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          没有编造任何结果来掩盖失败。请重试请求或返回首页。如果这是数据库错误，请检查本地 SQLite 文件是否可写。
        </p>
        <pre className="mt-4 max-h-28 overflow-auto rounded-lg border border-white/[0.08] bg-black/30 p-3 font-mono text-[10px] text-muted">
          {error.message}
        </pre>
        <div className="mt-5 flex flex-wrap gap-3">
          <button type="button" onClick={reset} className="btn-primary">
            <RotateCcw className="h-4 w-4" /> Retry
          </button>
          <Link href="/" className="btn-ghost">返回首页</Link>
        </div>
      </div>
    </div>
  );
}
