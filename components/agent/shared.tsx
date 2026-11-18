"use client";

import Link from "next/link";
import { ArrowUpRight, CircleDashed, ExternalLink, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { COUNTRY_META, COUNTRY_ORDER, type Country } from "@/types/domain";

export function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn("rounded-2xl border border-[#E7DDCC] bg-[#FFFDF8] p-5 shadow-[0_1px_2px_rgba(35,45,40,0.03)]", className)}>{children}</section>;
}

export function Pill({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "teal" | "gold" | "red" }) {
  const styles = {
    neutral: "bg-[#f4f1e9] text-[#5b6863] border-[#e2dccf]",
    teal: "bg-[#e5f3ee] text-[#0E5C4E] border-[#c8e4d9]",
    gold: "bg-[#f8f0df] text-[#8a6328] border-[#ead9b9]",
    red: "bg-[#fbeae5] text-[#B3402C] border-[#f0cfc6]",
  }[tone];
  return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-medium", styles)}>{children}</span>;
}

export function SectionTitle({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        {eyebrow ? <div className="font-mono text-[9px] uppercase tracking-[0.18em] text-[#B8862F]">{eyebrow}</div> : null}
        <h3 className="mt-1 text-[18px] font-medium tracking-[-0.02em] text-[#12312A]">{title}</h3>
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ icon: Icon, title, body, action }: { icon: React.ComponentType<{ className?: string }>; title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-[#DED2BE] bg-[#FFFBF3] px-6 py-16 text-center">
      <Icon className="h-6 w-6 text-[#0E5C4E]" />
      <div className="mt-3 text-[14px] font-medium text-[#27373c]">{title}</div>
      <p className="mt-1.5 max-w-sm text-[11px] leading-relaxed text-[#77857D]">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function LoadingState({ label = "加载真实数据…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 rounded-2xl border border-[#E7DDCC] bg-[#FFFDF8] px-5 py-16 text-[11px] text-[#77857D]">
      <RefreshCw className="h-3.5 w-3.5 animate-spin text-[#0E5C4E]" /> {label}
    </div>
  );
}

export function CountryTabs({ value, onChange, counts }: { value: Country | null; onChange: (country: Country) => void; counts?: Partial<Record<Country, string>> }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {COUNTRY_ORDER.map((country) => (
        <button
          key={country}
          type="button"
          onClick={() => onChange(country)}
          className={cn(
            "rounded-full border px-3 py-1.5 text-[10px] transition",
            value === country ? "border-[#0E5C4E] bg-[#0E5C4E] text-white" : "border-[#E3D8C6] bg-white text-[#6B7B72] hover:border-[#0E5C4E]/40",
          )}
        >
          {COUNTRY_META[country].flag} {COUNTRY_META[country].name}{counts?.[country] ? ` · ${counts[country]}` : ""}
        </button>
      ))}
    </div>
  );
}

export function ExternalSource({ title, url, note }: { title: string; url: string; note?: string }) {
  return (
    <a href={url} target="_blank" rel="noreferrer" className="group flex items-start justify-between gap-3 rounded-lg border border-[#F0E8DB] bg-[#FFFDF8] px-3 py-2.5 transition hover:border-[#0E5C4E]/30">
      <div className="min-w-0">
        <div className="truncate text-[11px] text-[#1E413A] group-hover:text-[#0E5C4E]">{title}</div>
        {note ? <div className="mt-0.5 text-[9px] text-[#A2AEA6]">{note}</div> : null}
      </div>
      <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-[#B4BEB7] group-hover:text-[#0E5C4E]" />
    </a>
  );
}

export function GatePill({ gate }: { gate: string }) {
  const tone = gate === "CLEAR" ? "teal" : gate === "BLOCKED" ? "red" : gate === "CAUTION" ? "gold" : "neutral";
  return <Pill tone={tone}>合规门 · {gate === "CLEAR" ? "可进入下一步" : gate === "BLOCKED" ? "阻断" : gate === "CAUTION" ? "谨慎" : "未知"}</Pill>;
}

export function DataFootnote({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 flex items-start gap-1.5 text-[9px] leading-relaxed text-[#A2AEA6]"><CircleDashed className="mt-0.5 h-2.5 w-2.5 shrink-0" />{children}</p>;
}

export function DeepLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} className="inline-flex items-center gap-1 text-[10px] text-[#0E5C4E] hover:underline">{children}<ArrowUpRight className="h-3 w-3" /></Link>;
}

export { COUNTRY_META, COUNTRY_ORDER };
export type { Country };
