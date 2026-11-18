"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  CircleDashed,
  Loader2,
  Play,
  RefreshCw,
  TriangleAlert,
  XCircle,
} from "lucide-react";
import type { Country } from "@/types/domain";
import { COUNTRY_META, COUNTRY_ORDER } from "@/types/domain";
import { api, errorMessage } from "@/lib/client/api";
import { statusLabel } from "@/components/ui/primitives";
import { cn } from "@/lib/utils/cn";

interface ResearchJobView {
  id: string;
  status: string;
  progress: number;
  currentStage: string | null;
  countries: Country[];
  error?: string | null;
  createdAt: string;
  finishedAt?: string | null;
}

interface JobEventView {
  id: string;
  level: string;
  phase: string;
  message: string;
  country?: Country | null;
  createdAt: string;
}

export function ResearchConsole({
  productId,
  confirmed,
  initialJob,
  initialEvents,
  hasMarkets,
}: {
  productId: string;
  confirmed: boolean;
  initialJob: ResearchJobView | null;
  initialEvents: JobEventView[];
  hasMarkets: boolean;
}) {
  const router = useRouter();
  const [job, setJob] = useState<ResearchJobView | null>(initialJob);
  const [条事件, setEvents] = useState<JobEventView[]>(initialEvents);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const sourceRef = useRef<EventSource | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const connect = useCallback((jobId: string) => {
    sourceRef.current?.close();
    const source = new EventSource(`/api/research/${jobId}/stream`);
    sourceRef.current = source;
    source.addEventListener("job", (event) => {
      try {
        setJob(JSON.parse((event as MessageEvent).data) as ResearchJobView);
      } catch {
        // ignore malformed event
      }
    });
    source.addEventListener("event", (event) => {
      try {
        const parsed = JSON.parse((event as MessageEvent).data) as JobEventView;
        setEvents((current) => (current.some((item) => item.id === parsed.id) ? current : [...current, parsed].slice(-120)));
      } catch {
        // ignore malformed event
      }
    });
    source.addEventListener("done", () => {
      source.close();
      sourceRef.current = null;
      router.refresh();
    });
    source.addEventListener("error", () => {
      source.close();
      sourceRef.current = null;
    });
  }, [router]);

  useEffect(() => {
    if (initialJob && ["PENDING", "RUNNING"].includes(initialJob.status)) {
      connect(initialJob.id);
    }
    return () => {
      sourceRef.current?.close();
      sourceRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight;
  }, [条事件]);

  const start = async (force = false) => {
    setStarting(true);
    setError(null);
    setEvents([]);
    try {
      const result = await api<{ job: ResearchJobView }>("/api/research/start", {
        method: "POST",
        body: JSON.stringify({ productId, force, countries: COUNTRY_ORDER }),
      });
      setJob(result.job);
      connect(result.job.id);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setStarting(false);
    }
  };

  const completed = Boolean(job && ["COMPLETED", "PARTIAL"].includes(job.status));
  const failed = job?.status === "FAILED";
  const progress = job?.progress ?? 0;
  const phaseLabel: Record<string, string> = { MARKET: "市场", COMPLIANCE: "合规", MATCH: "匹配", RESEARCH: "研究", SYSTEM: "系统" };

  return (
    <div className="panel rounded-2xl">
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/[0.06] px-5 py-5">
        <div>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-cyan-300" />
            <h2 className="text-sm font-medium tracking-tight text-soft">研究任务</h2>
            {job ? <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">{statusLabel(job.status)}</span> : null}
          </div>
          <p className="mt-2 max-w-2xl text-[11px] leading-relaxed text-muted">
            四个市场并行推进：观察商品、需求代理、价格情景，然后进行官方来源合规预检。进度由服务端实时推送。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {completed || failed ? (
            <button type="button" onClick={() => void start(true)} disabled={starting || !confirmed} className="btn-ghost !px-3.5 !py-2 text-[11px]">
              {starting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              重新研究
            </button>
          ) : null}
          {!job ? (
            <button type="button" onClick={() => void start(false)} disabled={starting || !confirmed} className="btn-primary !px-4 !py-2 text-[11px]">
              {starting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
              开始四市场研究
            </button>
          ) : null}
          {hasMarkets ? (
            <Link href={`/discover/${productId}`} className="btn-gold !px-4 !py-2 text-[11px]">
              打开市场视图 <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ) : null}
        </div>
      </div>

      {!confirmed ? (
        <div className="mx-5 mt-5 flex items-start gap-3 rounded-xl border border-gold-400/20 bg-gold-400/[0.04] px-4 py-3">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-gold-400" />
          <div>
            <div className="text-xs text-gold-200">请先确认产品简报。</div>
            <p className="mt-1 text-[11px] leading-relaxed text-muted">
              在你确认提取字段之前，研究会被阻止，避免把 AI 猜测误当成产品事实。
            </p>
          </div>
        </div>
      ) : null}

      <div className="p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
            {job?.currentStage ?? (job ? "已完成" : "未开始")}
          </div>
          <div className="font-mono text-[11px] text-cyan-200">{Math.round(progress)}%</div>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-700",
              failed ? "bg-rose-400" : "bg-gradient-to-r from-cyan-600 via-cyan-400 to-cyan-300",
            )}
            style={{ width: `${Math.max(job ? 3 : 0, Math.min(100, progress))}%` }}
          />
        </div>

        <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {(job?.countries ?? COUNTRY_ORDER).map((country) => {
            const countryEvents = 条事件.filter((event) => event.country === country);
            const last = countryEvents.at(-1);
            const countryDone = Boolean(job && progress >= 100);
            const tone = last?.level === "ERROR" ? "red" : last?.level === "WARN" ? "amber" : countryDone && last?.level === "SUCCESS" ? "green" : last ? "cyan" : "slate";
            return (
              <div key={country} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3.5">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <div className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted">{COUNTRY_META[country].flag}</div>
                    <div className="mt-1 text-xs text-soft">{COUNTRY_META[country].name}</div>
                  </div>
                  {tone === "red" ? <XCircle className="h-4 w-4 text-rose-300" /> : tone === "amber" ? <TriangleAlert className="h-4 w-4 text-amber-300" /> : tone === "green" ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : last ? <Loader2 className="h-4 w-4 animate-spin text-cyan-300" /> : <CircleDashed className="h-4 w-4 text-muted/40" />}
                </div>
                <div className="mt-2 line-clamp-2 h-8 text-[10px] leading-relaxed text-muted">
                  {last?.message ?? "等待队列中。"}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted">智能体轨迹</span>
            <span className="font-mono text-[9px] text-muted/50">{条事件.length} 条事件</span>
          </div>
          <div ref={logRef} className="max-h-64 overflow-y-auto rounded-xl border border-white/[0.07] bg-[#030b13]/80 p-3 font-mono text-[10px] leading-relaxed">
            {条事件.length === 0 ? (
              <div className="py-6 text-center text-muted/50">
                {job ? "等待第一条事件……" : "开始一次研究，查看每个智能体决策和来源抓取。"}
              </div>
            ) : (
              条事件.map((event) => (
                <div key={event.id} className="flex gap-2 border-b border-white/[0.04] py-1.5 last:border-0">
                  <span className="shrink-0 text-muted/40">{new Date(event.createdAt).toLocaleTimeString("zh-CN", { hour12: false, timeZone: "UTC" })}Z</span>
                  <span className={cn("shrink-0 uppercase", event.level === "ERROR" ? "text-rose-300" : event.level === "WARN" ? "text-amber-300" : event.level === "SUCCESS" ? "text-emerald-300" : "text-cyan-300/70")}>{phaseLabel[event.phase] ?? event.phase}</span>
                  <span className="min-w-0 text-muted">{event.message}</span>
                </div>
              ))
            )}
          </div>
        </div>

        {job?.error ? (
          <div className="mt-3 rounded-lg border border-rose-300/20 bg-rose-300/[0.04] px-3 py-2.5 text-[11px] text-rose-200">{job.error}</div>
        ) : null}
        {error ? (
          <div className="mt-3 rounded-lg border border-rose-300/20 bg-rose-300/[0.04] px-3 py-2.5 text-[11px] text-rose-200">{error}</div>
        ) : null}
      </div>
    </div>
  );
}
