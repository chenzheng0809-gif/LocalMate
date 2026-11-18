"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  CircleDashed,
  Compass,
  FileText,
  Globe2,
  ImagePlus,
  Loader2,
  Package,
  PanelRightClose,
  PanelRightOpen,
  Rocket,
  Send,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
} from "lucide-react";
import { api, errorMessage } from "@/lib/client/api";
import { cn } from "@/lib/utils/cn";
import type { AgentMessage, AgentReply, AgentSource, AgentView } from "@/types/agent";
import type {
  ComplianceData,
  Country,
  LaunchPageContent,
  MarketResearchData,
  MatchAnalysis,
  PassportSnapshot,
  ProductDNA,
  ResearchJob,
  ResearchJobEvent,
  SimulationResult,
} from "@/types/domain";
import { COUNTRY_META } from "@/types/domain";
import { find1688Url } from "@/lib/agent/product-url";
import { MarketsCanvas } from "@/components/agent/MarketDossier";
import { ComplianceCanvas } from "@/components/agent/ComplianceBoard";
import { LaunchCanvas } from "@/components/agent/LaunchSwitch";
import { PassportCanvas } from "@/components/agent/PassportDocument";
import { ProductCanvas, SimulationCanvas } from "@/components/agent/ProductWorkbench";

type Summary = {
  marketCount: number;
  complianceCount: number;
  hasMatch: boolean;
  hasLaunch: boolean;
};

type JobPayload = { job: ResearchJob; events: ResearchJobEvent[] };

const VIEW_LABEL: Record<AgentView, string> = {
  overview: "产品概览",
  product: "商品档案",
  markets: "市场档案",
  compliance: "合规任务板",
  simulation: "价格情景",
  launch: "Market Switch",
  passport: "数字护照",
};

const STEPS = ["商品信息提取", "多国市场研究", "合规证据检索", "机会分析", "上市方案生成"];

const STAGE_OF: Record<AgentView, "01" | "02" | "03"> = {
  overview: "01",
  product: "01",
  markets: "02",
  compliance: "02",
  simulation: "02",
  launch: "03",
  passport: "03",
};

const STAGES = [
  { n: "01", label: "全球侦察", sub: "商品事实 · 四国研究", view: "overview" as AgentView },
  { n: "02", label: "出海决策", sub: "市场档案 · 合规 · 情景", view: "markets" as AgentView },
  { n: "03", label: "启动验证", sub: "本地化 · 数字护照", view: "launch" as AgentView },
];

const NAV_GROUPS: Array<{
  n: string;
  label: string;
  items: Array<{ view: AgentView; label: string; icon: typeof Compass }>;
}> = [
  { n: "01", label: "侦察", items: [{ view: "overview", label: "概览", icon: Compass }, { view: "product", label: "商品", icon: Package }] },
  { n: "02", label: "决策", items: [{ view: "markets", label: "市场", icon: Globe2 }, { view: "compliance", label: "合规", icon: ShieldCheck }, { view: "simulation", label: "价格", icon: Wallet }] },
  { n: "03", label: "验证", items: [{ view: "launch", label: "启动", icon: Rocket }, { view: "passport", label: "护照", icon: FileText }] },
];

const CONTEXT_PROMPTS: Record<AgentView, string[]> = {
  overview: ["研究美国、日本、德国和英国", "德国有哪些合规要求？"],
  product: ["研究美国、日本、德国和英国", "德国有哪些合规要求？"],
  markets: ["英国和德国对比", "德国有哪些合规要求？", "帮我生成日本市场商品页"],
  compliance: ["英国有哪些合规要求？", "这个产品还需要补充什么事实？"],
  simulation: ["采购价降到20元会怎样？", "采购价降到35元会怎样？"],
  launch: ["帮我生成德国市场商品页", "创建产品护照"],
  passport: ["创建新的产品护照版本", "导出 JSON"],
};

function timeLabel(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
}

const INTAKE_SOURCE_LABEL: Record<string, string> = {
  "1688": "1688 链接",
  TAOBAO: "淘宝链接",
  IMAGE: "产品图片",
  MANUAL: "手动输入",
  DEMO: "演示数据",
};

/**
 * A factual summary of what the intake actually captured. It reports counts
 * and gaps only — it never claims a field was "extracted" when it is absent.
 */
function buildIntakeSummary(product: ProductDNA): string {
  const source = INTAKE_SOURCE_LABEL[product.sourcePlatform] ?? product.sourcePlatform;
  const parts: string[] = [];
  if (product.images.length > 0) parts.push(`${product.images.length} 张商品图`);
  const specCount = Object.keys(product.attributes.specifications ?? {}).length;
  if (specCount > 0) parts.push(`${specCount} 项商品属性`);
  if (product.sourcing.priceCNY !== null) parts.push(`采购价 ¥${product.sourcing.priceCNY}`);
  const packageDimensions = product.attributes.packagingDimensions;
  if (packageDimensions) {
    parts.push(
      `包装 ${packageDimensions}${product.attributes.weight !== null ? ` / ${product.attributes.weight} kg` : ""}`,
    );
  } else {
    parts.push("包装尺寸未取得");
  }
  return `已读取「${product.name}」：从${source}取得${parts.join("、")}。`;
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const data = (await response.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(data.error?.message ?? "加载失败。");
  return data;
}

export function AgentWorkspace({
  initialProduct,
  initialSummary,
  initialJob,
  initialPrompt,
  initialView,
  initialCountry,
}: {
  initialProduct: ProductDNA;
  initialSummary: Summary;
  initialJob: ResearchJob | null;
  initialPrompt?: string;
  initialView?: AgentView;
  initialCountry?: Country;
}) {
  const router = useRouter();
  const [product, setProduct] = useState(initialProduct);
  const [summary, setSummary] = useState(initialSummary);
  const [view, setView] = useState<AgentView>(initialView ?? (initialSummary.marketCount > 0 ? "markets" : "overview"));
  const [country, setCountry] = useState<Country | null>(initialCountry ?? null);
  const [revision, setRevision] = useState(0);
  const storageKey = `pp-copilot-v1-${initialProduct.id}`;
  const welcome = useMemo<AgentMessage[]>(() => {
    const running = initialJob && ["PENDING", "RUNNING"].includes(initialJob.status);
    const failed = initialJob?.status === "FAILED";
    return [
      {
        id: "welcome",
        role: "assistant",
        text: failed
          ? `最近一次四国研究失败：${initialJob.error ?? "未知错误"}。失败的任务不会生成虚假结果；你可以查看已写入的部分，或在确认商品事实后重新运行。`
          : running
            ? `四国研究正在执行：${initialJob.currentStage ?? "准备中"}（${initialJob.progress}%）。我会在右侧持续显示真实步骤；未完成的结果不会提前写成市场结论。`
            : `我是 Product Passport，你的出海 Copilot。${buildIntakeSummary(initialProduct)}。${
                initialProduct.confirmed
                  ? "产品简报已确认，可以开始真实研究。"
                  : "请先在工作台的商品档案里核对并确认；确认前我不会启动研究。"
              }`,
        nextActions: failed ? ["重新研究四国市场"] : running ? ["现在到哪一步了？"] : initialProduct.confirmed ? ["研究美国、日本、德国和英国"] : ["确认产品简报"],
        createdAt: new Date().toISOString(),
      },
    ];
  }, [initialJob, initialProduct]);
  const [messages, setMessages] = useState<AgentMessage[]>(welcome);
  const [feedLoaded, setFeedLoaded] = useState(false);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [busyNote, setBusyNote] = useState<string | null>(null);
  const [files, setFiles] = useState<Array<{ name: string; dataUrl: string }>>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const [jobId, setJobId] = useState<string | null>(initialJob && ["PENDING", "RUNNING"].includes(initialJob.status) ? initialJob.id : null);
  const [job, setJob] = useState<JobPayload | null>(null);
  const [jobOpen, setJobOpen] = useState(true);
  const [, setLaunch] = useState<LaunchPageContent | null>(null);
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [passport, setPassport] = useState<PassportSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastSources, setLastSources] = useState<AgentSource[]>([]);
  const feedRef = useRef<HTMLDivElement>(null);
  const pendingAction = useRef<string | null>(null);
  const autoSent = useRef(false);
  const loadedKey = useRef<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth >= 1024) setCopilotOpen(true);
  }, []);

  useEffect(() => {
    const load = () => {
      try {
        const raw = localStorage.getItem(storageKey);
        if (raw) {
          const parsed = JSON.parse(raw) as AgentMessage[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            // The greeting is a function of the current product state, so it is
            // always rebuilt; only the real conversation history is restored.
            setMessages(parsed.map((message) => (message.id === "welcome" ? welcome[0] : message)));
            return;
          }
        }
      } catch {
        // optional local history
      }
      setMessages(welcome);
    };
    if (loadedKey.current === storageKey) return;
    loadedKey.current = storageKey;
    load();
    setFeedLoaded(true);
  }, [storageKey, welcome]);

  const scrollFeed = useCallback(() => {
    requestAnimationFrame(() => feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: "smooth" }));
  }, []);

  useEffect(() => {
    if (!feedLoaded) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(messages.slice(-40)));
    } catch {
      // ignore quota
    }
    scrollFeed();
  }, [feedLoaded, messages, scrollFeed, storageKey]);

  const refreshSummary = useCallback(async () => {
    try {
      const data = await getJson<{
        markets: MarketResearchData[];
        compliance: ComplianceData[];
        match: MatchAnalysis | null;
        product: ProductDNA;
      }>(`/api/products/${product.id}/markets`);
      setSummary((current) => ({
        marketCount: data.markets.length,
        complianceCount: data.compliance.length,
        hasMatch: Boolean(data.match),
        hasLaunch: current.hasLaunch,
      }));
      setProduct(data.product);
    } catch {
      // canvas has its own error state
    }
  }, [product.id]);

  const addFiles = async (list: FileList | null) => {
    if (!list) return;
    setError(null);
    const next = [...files];
    for (const file of Array.from(list)) {
      if (next.length >= 4) break;
      if (!file.type.startsWith("image/")) continue;
      if (file.size > 6 * 1024 * 1024) {
        setError(`图片 ${file.name} 超过 6MB，请压缩后再试。`);
        continue;
      }
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
        reader.readAsDataURL(file);
      });
      if (dataUrl) next.push({ name: file.name, dataUrl });
    }
    setFiles(next);
  };

  const send = useCallback(
    async (raw: string, options?: { appendUser?: boolean }) => {
      const text = raw.trim();
      const url = find1688Url(text);
      if ((!text && files.length === 0 && !url) || busy) return;
      const appendUser = options?.appendUser !== false;
      const displayText = text || "上传产品图，识别产品参数";
      setInput("");
      setError(null);
      setBusy(true);
      setBusyNote(url ? "正在抓取 1688 商品信息…" : files.length > 0 ? "正在识别产品图…" : null);
      if (appendUser) {
        setMessages((current) => [
          ...current,
          { id: `u-${Date.now()}`, role: "user", text: displayText, createdAt: new Date().toISOString() },
        ]);
      }
      try {
        if (url || files.length > 0) {
          const result = await api<{ product: ProductDNA }>("/api/agent/intake", {
            method: "POST",
            body: JSON.stringify(
              url
                ? { message: text || "请抓取这个 1688 商品并提取属性、包装和详情。", sourceUrl: url }
                : { message: text || "请识别这张产品图片，提取可用于研究和合规预检的参数。", images: files.map((file) => file.dataUrl) },
            ),
          });
          setBusyNote("正在建立新产品档案…");
          router.push(`/agent/${result.product.id}`);
          return;
        }
        const reply = await api<AgentReply>(`/api/agent/${product.id}/message`, {
          method: "POST",
          body: JSON.stringify({ message: text, context: { view, country } }),
        });
        setMessages((current) => [
          ...current,
          {
            id: `a-${Date.now()}`,
            role: "assistant",
            text: reply.reply,
            card: reply.card,
            sources: reply.sources,
            nextActions: reply.nextActions,
            createdAt: new Date().toISOString(),
          },
        ]);
        if (reply.product) setProduct(reply.product);
        if (reply.view) setView(reply.view);
        if (reply.country !== undefined) setCountry(reply.country ?? null);
        if (reply.sources) setLastSources(reply.sources);
        if (reply.progressJobId) setJobId(reply.progressJobId);
        if (reply.confirmRequired) pendingAction.current = text;
        if (!reply.confirmRequired && !reply.product?.confirmed) pendingAction.current = null;
        if (reply.simulation) setSimulation(reply.simulation);
        if (reply.launch) {
          setLaunch(reply.launch);
          setSummary((current) => ({ ...current, hasLaunch: true }));
        }
        if (reply.passport) setPassport(reply.passport);
        setRevision((value) => value + 1);
        await refreshSummary();
        if (reply.progressJobId) setJobOpen(true);
      } catch (err) {
        const message = errorMessage(err);
        setError(message);
        setMessages((current) => [
          ...current,
          {
            id: `e-${Date.now()}`,
            role: "assistant",
            text: `这次操作没有完成：${message}`,
            createdAt: new Date().toISOString(),
          },
        ]);
      } finally {
        setBusy(false);
        setBusyNote(null);
        setFiles([]);
      }
    },
    [busy, country, files, product.id, refreshSummary, router, view],
  );

  useEffect(() => {
    if (!initialPrompt || autoSent.current) return;
    autoSent.current = true;
    void send(initialPrompt);
  }, [initialPrompt, send]);

  useEffect(() => {
    if (!jobId) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout> | null = null;
    const poll = async () => {
      try {
        const data = await getJson<JobPayload>(`/api/research/${jobId}`);
        if (!alive) return;
        setJob(data);
        if (["COMPLETED", "PARTIAL", "FAILED"].includes(data.job.status)) {
          setJobId(null);
          setJobOpen(false);
          await refreshSummary();
          setRevision((value) => value + 1);
          setView((current) => (current === "overview" || current === "product" ? "markets" : current));
          setMessages((current) => [
            ...current,
            {
              id: `job-${data.job.id}`,
              role: "assistant",
              text:
                data.job.status === "FAILED"
                  ? `研究任务失败：${data.job.error ?? "未知错误"}。没有生成虚假结果。`
                  : "研究任务已结束。主工作台现在是市场档案；你可以让我解释某个市场、打开合规任务板，或准备本地化验证页。",
              nextActions: data.job.status === "FAILED" ? ["重新研究四国市场"] : undefined,
              createdAt: new Date().toISOString(),
            },
          ]);
          return;
        }
        timer = setTimeout(poll, 2500);
      } catch {
        if (alive) timer = setTimeout(poll, 3500);
      }
    };
    void poll();
    return () => {
      alive = false;
      if (timer) clearTimeout(timer);
    };
  }, [jobId, refreshSummary]);

  const confirmProduct = async () => {
    setBusy(true);
    setError(null);
    try {
      const data = await api<{ product: ProductDNA }>(`/api/products/${product.id}/confirm`, {
        method: "POST",
        body: JSON.stringify({ confirm: true }),
      });
      setProduct(data.product);
      await refreshSummary();
      setRevision((value) => value + 1);
      setMessages((current) => [
        ...current,
        {
          id: `confirm-${Date.now()}`,
          role: "assistant",
          text: "已确认产品简报，并写入用户确认证据。现在可以运行四国研究；分数只用于验证排序，不是发布批准。",
          nextActions: ["研究美国、日本、德国和英国"],
          createdAt: new Date().toISOString(),
        },
      ]);
      const queued = pendingAction.current;
      pendingAction.current = null;
      if (queued) setTimeout(() => void send(queued, { appendUser: false }), 120);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const activeJob = job?.job ?? (jobId ? initialJob : null);
  const showProgress = Boolean(jobId) || Boolean(activeJob && ["PENDING", "RUNNING"].includes(activeJob.status));
  const progress = activeJob?.progress ?? 0;
  const steps = useMemo(() => {
    const phases = new Set((job?.events ?? []).map((event) => event.phase.toUpperCase()));
    const market = summary.marketCount >= 4 ? "done" : jobId ? (phases.has("MARKET") ? "running" : "pending") : summary.marketCount > 0 ? "partial" : "pending";
    const compliance = summary.complianceCount >= 4 ? "done" : jobId ? (phases.has("COMPLIANCE") ? "running" : "pending") : summary.complianceCount > 0 ? "partial" : "pending";
    const analysis = summary.hasMatch ? "done" : jobId ? (phases.has("MATCH") ? "running" : "pending") : "pending";
    return [
      { label: STEPS[0], status: product.confirmed ? "done" : "waiting" },
      { label: STEPS[1], status: market },
      { label: STEPS[2], status: compliance },
      { label: STEPS[3], status: analysis },
      { label: STEPS[4], status: summary.hasLaunch ? "done" : "pending" },
    ] as const;
  }, [job?.events, jobId, product.confirmed, summary]);

  const goTo = (next: AgentView) => {
    if (next === "compliance" && !country) setCountry("DE");
    setView(next);
    if (typeof window !== "undefined" && window.innerWidth < 1024) setCopilotOpen(false);
  };

  const openCopilot = () => {
    setCopilotOpen((value) => !value);
  };

  const stage = STAGE_OF[view];
  const contextLabel = `${VIEW_LABEL[view]}${country ? ` · ${COUNTRY_META[country].name}` : ""}`;
  const quickPrompts = !product.confirmed ? ["确认产品简报", "这个产品适合什么市场？"] : CONTEXT_PROMPTS[view];
  const progressStatusLabel = activeJob?.status === "FAILED" ? "失败" : activeJob?.status === "PARTIAL" ? "部分完成" : "进行中";

  return (
    <div
      className={cn("flex h-[100dvh] w-full overflow-hidden bg-[#F4EDE1] text-[#12312A]", copilotOpen && "lg:grid")}
      style={copilotOpen ? ({ gridTemplateColumns: "72px minmax(0,1fr) 402px" } as React.CSSProperties) : undefined}
    >
      <nav aria-label="工作区导航" className="hidden h-full w-[72px] shrink-0 flex-col border-r border-[#E6DCCB] bg-[#E9A47F] lg:flex">
        <Link href="/" aria-label="返回 Product Passport 首页" className="flex h-[64px] items-center justify-center border-b border-[#ECE3D5]">
          <span className="relative flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#0E5C4E] text-[10px] font-semibold tracking-[0.04em] text-white">PP<span className="absolute -right-1 -top-1 h-2 w-2 rounded-full border border-[#E9A47F] bg-[#B8862F]" /></span>
        </Link>
        <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-2 py-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.n}>
              <div className="mb-1.5 flex items-center gap-1 px-1 font-mono text-[7.5px] uppercase tracking-[0.14em] text-[#C3CAC1]"><span className="text-[#B8862F]">{group.n}</span>{group.label}</div>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = view === item.view || (view === "overview" && item.view === "overview");
                  return (
                    <button
                      key={item.view}
                      type="button"
                      onClick={() => goTo(item.view)}
                      title={item.label}
                      aria-label={item.label}
                      className={cn("group flex w-full flex-col items-center gap-1 rounded-lg px-1 py-2 transition", active ? "bg-[#E4EFE7] text-[#0E5C4E]" : "text-[#77857D] hover:bg-[#f0e9dd] hover:text-[#1E413A]")}
                    >
                      <item.icon className="h-4 w-4" />
                      <span className="text-[8px] leading-none">{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-[64px] shrink-0 items-center justify-between gap-3 border-b border-[#E6DCCB] bg-[#FFFBF4]/95 px-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" className="flex items-center gap-2 lg:hidden" aria-label="返回首页">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0E5C4E] text-[9px] font-semibold text-white">PP</span>
            </Link>
            <div className="hidden items-center gap-2 text-[9px] text-[#A2AEA6] sm:flex">
              <span className="font-mono uppercase tracking-[0.14em]">Workspace</span>
              <span className="text-[#D2C6B4]">/</span>
              <span className="max-w-[270px] truncate text-[#6B7B72]">{product.name}</span>
            </div>
            <div className="min-w-0 sm:hidden">
              <div className="truncate text-[10px] font-medium text-[#1E413A]">{product.name}</div>
              <div className="mt-0.5 font-mono text-[7.5px] uppercase tracking-[0.1em] text-[#A2AEA6]">PP / {stage} / {VIEW_LABEL[view]}</div>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={openCopilot}
              className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[9.5px] transition", copilotOpen ? "border-[#0E5C4E] bg-[#0E5C4E] text-white" : "border-[#DFD4C1] bg-[#FFFDF8] text-[#3A5A52] hover:border-[#0E5C4E]/40 hover:text-[#0E5C4E]")}
              aria-label={copilotOpen ? "收起 Copilot" : "打开 Copilot"}
            >
              {copilotOpen ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
              Copilot
            </button>
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1240px] px-4 pb-10 pt-4 sm:px-6 lg:px-7">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[8px] uppercase tracking-[0.2em] text-[#B8862F]">{stage} / {VIEW_LABEL[view]}</span>
                <span className="h-3 w-px bg-[#DFD4C1]" />
                <div className="flex items-center gap-1.5 text-[8.5px] text-[#A2AEA6]">
                  {product.confirmed ? <><Check className="h-3 w-3 text-[#0E5C4E]" />简报已确认</> : <><CircleDashed className="h-3 w-3 text-[#B8862F]" />待确认</>}
                </div>
              </div>
              <div className="flex items-center gap-2 text-[8px] text-[#A2AEA6]">
                <span className="h-1.5 w-1.5 rounded-full bg-[#0E5C4E]" /> 真实数据 · 可追溯
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {STAGES.map((item) => {
                const active = stage === item.n;
                return (
                  <button
                    key={item.n}
                    type="button"
                    onClick={() => goTo(item.view)}
                    className={cn("group flex items-start justify-between gap-3 rounded-xl border px-3.5 py-3 text-left transition", active ? "border-[#0E5C4E]/40 bg-[#E6F1EA]" : "border-[#E8DECD] bg-[#FDF9F2] hover:border-[#0E5C4E]/30")}
                  >
                    <span>
                      <span className={cn("font-mono text-[8px]", active ? "text-[#0E5C4E]" : "text-[#B8862F]")}>{item.n}</span>
                      <span className={cn("ml-2 text-[11px] font-medium", active ? "text-[#0E5C4E]" : "text-[#3A5A52]")}>{item.label}</span>
                      <span className="mt-0.5 block text-[8px] text-[#A2AEA6]">{item.sub}</span>
                    </span>
                    <span className={cn("mt-1 h-1.5 w-1.5 rounded-full", active ? "bg-[#0E5C4E]" : "bg-[#DED2BE]")} />
                  </button>
                );
              })}
            </div>

            <div className="mt-3 flex gap-1 overflow-x-auto pb-1 lg:hidden">
              {NAV_GROUPS.flatMap((group) => group.items).map((item) => (
                <button key={item.view} type="button" onClick={() => goTo(item.view)} className={cn("shrink-0 rounded-full border px-2.5 py-1.5 text-[8.5px]", view === item.view ? "border-[#0E5C4E] bg-[#0E5C4E] text-white" : "border-[#E3D8C6] bg-[#FFFDF8] text-[#6B7A72]")}>
                  {item.label}
                </button>
              ))}
            </div>

            <div className="mt-5">
              {view === "overview" || view === "product" ? (
                <ProductCanvas product={product} busy={busy} onConfirm={() => void confirmProduct()} onResearch={() => void send("研究美国、日本、德国和英国市场")} revision={revision} onProductChange={(next) => { setProduct(next); setRevision((value) => value + 1); }} />
              ) : null}
              {view === "markets" ? (
                <MarketsCanvas
                  product={product}
                  revision={revision}
                  running={Boolean(jobId)}
                  onGoCompliance={(next) => { setCountry(next); setView("compliance"); }}
                  onGoLaunch={(next) => { setCountry(next); setView("launch"); }}
                  onRequestResearch={() => void send("研究美国、日本、德国和英国市场")}
                  onGoProduct={() => setView("product")}
                  onCountryChange={setCountry}
                  country={country}
                />
              ) : null}
              {view === "compliance" ? (
                <ComplianceCanvas product={product} country={country} revision={revision} onSelectCountry={setCountry} onRequest={(next) => { setCountry(next); void send(`${COUNTRY_META[next].name}有哪些合规要求？`); }} onGoProduct={() => setView("product")} />
              ) : null}
              {view === "simulation" ? <SimulationCanvas productId={product.id} initial={simulation} revision={revision} onRequestScenario={() => void send("采购价降到20元会怎样？")} /> : null}
              {view === "launch" ? <LaunchCanvas product={product} country={country} revision={revision} onCountryChange={setCountry} onGoProduct={() => setView("product")} /> : null}
              {view === "passport" ? <PassportCanvas productId={product.id} initial={passport} revision={revision} onRequestNewVersion={() => void send("创建新的产品护照版本")} /> : null}
            </div>
          </div>
        </div>
      </div>

      {copilotOpen ? <button type="button" aria-label="关闭 Copilot" onClick={() => setCopilotOpen(false)} className="fixed inset-0 z-40 bg-[#12312A]/25 backdrop-blur-[2px] lg:hidden" /> : null}
      <aside
        aria-label="Copilot"
        className={cn(
          "fixed inset-y-0 right-0 z-50 flex h-full min-h-0 w-full flex-col border-[#E6DCCB] bg-[#FFFBF4] sm:w-[430px] lg:static lg:z-auto lg:w-auto lg:max-w-none lg:border-l",
          copilotOpen ? "flex" : "hidden",
        )}
      >
        <header className="flex shrink-0 items-start justify-between gap-3 border-b border-[#ECE3D5] px-4 py-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-[#DED2BE] bg-[#FFFDF8]"><Sparkles className="h-3 w-3 text-[#0E5C4E]" /></span>
              <span className="font-mono text-[8.5px] uppercase tracking-[0.18em] text-[#8A988F]">Copilot</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#E6F2EC] px-2 py-0.5 text-[7.5px] text-[#0E5C4E]"><span className="h-1 w-1 rounded-full bg-[#0E5C4E]" />Online</span>
            </div>
            <div className="mt-1.5 text-[10px] font-medium text-[#1E413A]">正在查看 · {contextLabel}</div>
            <div className="mt-0.5 text-[8.5px] text-[#A2AEA6]">所有操作经过确定性路由与真实 API</div>
          </div>
          <button type="button" onClick={() => setCopilotOpen(false)} aria-label="收起 Copilot" className="rounded-full p-1.5 text-[#8A988F] transition hover:bg-[#f1eadf] hover:text-[#1E413A]"><X className="h-3.5 w-3.5" /></button>
        </header>

        {showProgress && activeJob ? (
          <div className="shrink-0 border-b border-[#ECE3D5] bg-[#FBF1E2] px-4 py-3">
            <button type="button" onClick={() => setJobOpen((value) => !value)} className="flex w-full items-start justify-between gap-3 text-left">
              <span>
                <span className="flex items-center gap-1.5 font-mono text-[8px] uppercase tracking-[0.14em] text-[#8A988F]"><Loader2 className="h-3 w-3 animate-spin text-[#0E5C4E]" />执行计划 · {progressStatusLabel}</span>
                <span className="mt-1 block text-[10px] font-medium text-[#1E413A]">{activeJob.currentStage ?? "开始研究"}</span>
              </span>
              <span className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-[#0E5C4E]">{progress}%</span>
                <ChevronDown className={cn("h-3 w-3 text-[#8A988F] transition", jobOpen ? "rotate-180" : "")} />
              </span>
            </button>
            {jobOpen ? (
              <div className="mt-2">
                <div className="h-1 overflow-hidden rounded-full bg-[#E8DECE]"><div className="h-full rounded-full bg-[#0E5C4E] transition-all" style={{ width: `${Math.max(2, progress)}%` }} /></div>
                <div className="mt-2 space-y-1">
                  {steps.map((step) => (
                    <div key={step.label} className="flex items-center justify-between gap-2 text-[8.5px]">
                      <span className="flex items-center gap-1.5 text-[#6B7B72]">
                        {step.status === "done" ? <Check className="h-2.5 w-2.5 text-[#0E5C4E]" /> : step.status === "running" ? <Loader2 className="h-2.5 w-2.5 animate-spin text-[#0E5C4E]" /> : <CircleDashed className="h-2.5 w-2.5 text-[#C3CAC1]" />}
                        {step.label}
                      </span>
                      <span className={cn("text-[7.5px]", step.status === "done" ? "text-[#0E5C4E]" : step.status === "running" ? "text-[#0E5C4E]" : "text-[#B4BEB7]")}>
                        {step.status === "done" ? "已完成" : step.status === "running" ? "执行中" : step.status === "partial" ? "部分完成" : "未开始"}
                      </span>
                    </div>
                  ))}
                </div>
                {(job?.events ?? []).length > 0 ? (
                  <div className="mt-2 border-t border-[#E8DECE] pt-2">
                    {(job?.events ?? []).slice(-3).map((event) => <div key={event.id} className="truncate text-[8px] leading-relaxed text-[#8A988F]">· {event.message}</div>)}
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}

        <div ref={feedRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} onAction={(text) => void send(text)} busy={busy} />
          ))}
          {busy ? (
            <div className="flex items-center gap-2 text-[9px] text-[#8A988F]"><Loader2 className="h-3 w-3 animate-spin text-[#0E5C4E]" />{busyNote ?? "正在调用真实工具…"}</div>
          ) : null}
          {error ? <div className="rounded-lg border border-[#F3D0C4] bg-[#FBEBE4] px-3 py-2 text-[9px] leading-relaxed text-[#B3402C]">{error}</div> : null}
          {lastSources.length > 0 && !busy ? (
            <div className="border-t border-[#ECE3D5] pt-2">
              <div className="font-mono text-[7.5px] uppercase tracking-[0.12em] text-[#A2AEA6]">当前结果来源</div>
              <div className="mt-1 space-y-1">
                {lastSources.slice(0, 3).map((source) => <a key={source.url} href={source.url} target="_blank" rel="noreferrer noopener" className="flex items-center gap-1 text-[8.5px] text-[#6B7B72] hover:text-[#0E5C4E]"><span className="h-1 w-1 shrink-0 rounded-full bg-[#0E5C4E]" /><span className="truncate">{source.title}</span></a>)}
              </div>
            </div>
          ) : null}
        </div>

        <div className="shrink-0 border-t border-[#ECE3D5] bg-[#FFFBF4] p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span className="truncate font-mono text-[7.5px] uppercase tracking-[0.12em] text-[#A2AEA6]">上下文 · {contextLabel}</span>
            <span className="flex items-center gap-1 text-[7.5px] text-[#B4BEB7]"><CircleDashed className="h-2.5 w-2.5" />不自动改事实</span>
          </div>
          <div className="rounded-xl border border-[#E2D6C3] bg-[#FFFDF8] focus-within:border-[#0E5C4E]/50">
            {files.length > 0 ? (
              <div className="flex gap-1.5 px-2 pt-2">
                {files.map((file, index) => (
                  <div key={`${file.name}-${index}`} className="group relative h-10 w-10 overflow-hidden rounded-md border border-[#E7DDCC]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={file.dataUrl} alt={file.name} className="h-full w-full object-cover" />
                    <button type="button" aria-label={`移除 ${file.name}`} onClick={() => setFiles((current) => current.filter((_, i) => i !== index))} className="absolute right-0 top-0 flex h-3.5 w-3.5 items-center justify-center rounded-bl bg-[#12312A]/80 text-white"><X className="h-2 w-2" /></button>
                  </div>
                ))}
              </div>
            ) : null}
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault();
                  void send(input);
                }
              }}
              onPaste={(event) => {
                if (input.trim() || files.length > 0) return;
                const pastedUrl = find1688Url(event.clipboardData.getData("text"));
                if (!pastedUrl) return;
                event.preventDefault();
                setInput(pastedUrl);
                void send(pastedUrl);
              }}
              rows={2}
              placeholder="问市场、合规、价格；或粘贴新的 1688 链接…"
              aria-label="给 Copilot 发消息"
              className="min-h-[52px] w-full resize-none bg-transparent px-3 pt-2.5 text-[11px] leading-[1.7] text-[#1B3A34] outline-none placeholder:text-[#BEC6BD]"
            />
            <div className="flex items-center justify-between gap-2 px-2 pb-2">
              <div className="flex items-center gap-1">
                <input ref={fileRef} type="file" accept="image/png,image/jpeg,image/webp" multiple className="hidden" onChange={(event) => void addFiles(event.target.files)} />
                <button type="button" onClick={() => fileRef.current?.click()} aria-label="上传产品图片" className="inline-flex items-center gap-1 rounded-full px-1.5 py-1 text-[8px] text-[#8A988F] hover:bg-[#f4efe5] hover:text-[#0E5C4E]"><ImagePlus className="h-3 w-3" /> 图片</button>
                <span className="text-[7.5px] text-[#C3CAC1]">Enter 发送</span>
              </div>
              <button type="button" onClick={() => void send(input)} disabled={busy || (!input.trim() && files.length === 0)} aria-label="发送" className="flex h-7 w-7 items-center justify-center rounded-full bg-[#0E5C4E] text-white transition hover:bg-[#0A4C40] disabled:opacity-35">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {quickPrompts.slice(0, 3).map((prompt) => (
              <button key={prompt} type="button" onClick={() => void send(prompt)} disabled={busy} className="rounded-full border border-[#E7DDCC] bg-[#F8F1E6] px-2 py-1 text-[8px] text-[#3A5A52] transition hover:border-[#0E5C4E]/40 hover:bg-[#E6F2EC] hover:text-[#0E5C4E] disabled:opacity-40">{prompt}</button>
            ))}
          </div>
          <p className="mt-2 text-[7.5px] leading-relaxed text-[#B4BEB7]">Copilot 不能自行判定法规通过，也不会绕过商品确认、规则引擎或用户审批。</p>
        </div>
      </aside>
    </div>
  );
}

function MessageBubble({ message, onAction, busy }: { message: AgentMessage; onAction: (text: string) => void; busy: boolean }) {
  const isUser = message.role === "user";
  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[88%] rounded-2xl rounded-br-sm bg-[#1E413A] px-3 py-2 text-[10px] leading-[1.7] text-white">{message.text}</div>
      </div>
    );
  }
  return (
    <div className="flex gap-2">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#DED2BE] bg-[#FFFDF8] font-mono text-[7px] text-[#0E5C4E]">PP</span>
      <div className="min-w-0 flex-1">
        <p className="whitespace-pre-wrap text-[10.5px] leading-[1.8] text-[#3d4d4b]">{message.text}</p>
        {message.card ? (
          <div className="mt-2 rounded-xl border border-[#E9DFCF] bg-[#FFFDF8] p-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-[10px] font-medium leading-snug text-[#1C3E36]">{message.card.title}</div>
                {message.card.subtitle ? <div className="mt-0.5 text-[8px] text-[#A2AEA6]">{message.card.subtitle}</div> : null}
              </div>
              {message.card.chips?.length ? <div className="flex flex-wrap gap-1">{message.card.chips.slice(0, 2).map((chip) => <span key={chip} className="rounded-full bg-[#FAF2E5] px-1.5 py-0.5 text-[7px] text-[#77857D]">{chip}</span>)}</div> : null}
            </div>
            {message.card.lines.length > 0 ? (
              <div className="mt-2 space-y-1 border-t border-[#F0E8DB] pt-2">
                {message.card.lines.slice(0, 5).map((line) => <div key={line} className="flex gap-1.5 text-[8.5px] leading-[1.65] text-[#68796F]"><span className="mt-1 h-0.5 w-0.5 shrink-0 rounded-full bg-[#B8862F]" />{line}</div>)}
              </div>
            ) : null}
          </div>
        ) : null}
        {message.sources?.length ? (
          <div className="mt-2 space-y-1">
            {message.sources.slice(0, 3).map((source) => (
              <a key={`${source.url}-${source.title}`} href={source.url} target="_blank" rel="noreferrer noopener" className="flex items-center gap-1.5 text-[8px] leading-relaxed text-[#77857D] hover:text-[#0E5C4E]"><span className="h-1 w-1 shrink-0 rounded-full bg-[#0E5C4E]" /><span className="line-clamp-1">{source.title}</span></a>
            ))}
          </div>
        ) : null}
        {message.nextActions?.length ? (
          <div className="mt-2">
            <button type="button" onClick={() => onAction(message.nextActions![0])} disabled={busy} className="inline-flex items-center gap-1 rounded-full border border-[#C4DED2] bg-[#eef7f1] px-2.5 py-1.5 text-[8.5px] text-[#0E5C4E] transition hover:border-[#0E5C4E] disabled:opacity-40">
              <Sparkles className="h-2.5 w-2.5" />{message.nextActions[0]}
            </button>
          </div>
        ) : null}
        <div className="mt-1 font-mono text-[7px] uppercase tracking-[0.1em] text-[#c0b6a6]">{timeLabel(message.createdAt)}</div>
      </div>
    </div>
  );
}
