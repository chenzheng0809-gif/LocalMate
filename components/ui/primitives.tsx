import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

export function Panel({
  children,
  className,
  flat = false,
  gold = false,
}: {
  children: ReactNode;
  className?: string;
  flat?: boolean;
  gold?: boolean;
}) {
  return (
    <div className={cn(gold ? "panel-gold" : flat ? "panel-flat" : "panel", "rounded-2xl", className)}>
      {children}
    </div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  action,
  className,
}: {
  eyebrow?: string;
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between", className)}>
      <div className="max-w-3xl">
        {eyebrow ? <div className="eyebrow mb-3">{eyebrow}</div> : null}
        <h2 className="display-md text-soft">{title}</h2>
        {description ? <p className="mt-3 text-sm leading-relaxed text-muted">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
  PRECHECK_COMPLETE: "预检完成",
  ACTION_REQUIRED: "需执行动作",
  REVIEW_REQUIRED: "需专业复核",
  RESTRICTED: "受限",
  OUT_OF_SCOPE: "超出范围",
  RANKED: "已排序",
  COMPARISON_INCOMPLETE: "比较未完成",
  CLEAR: "预检完成",
  CAUTION: "谨慎",
  BLOCKED: "阻断",
  UNKNOWN: "未知",
  PARTIAL: "部分完成",
  COMPLETED: "已完成",
  PENDING: "未开始",
  RUNNING: "研究中",
  FAILED: "失败",
  CONFIRMED: "已确认",
  "NEEDS REVIEW": "待复核",
  VERIFIED: "已验证",
  PARTIALLY_VERIFIED: "部分验证",
  INSUFFICIENT_EVIDENCE: "证据不足",
  "INSUFFICIENT EVIDENCE": "证据不足",
  INSUFFICIENT_DATA: "数据不足",
  PRIORITY_TEST: "优先验证",
  SECONDARY_TEST: "次级测试",
  VALIDATE_FIRST: "先验证",
  INVALIDATED: "已失效",
  UNRANKED: "未排名",
  CANDIDATE: "候选",
  MISSING_EVIDENCE: "缺少证据",
  AMBIGUOUS_CLASSIFICATION: "归类不明确",
  MISSING_ATTRIBUTE: "缺少属性",
  RESTRICTION_FOUND: "发现限制",
  POSSIBLE: "可能适用",
  IDENTIFIED: "已识别",
  NOT_IDENTIFIED: "未识别",
  OFFICIAL_TARIFF: "官方税则",
  OFFICIAL_REGULATION: "官方法规",
  OFFICIAL_GUIDANCE: "官方指南",
  RETAIL_PRICE: "零售价格",
  MARKET_REPORT: "市场报告",
  PRODUCT_PAGE: "商品页",
  USER_INPUT: "用户输入",
};

export function statusLabel(status: string): string {
  const normalized = status.toUpperCase().replaceAll("_", " ");
  return STATUS_LABELS[normalized] ?? STATUS_LABELS[status.toUpperCase()] ?? status.replaceAll("_", " ");
}

export function dataModeLabel(mode?: string | null): string {
  if (!mode) return "未知";
  return ({ LIVE: "实时数据", LOCAL_EVIDENCE: "本地证据", DEMO: "演示数据" } as Record<string, string>)[mode] ?? mode;
}

export function searchModeLabel(mode?: string | null): string {
  if (!mode) return "未知";
  return ({ LIVE_SEARCH: "实时搜索", RETAIL_PROBE: "实时商品页", LOCAL_CORPUS: "本地证据库", NONE: "无搜索" } as Record<string, string>)[mode] ?? statusLabel(mode);
}

export function signalLevelLabel(level?: string | null): string {
  if (!level) return "未知";
  return ({
    STRONG: "强",
    MODERATE: "中",
    WEAK: "弱",
    LOW: "低",
    HIGH: "高",
    NOT_ENOUGH_DATA: "数据不足",
  } as Record<string, string>)[level.toUpperCase()] ?? statusLabel(level);
}

export function verificationLabel(status?: string | null): string {
  if (!status) return "未标注";
  return ({
    VERIFIED: "已验证",
    PARTIALLY_VERIFIED: "部分验证",
    UNVERIFIED: "未验证",
    FAILED: "验证失败",
    SKIPPED: "跳过",
    PENDING: "待验证",
    FETCHED: "已抓取",
    FETCH_FAILED: "抓取失败",
    IMPORTED_SNAPSHOT: "导入快照",
  } as Record<string, string>)[status.toUpperCase()] ?? statusLabel(status);
}

export function confidenceLabel(confidence?: string | null): string {
  if (!confidence) return "";
  const normalized = confidence.toUpperCase();
  return normalized === "HIGH" ? "高" : normalized === "MEDIUM" ? "中" : normalized === "LOW" ? "低" : confidence;
}

const TONES: Record<string, string> = {
  cyan: "border-cyan-300/30 bg-cyan-300/[0.08] text-cyan-200",
  gold: "border-gold-400/30 bg-gold-400/[0.08] text-gold-300",
  green: "border-emerald-300/30 bg-emerald-300/[0.08] text-emerald-200",
  amber: "border-amber-300/30 bg-amber-300/[0.08] text-amber-200",
  red: "border-rose-300/30 bg-rose-300/[0.08] text-rose-200",
  slate: "border-white/10 bg-white/[0.03] text-muted",
  violet: "border-violet-300/30 bg-violet-300/[0.08] text-violet-200",
};

export function Chip({
  children,
  tone = "slate",
  className,
}: {
  children: ReactNode;
  tone?: keyof typeof TONES;
  className?: string;
}) {
  return <span className={cn("chip", TONES[tone] ?? TONES.slate, className)}>{children}</span>;
}

export function StatusPill({ status, className }: { status: string; className?: string }) {
  const normalized = status.toUpperCase();
  const tone =
    normalized.includes("COMPLETE") || normalized === "CLEAR" || normalized === "RANKED" || normalized === "VERIFIED"
      ? "green"
      : normalized.includes("ACTION") || normalized.includes("CAUTION") || normalized === "PARTIAL"
        ? "amber"
        : normalized.includes("REVIEW") || normalized.includes("INSUFFICIENT") || normalized === "UNKNOWN"
          ? "gold"
          : normalized.includes("BLOCK") || normalized.includes("RESTRICT") || normalized === "FAILED"
            ? "red"
            : normalized.includes("OUT_OF_SCOPE")
              ? "violet"
              : "slate";
  return (
    <Chip tone={tone} className={className}>
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {statusLabel(status)}
    </Chip>
  );
}

export function ScoreRing({
  score,
  size = 108,
  label,
  tone = "cyan",
}: {
  score: number | null;
  size?: number;
  label?: string;
  tone?: "cyan" | "gold";
}) {
  const radius = (size - 12) / 2;
  const circumference = 2 * Math.PI * radius;
  const value = score === null ? 0 : Math.max(0, Math.min(100, score));
  const dash = (value / 100) * circumference;
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="5" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={tone === "gold" ? "#f1c66d" : "#2ee8f5"}
          strokeWidth="5"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
          className="transition-all duration-700"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono text-2xl font-medium tracking-tight text-soft">
          {score === null ? "—" : Math.round(score)}
        </span>
        {label ? <span className="mt-0.5 font-mono text-[9px] uppercase tracking-[0.16em] text-muted">{label}</span> : null}
      </div>
    </div>
  );
}

export function MetricBar({
  label,
  score,
  confidence,
  note,
}: {
  label: string;
  score: number | null;
  confidence?: string;
  note?: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs text-soft/90">{label}</span>
        <span className="font-mono text-[11px] text-muted">
          {score === null ? "暂无数据" : Math.round(score)}
          {confidence ? <span className="ml-2 text-[9px] opacity-60">{confidenceLabel(confidence)}</span> : null}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={cn(
            "h-full rounded-full transition-all duration-700",
            score === null
              ? "bg-white/10"
              : score >= 65
                ? "bg-gradient-to-r from-cyan-500 to-cyan-300"
                : score >= 40
                  ? "bg-gradient-to-r from-gold-500 to-gold-300"
                  : "bg-gradient-to-r from-rose-500 to-rose-300",
          )}
          style={{ width: `${score === null ? 100 : Math.max(2, Math.min(100, score))}%` }}
        />
      </div>
      {note ? <p className="mt-1.5 text-[10px] leading-relaxed text-muted/70">{note}</p> : null}
    </div>
  );
}

export function DataOriginBadge({ mode }: { mode: string }) {
  const upper = mode.toUpperCase();
  const tone =
    upper === "LIVE" || upper === "LIVE_SEARCH" || upper === "RETAIL_PROBE"
      ? "green"
      : upper.includes("LOCAL") || upper.includes("IMPORTED")
        ? "gold"
        : upper === "DEMO"
          ? "violet"
          : "slate";
  const label =
    upper === "RETAIL_PROBE"
      ? "实时商品页"
      : upper === "LOCAL_CORPUS"
        ? "本地导入证据"
        : upper === "LOCAL_EVIDENCE"
          ? "本地证据"
          : upper === "LIVE_SEARCH"
            ? "实时搜索"
            : upper === "LIVE" || upper === "LIVE_FETCH"
              ? "实时数据"
              : upper === "DEMO"
                ? "演示数据"
                : upper === "NONE"
                  ? "未配置搜索"
                  : upper === "AI"
                    ? "AI 生成"
                    : upper === "TEMPLATE"
                      ? "确定性模板"
                      : upper.replaceAll("_", " ");
  return <Chip tone={tone}>{label}</Chip>;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <Panel flat className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      {icon ? <div className="text-cyan-300/70">{icon}</div> : null}
      <h3 className="text-lg text-soft">{title}</h3>
      <p className="max-w-md text-sm leading-relaxed text-muted">{description}</p>
      {action ? <div className="mt-2">{action}</div> : null}
    </Panel>
  );
}

export function Disclaimer({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-xl border border-gold-400/15 bg-gold-400/[0.035] px-4 py-3 text-[11px] leading-relaxed text-muted", className)}>
      <span className="mr-2 font-mono text-[9px] uppercase tracking-[0.16em] text-gold-400/80">说明</span>
      {children}
    </div>
  );
}

export function KeyValue({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-white/[0.05] py-2.5 last:border-0">
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">{label}</span>
      <span className="text-right text-xs text-soft">{value}</span>
    </div>
  );
}
