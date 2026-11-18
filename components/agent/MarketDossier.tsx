"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  ChevronDown,
  Compass,
  ExternalLink,
  Globe2,
  Scale,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import type {
  ComplianceData,
  Country,
  MarketResearchData,
  MatchAnalysis,
  ProductDNA,
} from "@/types/domain";
import { COUNTRY_META, COUNTRY_ORDER } from "@/types/domain";
import { errorMessage } from "@/lib/client/api";
import { cn } from "@/lib/utils/cn";
import {
  ActionButton,
  CountryMark,
  EmptySurface,
  InlineSource,
  Kicker,
  Meta,
  Rule,
  SignalBar,
  Surface,
  Tag,
  WorkbenchHeading,
} from "@/components/agent/workbench";

type Payload = { markets: MarketResearchData[]; compliance: ComplianceData[]; match: MatchAnalysis | null };

const MARKET_STATUS: Record<string, string> = {
  COMPLETE: "证据完整",
  PARTIAL: "部分证据",
  INSUFFICIENT_EVIDENCE: "证据不足",
  FAILED: "研究失败",
};

const SEARCH_MODE: Record<string, string> = {
  LIVE_SEARCH: "实时搜索",
  LOCAL_CORPUS: "本地证据库",
  RETAIL_PROBE: "商品页抓取",
  NONE: "无搜索",
};

const COMPLIANCE_LABEL: Record<string, string> = {
  PRECHECK_COMPLETE: "初步检查完成",
  ACTION_REQUIRED: "需完成事项",
  REVIEW_REQUIRED: "需专业复核",
  RESTRICTED: "已确认限制",
  OUT_OF_SCOPE: "超出范围",
};

function firstSentence(text: string): string {
  return text
    .replace(/（?ev_[a-z0-9]+[^）]*）?/gi, "")
    .replace(/\s+/g, " ")
    .split(/(?<=。)/)[0]
    .trim()
    .slice(0, 160);
}

function money(value: number | null, currency: string): string {
  if (value === null || value === undefined) return "未观察";
  try {
    return new Intl.NumberFormat("zh-CN", { style: "currency", currency, maximumFractionDigits: currency === "JPY" ? 0 : 2 }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function statusTone(status: string): "teal" | "gold" | "red" | "neutral" {
  if (status === "COMPLETE") return "teal";
  if (status === "INSUFFICIENT_EVIDENCE" || status === "FAILED") return "red";
  return "gold";
}

function conclusionFor(market: MarketResearchData, row?: MatchAnalysis["countries"][number]): string {
  if (market.status === "INSUFFICIENT_EVIDENCE" || market.status === "FAILED") {
    return "证据覆盖不足，暂不进入排序；先补齐可比商品、评分信号或官方来源，再判断是否值得投入。";
  }
  if (row?.rationale) return firstSentence(row.rationale);
  if (market.demandSignals.summary) return firstSentence(market.demandSignals.summary);
  return "已有部分观察，但还不足以形成稳定结论。";
}

function nextActionFor(
  market: MarketResearchData,
  row: MatchAnalysis["countries"][number] | undefined,
  check: ComplianceData | undefined,
): { title: string; body: string; kind: "research" | "compliance" | "launch" | "compare" } {
  if (market.status === "INSUFFICIENT_EVIDENCE" || market.status === "FAILED") {
    return { title: "先扩大证据样本", body: "当前样本不足以支撑市场排序。先补充公开商品页或官方来源，不把空白当成结论。", kind: "research" };
  }
  if (!check) {
    return { title: "补齐准入预检", body: "市场机会不等于可以进入。先检查该市场的合规要求与官方来源。", kind: "compliance" };
  }
  if (check.status === "REVIEW_REQUIRED" || check.status === "ACTION_REQUIRED" || check.status === "RESTRICTED") {
    return { title: "先处理开放任务", body: "合规预检仍有开放项。打开任务板，逐项查看依据、来源和待补资料。", kind: "compliance" };
  }
  return { title: "准备本地化验证页", body: "市场与准入信息已具备基础。用目标市场语言测试价值主张，而不是直接发布。", kind: "launch" };
}

export function MarketsCanvas({
  product,
  revision,
  running,
  onGoCompliance,
  onGoLaunch,
  onRequestResearch,
  onGoProduct,
  onCountryChange,
  country,
}: {
  product: ProductDNA;
  revision: number;
  running?: boolean;
  onGoCompliance: (country: Country) => void;
  onGoLaunch: (country: Country) => void;
  onRequestResearch: () => void;
  onGoProduct?: () => void;
  onCountryChange?: (country: Country) => void;
  country?: Country | null;
}) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Country | null>(country ?? null);
  const [mode, setMode] = useState<"dossier" | "compare">("dossier");
  const [compareA, setCompareA] = useState<Country | null>(null);
  const [compareB, setCompareB] = useState<Country | null>(null);

  useEffect(() => {
    let alive = true;
    setError(null);
    fetch(`/api/products/${product.id}/markets`, { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as Payload & { error?: { message?: string } };
        if (!response.ok) throw new Error(payload.error?.message ?? "加载失败。");
        if (!alive) return;
        setData(payload);
        const ranked = payload.match?.countries.filter((row) => row.weightedScore !== null) ?? [];
        const first = ranked[0]?.country ?? payload.markets[0]?.country ?? null;
        const second = ranked[1]?.country ?? payload.markets.find((market) => market.country !== first)?.country ?? null;
        setSelected((current) => current ?? first);
        setCompareA((current) => current ?? first);
        setCompareB((current) => current ?? second);
      })
      .catch((err) => {
        if (alive) setError(errorMessage(err));
      });
    return () => {
      alive = false;
    };
  }, [product.id, revision]);

  const rowsByCountry = useMemo(() => new Map((data?.match?.countries ?? []).map((row) => [row.country, row])), [data]);
  const marketsByCountry = useMemo(() => new Map((data?.markets ?? []).map((market) => [market.country, market])), [data]);
  const checksByCountry = useMemo(() => new Map((data?.compliance ?? []).map((check) => [check.country, check])), [data]);
  const contextCountry = useMemo(() => {
    if (selected && marketsByCountry.has(selected)) return selected;
    if (country && marketsByCountry.has(country)) return country;
    return data?.markets[0]?.country ?? null;
  }, [country, data?.markets, marketsByCountry, selected]);

  useEffect(() => {
    if (contextCountry) onCountryChange?.(contextCountry);
  }, [contextCountry, onCountryChange]);

  if (error) return <EmptySurface icon={TriangleAlert} title="市场档案加载失败" body={error} />;
  if (!data) {
    return (
      <Surface className="p-6">
        <div className="flex items-center gap-2 text-[11px] text-[#77857D]">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#0E5C4E]" /> 正在读取真实市场记录…
        </div>
      </Surface>
    );
  }

  if (data.markets.length === 0) {
    return (
      <div className="mx-auto max-w-[1100px] space-y-5">
        <WorkbenchHeading
          eyebrow="02 · 出海决策 / 市场档案"
          title="先看真实市场，再谈进入。"
          description="启动美国、日本、德国、英国四国研究。结果只会在一国完成后写入档案；缺失证据不会被补成 50 分。"
        />
        <EmptySurface
          icon={Globe2}
          title={running ? "四国研究正在执行" : "还没有市场档案"}
          body={running ? "Copilot 正在展示真实任务状态。市场结果只会在一国完成后写入工作台。" : "启动真实抓取与合规预检。每个国家会形成一份独立档案，而不是一张普通国家卡片。"}
          action={!running ? <ActionButton onClick={product.confirmed ? onRequestResearch : onGoProduct} disabled={!product.confirmed && !onGoProduct} icon={product.confirmed ? Compass : TriangleAlert}>{product.confirmed ? "开始四国侦察" : "先确认商品简报"}</ActionButton> : undefined}
        />
      </div>
    );
  }

  const ranked = data.match?.countries.filter((row) => row.weightedScore !== null) ?? [];
  const priority = ranked[0] ?? null;
  const activeCountry = contextCountry ?? data.markets[0].country;
  const market = marketsByCountry.get(activeCountry)!;
  const row = rowsByCountry.get(activeCountry);
  const check = checksByCountry.get(activeCountry);
  const activeNext = nextActionFor(market, row, check);

  const withMarkets = COUNTRY_ORDER.filter((country) => marketsByCountry.has(country));
  const compareMarketA = compareA ? marketsByCountry.get(compareA) : undefined;
  const compareMarketB = compareB ? marketsByCountry.get(compareB) : undefined;

  return (
    <div className="mx-auto max-w-[1180px] space-y-5 pb-4">
      <WorkbenchHeading
        eyebrow="02 · 出海决策 / 市场档案"
        title="四个市场，不是四个分数。"
        description="每份档案先回答“值不值得验证”，再展开需求、竞品、利润和准入。分数只用于排序；证据不足的国家不强行排名。"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <ActionButton variant={mode === "dossier" ? "secondary" : "primary"} onClick={() => setMode(mode === "dossier" ? "compare" : "dossier")} icon={mode === "dossier" ? ArrowLeftRight : ChevronDown}>
              {mode === "dossier" ? "两国并排对比" : "回到单国档案"}
            </ActionButton>
          </div>
        }
      />

      {!product.confirmed ? <div className="rounded-xl border border-[#EFDCB4] bg-[#FCF2DF] px-4 py-3 text-[9.5px] leading-relaxed text-[#8A6F3C]">商品简报未确认；以下档案可能基于旧事实。确认并重跑研究后，市场判断才会更新。</div> : null}

      <div className="grid gap-3 lg:grid-cols-[1.25fr_0.75fr]">
        <Surface className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Kicker>当前判断</Kicker>
              <div className="mt-2 flex flex-wrap items-baseline gap-3">
                {priority?.country ? <CountryMark country={priority.country} /> : null}
                <h2 className="text-[24px] font-medium tracking-[-0.04em] text-[#12312A]">
                  {priority?.country ? `优先验证 ${COUNTRY_META[priority.country].name}` : "暂不排序"}
                </h2>
                {priority?.weightedScore !== null && priority?.weightedScore !== undefined ? (
                  <span className="font-mono text-[13px] text-[#0E5C4E]">{priority.weightedScore.toFixed(1)}<span className="text-[9px] text-[#A2AEA6]"> / 100</span></span>
                ) : null}
              </div>
              <p className="mt-2 max-w-[640px] text-[10.5px] leading-[1.8] text-[#68796F]">
                {data.match?.explanation ?? "当前没有足够的跨市场可比证据。可以逐国查看档案，或等待研究完成。"}
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-1.5">
              <Tag tone={ranked.length > 0 ? "teal" : "gold"}>{`${data.markets.length}/4 市场已建档`}</Tag>
              <Tag tone={data.markets.every((item) => item.status === "COMPLETE") ? "teal" : "gold"}>
                {data.markets.every((item) => item.status === "COMPLETE") ? "证据完整" : "存在证据缺口"}
              </Tag>
            </div>
          </div>
        </Surface>
        <Surface muted className="flex flex-col justify-between p-5">
          <div className="flex items-center justify-between gap-2">
            <Kicker>怎么读这份档案</Kicker>
            <Scale className="h-3.5 w-3.5 text-[#8A988F]" />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              ["排序", ranked.length > 0 ? `${ranked.length} 国` : "—"],
              ["合规预检", `${data.compliance.length}/4`],
              ["可比商品", `${data.markets.reduce((sum, item) => sum + item.competitors.length, 0)} 个`],
            ].map(([label, value]) => (
              <div key={label}>
                <div className="font-mono text-[16px] text-[#33433e]">{value}</div>
                <div className="mt-0.5 text-[8.5px] text-[#A2AEA6]">{label}</div>
              </div>
            ))}
          </div>
          <p className="mt-3 border-t border-[#ECE3D5] pt-2 text-[8.5px] leading-relaxed text-[#A2AEA6]">
            合规门独立于市场分。分数不是发布批准，合规预检也不等于许可。
          </p>
        </Surface>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {COUNTRY_ORDER.map((country) => {
          const item = marketsByCountry.get(country);
          const matchRow = rowsByCountry.get(country);
          const itemCheck = checksByCountry.get(country);
          const active = country === activeCountry && mode === "dossier";
          return (
            <button
              key={country}
              type="button"
              onClick={() => {
                if (item) {
                  setSelected(country);
                  setMode("dossier");
                }
              }}
              disabled={!item}
              className={cn(
                "flex min-w-[150px] flex-1 items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition",
                active ? "border-[#0E5C4E] bg-[#0E5C4E] text-white" : item ? "border-[#E3D8C6] bg-[#FFFDF8] text-[#3A5A52] hover:border-[#0E5C4E]/40" : "border-dashed border-[#E3D8C6] bg-[#FFFBF3] text-[#B4BEB7]",
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[8px]", active ? "border-white/30 bg-white/10" : "border-[#E3D8C6] bg-[#FBF3E7]")}>{COUNTRY_META[country].flag}</span>
                <span className="min-w-0">
                  <span className={cn("block text-[10px] font-medium", active ? "text-white" : "")}>{COUNTRY_META[country].name}</span>
                  <span className={cn("mt-0.5 block truncate text-[8px]", active ? "text-white/60" : "text-[#A2AEA6]")}>
                    {item ? `${MARKET_STATUS[item.status] ?? item.status}${matchRow?.weightedScore !== null && matchRow?.weightedScore !== undefined ? ` · ${matchRow.weightedScore.toFixed(1)}` : ""}` : "未建档"}
                  </span>
                </span>
              </span>
              {itemCheck ? <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", active ? "bg-white/70" : itemCheck.status === "REVIEW_REQUIRED" ? "bg-[#B8862F]" : "bg-[#0E5C4E]")} /> : null}
            </button>
          );
        })}
      </div>

      {mode === "compare" ? (
        <CompareDossiers
          left={compareMarketA}
          right={compareMarketB}
          leftCountry={compareA}
          rightCountry={compareB}
          options={withMarkets}
          onChangeLeft={(country) => setCompareA(country)}
          onChangeRight={(country) => setCompareB(country)}
          rowsByCountry={rowsByCountry}
          checksByCountry={checksByCountry}
          onOpen={(country) => {
            setSelected(country);
            setMode("dossier");
          }}
          onGoCompliance={onGoCompliance}
        />
      ) : (
        <Dossier
          product={product}
          market={market}
          row={row}
          check={check}
          country={activeCountry}
          next={activeNext}
          onGoCompliance={onGoCompliance}
          onGoLaunch={onGoLaunch}
        />
      )}
    </div>
  );
}

function Dossier({
  product,
  market,
  row,
  check,
  country,
  next,
  onGoCompliance,
  onGoLaunch,
}: {
  product: ProductDNA;
  market: MarketResearchData;
  row: MatchAnalysis["countries"][number] | undefined;
  check: ComplianceData | undefined;
  country: Country;
  next: ReturnType<typeof nextActionFor>;
  onGoCompliance: (country: Country) => void;
  onGoLaunch: (country: Country) => void;
}) {
  const meta = COUNTRY_META[country];
  const conclusion = conclusionFor(market, row);
  const demand = market.demandSignals;
  const perf = market.pricing;
  const checkStatus = check ? COMPLIANCE_LABEL[check.status] ?? check.status : "未预检";
  return (
    <Surface className="overflow-hidden" data-country={country}>
      <div className="grid gap-5 border-b border-[#EFE6D8] p-5 sm:p-7 lg:grid-cols-[1.25fr_0.75fr]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <CountryMark country={country} />
            <Kicker>{meta.localName} · {meta.language} · {meta.currency}</Kicker>
            <Tag tone={statusTone(market.status)}>{MARKET_STATUS[market.status] ?? market.status}</Tag>
            {row?.rank ? <Tag tone="neutral">排序 {String(row.rank).padStart(2, "0")}</Tag> : null}
          </div>
          <p className="mt-4 max-w-[760px] text-[20px] font-medium leading-[1.35] tracking-[-0.025em] text-[#1B3A34]">
            {conclusion}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[9px] text-[#8A988F]">
            <span>{market.competitors.length} 个可比商品</span>
            <span>{market.evidenceIds.length} 条证据</span>
            <span>{new Date(market.researchedAt).toLocaleDateString("zh-CN")} 研究</span>
            <span>{SEARCH_MODE[market.searchMode] ?? market.searchMode}</span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-3 border-t border-[#EFE6D8] pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
          <div>
            <Kicker>市场分</Kicker>
            <div className="mt-1 font-mono text-[28px] leading-none tracking-[-0.05em] text-[#0E5C4E]">{row?.weightedScore?.toFixed(1) ?? "—"}</div>
            <div className="mt-1 text-[8.5px] text-[#A2AEA6]">{row ? "验证排序" : "不排名"}</div>
          </div>
          <div>
            <Kicker>研究覆盖</Kicker>
            <div className="mt-1 font-mono text-[28px] leading-none tracking-[-0.05em] text-[#1E413A]">{pct(market.coverage)}</div>
            <div className="mt-1 text-[8.5px] text-[#A2AEA6]">{MARKET_STATUS[market.status] ?? market.status}</div>
          </div>
          <div>
            <Kicker>合规门</Kicker>
            <div className="mt-2"><Tag tone={check?.status === "REVIEW_REQUIRED" ? "gold" : check ? "neutral" : "neutral"}>{check ? COMPLIANCE_LABEL[check.status] ?? check.status : "未预检"}</Tag></div>
            <div className="mt-1 text-[8.5px] text-[#A2AEA6]">独立于分数</div>
          </div>
        </div>
      </div>

      {market.status !== "COMPLETE" ? (
        <div className="flex items-start gap-2 border-b border-[#F2E2C6] bg-[#FCF2DF] px-5 py-2.5 text-[9px] leading-relaxed text-[#8A601F] sm:px-7">
          <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" />
          <span>{market.status === "INSUFFICIENT_EVIDENCE" ? "样本不足：本市场不参与稳定排序。" : "部分证据：结论可参考，但不能当作完整市场扫描。"} {market.warnings[0] ?? ""}</span>
        </div>
      ) : null}

      <div className="grid gap-0 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="divide-y divide-[#EFE6D8] lg:border-r lg:border-[#EFE6D8]">
          <section className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Kicker>1 / 消费者需求证据</Kicker>
                <h3 className="mt-1 text-[15px] font-medium text-[#1C3E36]">他们在为什么买单，证据有多硬？</h3>
              </div>
              <Tag tone={demand.level === "NOT_ENOUGH_DATA" ? "red" : "teal"}>{demand.level === "NOT_ENOUGH_DATA" ? "证据不足" : demand.level === "STRONG" ? "信号较强" : demand.level === "MODERATE" ? "信号中等" : "信号偏弱"}</Tag>
            </div>
            <p className="mt-2 text-[10px] leading-[1.85] text-[#68796F]">{demand.summary}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              {demand.indicators.map((indicator) => (
                <div key={indicator.label} className="rounded-lg border border-[#F0E8DB] bg-[#FFFBF4] px-3 py-2.5">
                  <div className="text-[8px] text-[#A2AEA6]">{indicator.label}</div>
                  <div className="mt-1 font-mono text-[14px] text-[#1E413A]">{indicator.value ?? "—"}</div>
                </div>
              ))}
            </div>
            {market.customerNeeds.purchaseReasons.length > 0 ? (
              <div className="mt-3 border-t border-[#F0E8DB] pt-3">
                <Kicker>观察到的强调点（假设，不是调研结论）</Kicker>
                <ul className="mt-1.5 space-y-1">
                  {market.customerNeeds.purchaseReasons.slice(0, 3).map((reason) => (
                    <li key={reason} className="flex gap-1.5 text-[9.5px] leading-relaxed text-[#6B7B72]"><span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-[#0E5C4E]" />{firstSentence(reason)}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </section>

          <section className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <Kicker>2 / 真实可比竞品</Kicker>
                <h3 className="mt-1 text-[15px] font-medium text-[#1C3E36]">货架上已经有什么？</h3>
              </div>
              <span className="text-[9px] text-[#A2AEA6]">{market.competitors.length} 个观察样本</span>
            </div>
            <div className="mt-3">
              {market.competitors.length === 0 ? (
                <p className="rounded-lg border border-dashed border-[#E3D8C6] px-3 py-4 text-[10px] text-[#A2AEA6]">没有找到可用的可比商品，因此不使用替代价格或虚构竞品。</p>
              ) : (
                market.competitors.slice(0, 4).map((competitor) => (
                  <div key={`${competitor.sourceEvidenceId}-${competitor.name}`} className="grid grid-cols-[1fr_auto] gap-3 border-t border-[#F0E8DB] py-2.5 first:border-t-0 first:pt-0">
                    <div className="min-w-0">
                      <a href={competitor.url} target="_blank" rel="noreferrer noopener" className="line-clamp-1 text-[10.5px] font-medium text-[#1E413A] hover:text-[#0E5C4E] hover:underline">{competitor.name}</a>
                      <div className="mt-0.5 flex flex-wrap gap-x-2 text-[8.5px] text-[#A2AEA6]">
                        <span>{competitor.brand ?? "品牌未标注"}</span>
                        <span>评分 {competitor.rating ?? "—"}</span>
                        <span>{competitor.reviewCount ?? "—"} 条评论</span>
                      </div>
                      {competitor.keySellingPoints.length > 0 ? <p className="mt-1 line-clamp-1 text-[9px] text-[#77857D]">{competitor.keySellingPoints.slice(0, 2).join(" · ")}</p> : null}
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-[11px] text-[#1E413A]">{money(competitor.price, competitor.currency ?? meta.currency)}</div>
                      <a href={competitor.url} target="_blank" rel="noreferrer noopener" className="mt-1 inline-flex items-center gap-0.5 text-[8px] text-[#0E5C4E] hover:underline">来源 <ExternalLink className="h-2.5 w-2.5" /></a>
                    </div>
                  </div>
                ))
              )}
            </div>
            <p className="mt-2 text-[8.5px] leading-relaxed text-[#A2AEA6]">观察样本有限，价格是抓取时公开页面值；评论数不是销量。</p>
          </section>

          <section className="p-5 sm:p-6">
            <Kicker>3 / 商品匹配与差距</Kicker>
            <h3 className="mt-1 text-[15px] font-medium text-[#1C3E36]">你的产品，哪里更接近，哪里还没被证明？</h3>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <div className="space-y-2.5">
                {(["demand", "productMarketFit", "competition", "marginPotential"] as const).map((key) => {
                  const labels = { demand: "需求", productMarketFit: "匹配", competition: "竞争空间", marginPotential: "利润潜力" };
                  const metric = market.metrics[key];
                  return (
                    <div key={key}>
                      <div className="mb-1 flex items-center justify-between text-[8.5px] text-[#77857D]"><span>{labels[key]}</span><span className="font-mono text-[8px] text-[#B4BEB7]">{metric.score === null ? "证据不足" : `${metric.confidence} · ${metric.evidenceIds.length} 证据`}</span></div>
                      <SignalBar value={metric.score} />
                    </div>
                  );
                })}
              </div>
              <div>
                <div className="rounded-lg border border-[#E9DFCF] bg-[#FFFBF4] p-3">
                  <Kicker>可能成立的差异点</Kicker>
                  <ul className="mt-1.5 space-y-1">
                    {(row?.strengths ?? market.competition.differentiationOpportunities).slice(0, 3).map((item) => (
                      <li key={item} className="flex gap-1.5 text-[9px] leading-relaxed text-[#6B7B72]"><span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-[#0E5C4E]" />{firstSentence(item)}</li>
                    ))}
                  </ul>
                </div>
                <div className="mt-2 rounded-lg border border-[#F2E2C6] bg-[#FCF2DF] p-3">
                  <Kicker>还没被证实的部分</Kicker>
                  <ul className="mt-1.5 space-y-1">
                    {market.customerNeeds.potentialGaps.slice(0, 2).map((item) => (
                      <li key={item} className="flex gap-1.5 text-[9px] leading-relaxed text-[#8A6F3C]"><span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-[#B8862F]" />{firstSentence(item)}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
            <p className="mt-2 text-[8.5px] leading-relaxed text-[#A2AEA6]">匹配分来自公开关键词与竞品形态的重合度，是待验证假设，不是转化率。</p>
          </section>

          <section className="p-5 sm:p-6">
            <Kicker>4 / 成本利润假设</Kicker>
            <h3 className="mt-1 text-[15px] font-medium text-[#1C3E36]">在什么价格带，才值得测试？</h3>
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Meta label="采购价" value={product.sourcing.priceCNY !== null ? `¥${product.sourcing.priceCNY}` : "未提供"} />
              <Meta label="基准零售" value={money(perf.benchmarkRetail, perf.currency)} />
              <Meta label="情景零售" value={money(perf.suggestedRetail, perf.currency)} />
              <Meta label="贡献毛利率" value={perf.grossMarginPct !== null ? pct(perf.grossMarginPct) : "未提供"} />
            </div>
            {perf.assumptions.length > 0 ? <p className="mt-2 text-[9px] leading-relaxed text-[#8A988F]">{perf.assumptions.slice(0, 2).join(" ")}</p> : null}
            <div className="mt-2"><Tag tone="gold">情景估算 · 不是到岸成本审计</Tag></div>
          </section>

          <section className="p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <Kicker>5 / 合规状态</Kicker>
                <h3 className="mt-1 text-[15px] font-medium text-[#1C3E36]">市场有机会，不代表现在能进入。</h3>
              </div>
              <ActionButton variant="secondary" onClick={() => onGoCompliance(country)} icon={ShieldCheck}>打开合规任务板</ActionButton>
            </div>
            <div className="mt-3 rounded-lg border border-[#E9DFCF] bg-[#FFFBF4] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Tag tone={check?.status === "REVIEW_REQUIRED" || check?.status === "ACTION_REQUIRED" ? "gold" : "neutral"}>{checkStatus}</Tag>
                <span className="text-[8.5px] text-[#A2AEA6]">{check ? `${check.officialSources.filter((source) => source.status === "FETCHED").length}/${check.officialSources.length} 官方页已抓取` : "尚未预检"}</span>
              </div>
              <p className="mt-2 text-[9.5px] leading-[1.8] text-[#68796F]">
                {check?.statusReason ?? "该市场尚未运行合规预检。不要用市场分替代准入判断。"}
              </p>
              <p className="mt-1 text-[8.5px] leading-relaxed text-[#A2AEA6]">预检区分“已确认限制 / 需完成事项 / 需专业复核 / 初步检查完成”，不等于获得正式进口或销售许可。</p>
            </div>
          </section>

          <section className="p-5 sm:p-6">
            <Kicker>6 / 最值得执行的下一步</Kicker>
            <div className="mt-2 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
              <div>
                <h3 className="text-[16px] font-medium text-[#1C3E36]">{next.title}</h3>
                <p className="mt-1 max-w-[540px] text-[10px] leading-[1.8] text-[#68796F]">{next.body}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {next.kind === "compliance" ? <ActionButton onClick={() => onGoCompliance(country)}>处理合规任务</ActionButton> : null}
                {next.kind === "launch" ? <ActionButton onClick={() => onGoLaunch(country)}>准备本地化验证页</ActionButton> : null}
                {next.kind === "research" ? <ActionButton onClick={() => onGoCompliance(country)} variant="secondary">先补证据</ActionButton> : null}
              </div>
            </div>
          </section>
        </div>

        <aside className="bg-[#FFFBF4] p-5 sm:p-6">
          <Kicker>证据与边界</Kicker>
          <div className="mt-3 space-y-2.5">
            <Meta label="研究方式" value={SEARCH_MODE[market.searchMode] ?? market.searchMode} note={market.warnings.some((warning) => warning.includes("本地导入")) ? "商品页抓取 + 本地导入语料" : undefined} />
            <Meta label="研究置信度" value={demand.confidence} note="小样本公开观察，不代表全市场" />
            <Meta label="数据模式" value={market.dataMode === "LOCAL_EVIDENCE" ? "本地证据快照" : market.dataMode === "LIVE" ? "实时抓取" : "演示数据"} />
            <Meta label="证据条目" value={`${market.evidenceIds.length} 条`} />
          </div>
          <Rule className="my-4" />
          <Kicker>来源样本</Kicker>
          <div className="mt-2">
            {market.competitors.slice(0, 5).map((competitor) => (
              <InlineSource key={competitor.sourceEvidenceId} title={competitor.name} url={competitor.url} note={competitor.brand ?? "公开商品页"} />
            ))}
          </div>
          {market.warnings.length > 0 ? (
            <div className="mt-4 border-t border-[#ECE3D5] pt-3">
              <Kicker>研究者留下的边界</Kicker>
              <p className="mt-1.5 text-[9px] leading-[1.8] text-[#8A988F]">{market.warnings[0]}</p>
            </div>
          ) : null}
          <div className="mt-4 border-t border-[#ECE3D5] pt-3 text-[8.5px] leading-relaxed text-[#A2AEA6]">
            {market.competitors.length} 个可比商品 · 研究日期 {new Date(market.researchedAt).toLocaleDateString("zh-CN")} · 所有来源可打开
          </div>
        </aside>
      </div>
    </Surface>
  );
}

function CompareDossiers({
  left,
  right,
  leftCountry,
  rightCountry,
  options,
  onChangeLeft,
  onChangeRight,
  rowsByCountry,
  checksByCountry,
  onOpen,
  onGoCompliance,
}: {
  left?: MarketResearchData;
  right?: MarketResearchData;
  leftCountry: Country | null;
  rightCountry: Country | null;
  options: Country[];
  onChangeLeft: (country: Country) => void;
  onChangeRight: (country: Country) => void;
  rowsByCountry: Map<Country, MatchAnalysis["countries"][number]>;
  checksByCountry: Map<Country, ComplianceData>;
  onOpen: (country: Country) => void;
  onGoCompliance: (country: Country) => void;
}) {
  if (!left || !right) {
    return <EmptySurface icon={ArrowLeftRight} title="至少需要两个市场档案" body="当前只有一个市场有可用观察。先补齐另一个市场，才能做并排对比。" />;
  }
  const rows = [
    ["一句话结论", (market: MarketResearchData, country: Country) => conclusionFor(market, rowsByCountry.get(country))],
    ["研究覆盖", (market: MarketResearchData) => `${pct(market.coverage)} · ${MARKET_STATUS[market.status] ?? market.status}`],
    ["需求证据", (market: MarketResearchData) => market.demandSignals.summary],
    ["商品匹配", (market: MarketResearchData) => market.metrics.productMarketFit.note ?? "证据不足"],
    ["竞争格局", (market: MarketResearchData) => market.competition.summary],
    ["可比商品", (market: MarketResearchData) => `${market.competitors.length} 个 · ${market.competitors.slice(0, 2).map((item) => money(item.price, item.currency ?? "USD")).join(" / ")}`],
    ["情景价格", (market: MarketResearchData) => `${money(market.pricing.suggestedRetail, market.pricing.currency)} · 毛利率 ${market.pricing.grossMarginPct !== null ? pct(market.pricing.grossMarginPct) : "未提供"}`],
    ["合规状态", (market: MarketResearchData) => {
      const check = checksByCountry.get(market.country);
      return check ? COMPLIANCE_LABEL[check.status] ?? check.status : "未预检";
    }],
    ["下一步", (market: MarketResearchData, country: Country) => nextActionFor(market, rowsByCountry.get(country), checksByCountry.get(country)).title],
  ] as const;

  return (
    <Surface className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EFE6D8] p-5 sm:p-6">
        <div>
          <Kicker>并排对比</Kicker>
          <h3 className="mt-1 text-[18px] font-medium tracking-[-0.03em] text-[#1C3E36]">两个市场，同一套判断口径。</h3>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5 text-[9px] text-[#8A988F]">
            <span>左</span>
            <select value={leftCountry ?? ""} onChange={(event) => onChangeLeft(event.target.value as Country)} className="rounded-full border border-[#E3D8C6] bg-[#FFFDF8] px-2.5 py-1.5 text-[10px] text-[#3A5A52] outline-none focus:border-[#0E5C4E]">
              {options.map((country) => <option key={country} value={country}>{COUNTRY_META[country].name}</option>)}
            </select>
          </label>
          <span className="text-[9px] text-[#C3CAC1]">vs</span>
          <label className="flex items-center gap-1.5 text-[9px] text-[#8A988F]">
            <span>右</span>
            <select value={rightCountry ?? ""} onChange={(event) => onChangeRight(event.target.value as Country)} className="rounded-full border border-[#E3D8C6] bg-[#FFFDF8] px-2.5 py-1.5 text-[10px] text-[#3A5A52] outline-none focus:border-[#0E5C4E]">
              {options.map((country) => <option key={country} value={country}>{COUNTRY_META[country].name}</option>)}
            </select>
          </label>
        </div>
      </div>
      <div className="grid grid-cols-[110px_1fr_1fr] text-[10px]">
        <div className="border-r border-[#EFE6D8] bg-[#FFFBF4] px-3 py-4 text-[8px] uppercase tracking-[0.12em] text-[#A2AEA6]">判断维度</div>
        {[left, right].map((market) => (
          <div key={market.country} className="border-r border-[#EFE6D8] px-3 py-4 last:border-r-0">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-[13px] font-medium text-[#1C3E36]"><CountryMark country={market.country} size="sm" />{COUNTRY_META[market.country].name}</span>
              <span className="font-mono text-[9px] text-[#0E5C4E]">{rowsByCountry.get(market.country)?.weightedScore?.toFixed(1) ?? "—"}</span>
            </div>
            <div className="mt-1 text-[8px] text-[#A2AEA6]">{COUNTRY_META[market.country].localName}</div>
          </div>
        ))}
        {rows.map(([label, render], rowIndex) => (
          <div key={label} className="contents">
            <div className={cn("border-r border-t border-[#EFE6D8] px-3 py-3 align-top text-[8.5px] leading-relaxed text-[#A2AEA6]", rowIndex % 2 === 0 ? "bg-[#FFFBF4]" : "bg-[#fdfaf4]")}>{label}</div>
            {[left, right].map((market) => (
              <div key={`${market.country}-${label}`} className={cn("border-r border-t border-[#EFE6D8] px-3 py-3 align-top text-[9.5px] leading-[1.75] text-[#6B7B72] last:border-r-0", rowIndex % 2 === 0 ? "bg-[#FFFDF8]" : "bg-[#fdfaf5]")}>
                <span className="line-clamp-4">{render(market, market.country)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#EFE6D8] p-4">
        <p className="text-[8.5px] text-[#A2AEA6]">并排对比只展开已持久化的研究记录；没有证据的单元格会明确显示“证据不足”。</p>
        <div className="flex gap-2">
          <ActionButton variant="secondary" onClick={() => onOpen(left.country)}>查看{COUNTRY_META[left.country].name}档案</ActionButton>
          <ActionButton variant="secondary" onClick={() => onGoCompliance(right.country)}>查看{COUNTRY_META[right.country].name}合规</ActionButton>
        </div>
      </div>
    </Surface>
  );
}
