import Link from "next/link";
import { ArrowLeft, Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="container-page flex min-h-[60vh] items-center justify-center py-20">
      <div className="panel max-w-lg rounded-2xl p-8 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-cyan-300/20 bg-cyan-300/[0.06]">
          <Compass className="h-5 w-5 text-cyan-300/80" />
        </div>
        <div className="mt-5 font-mono text-[9px] uppercase tracking-[0.2em] text-cyan-200/70">404 / 未找到文件</div>
        <h1 className="mt-3 text-2xl font-medium tracking-[-0.03em] text-soft">这份护照尚未签发。</h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          你请求的产品、研究任务或护照不存在于当前本地工作区。请新建产品简报，或返回首页。
        </p>
        <Link href="/" className="btn-primary mt-6">
          <ArrowLeft className="h-4 w-4" /> 返回产品护照
        </Link>
      </div>
    </div>
  );
}
