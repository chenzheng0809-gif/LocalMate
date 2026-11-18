"use client";

import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { COUNTRY_META, type Country } from "@/types/domain";

/**
 * Shared editorial primitives for the warm workbench.
 * These are intentionally flat: one surface, hairlines, generous type scale.
 */

export function Surface({
  children,
  className,
  muted = false,
}: {
  children: React.ReactNode;
  className?: string;
  muted?: boolean;
}) {
  return (
    <section
      className={cn(
        "rounded-[20px] border border-[#EBE1D1] shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_14px_44px_rgba(54,53,42,0.035)]",
        muted ? "bg-[#FBF3E7]" : "bg-[#FFFDF8]",
        className,
      )}
    >
      {children}
    </section>
  );
}

export function Kicker({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("font-mono text-[8.5px] uppercase tracking-[0.2em] text-[#B8862F]", className)}>
      {children}
    </div>
  );
}

export function WorkbenchHeading({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="max-w-[760px]">
        {eyebrow ? <Kicker>{eyebrow}</Kicker> : null}
        <h1 className="mt-2 text-[clamp(1.55rem,2.5vw,2.35rem)] font-medium leading-[1.08] tracking-[-0.045em] text-[#12312A]">
          {title}
        </h1>
        {description ? <p className="mt-2 max-w-[680px] text-[11.5px] leading-[1.8] text-[#68796F]">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

export function Rule({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-[#ebe4d7]", className)} />;
}

export function Meta({ label, value, note }: { label: string; value: React.ReactNode; note?: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <Kicker>{label}</Kicker>
      <div className="mt-1 text-[12px] leading-[1.55] text-[#1E413A]">{value || "未提供"}</div>
      {note ? <div className="mt-0.5 text-[9px] leading-relaxed text-[#A2AEA6]">{note}</div> : null}
    </div>
  );
}

export function Tag({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "teal" | "gold" | "red" | "ink";
  className?: string;
}) {
  const tones = {
    neutral: "border-[#E8DECD] bg-[#f8f4ec] text-[#6d7068]",
    teal: "border-[#C4DED2] bg-[#E6F2EC] text-[#0E5C4E]",
    gold: "border-[#EFDCB4] bg-[#FCF0D3] text-[#8A601F]",
    red: "border-[#efd0c7] bg-[#FBEBE4] text-[#B3402C]",
    ink: "border-[#1E413A] bg-[#1E413A] text-white",
  } as const;
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-1 text-[9px] font-medium leading-none", tones[tone], className)}>
      {children}
    </span>
  );
}

export function ActionButton({
  children,
  onClick,
  href,
  variant = "primary",
  disabled,
  className,
  type = "button",
  icon: Icon,
}: {
  children: React.ReactNode;
  onClick?: () => void;
  href?: string;
  variant?: "primary" | "secondary" | "quiet" | "gold";
  disabled?: boolean;
  className?: string;
  type?: "button" | "submit";
  icon?: LucideIcon;
}) {
  const styles = {
    primary: "bg-[#0E5C4E] text-white hover:bg-[#0A4C40]",
    secondary: "border border-[#DFD4C1] bg-[#FFFDF8] text-[#3A5A52] hover:border-[#0E5C4E]/45 hover:text-[#0E5C4E]",
    quiet: "text-[#0E5C4E] hover:bg-[#edf5f0]",
    gold: "bg-[#9C6E28] text-white hover:bg-[#8f6934]",
  } as const;
  const cls = cn(
    "inline-flex items-center justify-center gap-1.5 rounded-full px-3.5 py-2 text-[10px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40",
    styles[variant],
    className,
  );
  if (href) {
    const external = /^https?:/.test(href);
    if (external) {
      return (
        <a href={href} target="_blank" rel="noreferrer noopener" className={cls}>
          {Icon ? <Icon className="h-3 w-3" /> : null}
          {children}
          <ArrowUpRight className="h-3 w-3" />
        </a>
      );
    }
    return (
      <Link href={href} className={cls}>
        {Icon ? <Icon className="h-3 w-3" /> : null}
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls}>
      {Icon ? <Icon className="h-3 w-3" /> : null}
      {children}
    </button>
  );
}

export function SignalBar({ value, tone = "teal" }: { value: number | null; tone?: "teal" | "gold" | "ink" }) {
  const color = tone === "gold" ? "bg-[#B8862F]" : tone === "ink" ? "bg-[#1E413A]" : "bg-[#0E5C4E]";
  if (value === null) {
    return (
      <div className="flex items-center gap-2">
        <div className="h-1 flex-1 rounded-full bg-[#F0E8DB]" />
        <span className="w-10 text-right font-mono text-[9px] text-[#B4BEB7]">未评分</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2">
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-[#F0E8DB]">
        <div className={cn("h-full rounded-full", color)} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
      </div>
      <span className="w-10 text-right font-mono text-[9px] text-[#53615c]">{Math.round(value)}</span>
    </div>
  );
}

export function CountryMark({ country, size = "md" }: { country: Country; size?: "sm" | "md" }) {
  const meta = COUNTRY_META[country];
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full border border-[#dcd4c5] bg-[#FFFBF3] font-mono font-medium tracking-[0.02em] text-[#44524e]",
        size === "sm" ? "h-6 w-6 text-[8px]" : "h-8 w-8 text-[9px]",
      )}
      aria-label={meta.name}
    >
      {meta.flag}
    </span>
  );
}

export function EmptySurface({
  icon: Icon,
  title,
  body,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  body: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center rounded-[20px] border border-dashed border-[#DED2BE] bg-[#FFFBF3] px-6 py-14 text-center", className)}>
      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-[#E6DCCB] bg-[#FFFDF8]">
        <Icon className="h-4 w-4 text-[#0E5C4E]" />
      </span>
      <div className="mt-3 text-[13px] font-medium text-[#1C3E36]">{title}</div>
      <p className="mt-1.5 max-w-[420px] text-[10.5px] leading-[1.8] text-[#77857D]">{body}</p>
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}

export function InlineSource({
  title,
  url,
  domain,
  note,
}: {
  title: string;
  url: string;
  domain?: string;
  note?: string;
}) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer noopener"
      className="group flex items-start justify-between gap-3 border-t border-[#F0E8DB] py-2.5 first:border-t-0 first:pt-0"
    >
      <span className="min-w-0">
        <span className="block line-clamp-2 text-[10px] leading-[1.55] text-[#3A5A52] transition group-hover:text-[#0E5C4E]">{title}</span>
        <span className="mt-0.5 block font-mono text-[8px] uppercase tracking-[0.1em] text-[#B4BEB7]">{domain ?? new URL(url).hostname.replace(/^www\./, "")}</span>
        {note ? <span className="mt-0.5 block text-[9px] leading-relaxed text-[#8A988F]">{note}</span> : null}
      </span>
      <ArrowUpRight className="mt-0.5 h-3 w-3 shrink-0 text-[#C3CAC1] transition group-hover:text-[#0E5C4E]" />
    </a>
  );
}

export function CoverNumber({ n, label }: { n: string; label: string }) {
  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="font-mono text-[8px] tracking-[0.12em] text-[#B8862F]">{n}</span>
      <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-[#B8862F]">{label}</span>
    </span>
  );
}