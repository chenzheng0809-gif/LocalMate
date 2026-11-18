"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  Download,
  FileJson,
  Globe2,
  Loader2,
  PackageCheck,
  Printer,
  Rocket,
  ShieldCheck,
  TriangleAlert,
  Wallet,
} from "lucide-react";
import { api, errorMessage } from "@/lib/client/api";
import type {
  ComplianceData,
  Country,
  LaunchPageContent,
  MarketResearchData,
  MatchAnalysis,
  PassportSnapshot,
  ProductDNA,
  SimulationResult,
} from "@/types/domain";
import { CATEGORY_LABELS, COUNTRY_META, COUNTRY_ORDER } from "@/types/domain";
import { missingFieldLabel } from "@/lib/agent/labels";
import { CountryTabs, DataFootnote, DeepLink, EmptyState, ExternalSource, GatePill, LoadingState, Panel, Pill, SectionTitle } from "@/components/agent/shared";

const COMPLIANCE_LABEL: Record<string, string> = {
  PRECHECK_COMPLETE: "初步检查完成",
  ACTION_REQUIRED: "需完成事项",
  REVIEW_REQUIRED: "需专业复核",
  RESTRICTED: "已确认限制",
  OUT_OF_SCOPE: "超出范围",
};

const SEARCH_LABEL: Record<string, string> = {
  LIVE_SEARCH: "实时搜索",
  LOCAL_CORPUS: "本地证据库",
  RETAIL_PROBE: "商品页抓取 + 本地语料",
  NONE: "无搜索",
};

const MARKET_STATUS_LABEL: Record<string, string> = {
  COMPLETE: "证据完整",
  PARTIAL: "部分证据",
  INSUFFICIENT_EVIDENCE: "证据不足",
  FAILED: "失败",
};

const VERIFICATION_LABEL: Record<string, string> = {
  VERIFIED: "已验证",
  PARTIALLY_VERIFIED: "部分验证",
  UNVERIFIED: "未验证",
  IMPORTED_SNAPSHOT: "导入快照",
};

const REQUIREMENT_LABEL: Record<string, string> = {
  APPLIES: "适用",
  IDENTIFIED: "已识别",
  POSSIBLE: "可能适用",
  NOT_IDENTIFIED: "未识别",
  NEEDS_REVIEW: "需复核",
  VERIFIED: "引文已验证",
};

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { cache: "no-store" });
  const data = (await response.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!response.ok) throw new Error(data.error?.message ?? "加载失败。");
  return data;
}

function statusTone(status: string): "teal" | "gold" | "red" | "neutral" {
  if (["PRECHECK_COMPLETE", "CLEAR", "COMPLETED"].includes(status)) return "teal";
  if (["RESTRICTED", "BLOCKED", "FAILED", "OUT_OF_SCOPE"].includes(status)) return "red";
  if (["ACTION_REQUIRED", "REVIEW_REQUIRED", "CAUTION", "PARTIAL"].includes(status)) return "gold";
  return "neutral";
}

const SOURCE_LABEL: Record<string, string> = {
  DEMO: "演示数据",
  MANUAL: "用户输入",
  IMAGE: "图片识别",
  "1688": "1688 来源",
  URL: "链接导入",
  ALIBABA: "阿里巴巴来源",
};


function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="border-t border-[#F0E8DB] py-3">
      <div className="text-[9px] uppercase tracking-[0.12em] text-[#A2AEA6]">{label}</div>
      <div className="mt-1 text-[12px] leading-relaxed text-[#1E413A]">{value || "未提供"}</div>
    </div>
  );
}

function ScoreBar({ value }: { value: number | null }) {
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-[#F0E8DB]">
      <div className="h-full rounded-full bg-[#0E5C4E]" style={{ width: `${value ?? 0}%` }} />
    </div>
  );
}

export function ProductCanvas({
  product,
  busy,
  onConfirm,
  onResearch,
  revision,
}: {
  product: ProductDNA;
  busy: boolean;
  onConfirm: () => void;
  onResearch: () => void;
  revision: number;
}) {
  const outOfScope = product.category === "OUT_OF_SCOPE" || product.attributes.electrical === true;
  return (
    <div className="mx-auto max-w-[980px] space-y-5" data-revision={revision}>
      {outOfScope ? (
        <div className="rounded-xl border border-[#F3D0C4] bg-[#FBEBE4] px-4 py-3 text-[11px] leading-relaxed text-[#B3402C]">
          该产品超出第一版范围（仅非电动家居收纳）。系统不会启动研究、合规预检或生成市场结论。
        </div>
      ) : null}
      <Panel className="overflow-hidden p-0">
        <div className="relative bg-[#f0eadf] px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone={product.confirmed ? "teal" : "gold"}>{product.confirmed ? "简报已确认" : "待确认"}</Pill>
                <Pill>{CATEGORY_LABELS[product.category]}</Pill>
                <Pill>{SOURCE_LABEL[product.sourcePlatform] ?? product.sourcePlatform}</Pill>
              </div>
              <h2 className="mt-3 max-w-2xl text-[24px] font-medium leading-[1.2] tracking-[-0.03em] text-[#12312A]">{product.name}</h2>
              <div className="mt-2 flex flex-wrap items-center gap-2 text-[9px] uppercase tracking-[0.12em] text-[#A2AEA6]">
                <span>{product.sourcePlatform === "1688" ? "商品详情 · 来源页" : product.sourcePlatform === "IMAGE" ? "图片观察" : "产品描述"}</span>
                {product.sourceUrl ? <a href={product.sourceUrl} target="_blank" rel="noreferrer noopener" className="normal-case tracking-normal text-[#8A988F] underline decoration-[#D7CBB6] underline-offset-4 hover:text-[#0E5C4E]">打开 1688 来源页</a> : null}
              </div>
              <p className="mt-1 max-w-2xl text-[12px] leading-relaxed text-[#6B7A72]">{product.description ?? "暂无产品描述。"}</p>
            </div>
            {product.images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.images[0]} alt={product.name} referrerPolicy="no-referrer" className="h-24 w-24 rounded-xl border border-white/60 object-cover shadow-sm sm:h-28 sm:w-28" />
            ) : null}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {!outOfScope && !product.confirmed ? (
              <button type="button" onClick={onConfirm} disabled={busy} className="inline-flex items-center gap-2 rounded-full bg-[#0E5C4E] px-4 py-2.5 text-[11px] font-medium text-white transition hover:bg-[#0A4C40] disabled:opacity-45">
                {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BadgeCheck className="h-3.5 w-3.5" />}
                确认产品简报
              </button>
            ) : !outOfScope ? (
              <button type="button" onClick={onResearch} className="inline-flex items-center gap-2 rounded-full bg-[#0E5C4E] px-4 py-2.5 text-[11px] font-medium text-white transition hover:bg-[#0A4C40]">
                <Globe2 className="h-3.5 w-3.5" /> 研究四国市场
              </button>
            ) : null}
            <Link href={`/product/${product.id}`} className="inline-flex items-center gap-2 rounded-full border border-[#DCD0BC] bg-white/70 px-4 py-2.5 text-[11px] text-[#6B7B72] transition hover:border-[#0E5C4E] hover:text-[#0E5C4E]">
              编辑 / 查看证据 <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
        <div className="grid gap-x-8 px-5 sm:grid-cols-2 sm:px-6">
          <Fact label="材质" value={product.attributes.material} />
          <Fact label="产品尺寸" value={product.attributes.dimensions} />
          <Fact label="包装尺寸（来自来源页）" value={product.attributes.packagingDimensions} />
          <Fact label="带包装重量" value={product.attributes.weight !== null ? `${product.attributes.weight} kg` : null} />
          <Fact label="采购价" value={product.sourcing.priceCNY !== null ? `¥${product.sourcing.priceCNY}` : null} />
          <Fact label="起订量" value={product.sourcing.MOQ} />
          <Fact label="供应商" value={product.sourcing.supplier} />
          <Fact label="使用场景" value={product.attributes.intendedUse} />
        </div>
        {product.images.length > 1 ? (
          <div className="border-t border-[#F0E8DB] px-5 py-4 sm:px-6">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[9px] uppercase tracking-[0.12em] text-[#A2AEA6]">来源页图片 · {product.images.length} 张</span>
              {product.sourceUrl ? <a href={product.sourceUrl} target="_blank" rel="noreferrer noopener" className="inline-flex items-center gap-1 text-[9px] text-[#8A988F] underline decoration-[#D7CBB6] underline-offset-4 hover:text-[#0E5C4E]">查看 1688 详情页 <ArrowRight className="h-3 w-3" /></a> : null}
            </div>
            <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-8">
              {product.images.slice(1, 9).map((src, index) => {
                const http = /^https?:/i.test(src);
                const image = (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={src} alt={`${product.name} 来源图 ${index + 2}`} referrerPolicy="no-referrer" className="aspect-square w-full rounded-md border border-white/70 object-cover" loading="lazy" />
                );
                return http ? <a key={src} href={src} target="_blank" rel="noreferrer noopener" className="block overflow-hidden rounded-md transition hover:opacity-80">{image}</a> : <div key={`${src.slice(0, 24)}-${index}`} className="overflow-hidden rounded-md">{image}</div>;
              })}
            </div>
          </div>
        ) : null}
        <div className="border-t border-[#F0E8DB] px-5 py-3.5 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[9px] uppercase tracking-[0.12em] text-[#A2AEA6]">缺失 / 待补</span>
            {product.missingFields.length === 0 ? <Pill tone="teal">关键字段完整</Pill> : product.missingFields.map((field) => <Pill key={field} tone="gold">{missingFieldLabel(field)}</Pill>)}
          </div>
        </div>
      </Panel>
      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { icon: PackageCheck, title: "产品事实", body: "只有识别或你输入的字段才会进入研究；缺失字段不会被默认值填满。" },
          { icon: ShieldCheck, title: "合规独立", body: "市场分和合规门分开。高分不等于可发布，合规预检也不等于官方认证。" },
          { icon: Wallet, title: "价格是情景", body: "采购价、运费和平台费会明确标为假设；模拟不会覆盖产品事实。" },
        ].map((item) => (
          <div key={item.title} className="rounded-xl border border-[#E7DDCC] bg-[#FFFBF3] p-4">
            <item.icon className="h-4 w-4 text-[#0E5C4E]" />
            <div className="mt-2 text-[11px] font-medium text-[#1E413A]">{item.title}</div>
            <p className="mt-1 text-[10px] leading-relaxed text-[#77857D]">{item.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

type MarketsPayload = {
  markets: MarketResearchData[];
  compliance: ComplianceData[];
  match: MatchAnalysis | null;
};

export function MarketsCanvas({ productId, revision, running, onGoCompliance, onRequestResearch }: { productId: string; revision: number; running?: boolean; onGoCompliance: (country: Country) => void; onRequestResearch?: () => void }) {
  const [data, setData] = useState<MarketsPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setError(null);
    getJson<MarketsPayload>(`/api/products/${productId}/markets`)
      .then((payload) => { if (alive) setData(payload); })
      .catch((err) => { if (alive) setError(errorMessage(err)); });
    return () => { alive = false; };
  }, [productId, revision]);

  if (error) return <EmptyState icon={TriangleAlert} title="市场视图加载失败" body={error} />;
  if (!data) return <LoadingState label="读取四国研究结果…" />;
  if (data.markets.length === 0) {
    return (
      <EmptyState
        icon={Globe2}
        title={running ? "四国研究正在执行" : "还没有市场研究"}
        body={running ? "真实抓取和合规预检已经启动。结果只会在一国完成后写入工作台；进度见左侧执行卡片。" : "启动真实抓取和合规预检，结果只会在一国完成后写入工作台；缺失证据会保持为空。"}
        action={!running && onRequestResearch ? <button type="button" onClick={onRequestResearch} className="rounded-full bg-[#0E5C4E] px-4 py-2 text-[10px] text-white">研究美国、日本、德国和英国</button> : null}
      />
    );
  }
  const top = data.match?.countries[0] ?? null;
  const topMarket = data.markets.find((item) => item.country === top?.country) ?? data.markets[0];
  return (
    <div className="mx-auto max-w-[1080px] space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionTitle eyebrow="四国比较" title="哪个市场值得先验证？" />
        <div className="flex gap-2">
          <Pill>{data.markets.length}/4 市场已有观察</Pill>
          <Pill tone={data.markets.every((item) => item.status === "COMPLETE") ? "teal" : "gold"}>{data.markets.every((item) => item.status === "COMPLETE") ? "证据完整" : "部分证据"}</Pill>
        </div>
      </div>

      {top ? (
        <Panel className="border-[#cfe2d8] bg-[#F2F8F3]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Pill tone="teal">验证优先</Pill>
                <span className="font-mono text-[9px] text-[#7E8C84]">排名 {String(top.rank ?? 1).padStart(2, "0")}</span>
              </div>
              <div className="mt-2 flex items-end gap-2">
                <h3 className="text-[30px] font-medium tracking-[-0.04em] text-[#12312A]">{COUNTRY_META[top.country].name}</h3>
                <span className="pb-1 text-[12px] text-[#6B7A72]">{COUNTRY_META[top.country].localName} · {COUNTRY_META[top.country].currency}</span>
              </div>
              <p className="mt-2 max-w-xl text-[11px] leading-relaxed text-[#6B7B72]">{data.match?.explanation}</p>
            </div>
            <div className="text-right">
              <div className="font-mono text-[34px] leading-none text-[#0E5C4E]">{top.weightedScore?.toFixed(1) ?? "—"}</div>
              <div className="mt-1 text-[9px] uppercase tracking-[0.14em] text-[#8A988F]">市场分 / 100</div>
              <div className="mt-2"><GatePill gate={top.complianceGate} /></div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={() => onGoCompliance(top.country)} className="rounded-full bg-[#0E5C4E] px-3.5 py-2 text-[10px] text-white">查看{COUNTRY_META[top.country].name}合规</button>
            <DeepLink href={`/markets/${productId}#${top.country}`}>打开完整市场证据</DeepLink>
          </div>
        </Panel>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        {COUNTRY_ORDER.map((country) => {
          const market = data.markets.find((item) => item.country === country);
          const row = data.match?.countries.find((item) => item.country === country);
          const check = data.compliance.find((item) => item.country === country);
          if (!market) {
            return (
              <Panel key={country} className="border-dashed bg-[#FFFBF3]">
                <div className="flex items-center justify-between"><span className="text-[14px] font-medium">{COUNTRY_META[country].flag} {COUNTRY_META[country].name}</span><Pill>无观察</Pill></div>
                <p className="mt-3 text-[10px] text-[#A2AEA6]">该市场没有可用证据，因此不生成分数。</p>
              </Panel>
            );
          }
          return (
            <Panel key={country}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-[14px] font-medium text-[#12312A]">{COUNTRY_META[country].flag} {COUNTRY_META[country].name}</div>
                  <div className="mt-0.5 font-mono text-[8px] uppercase tracking-[0.12em] text-[#A2AEA6]">{COUNTRY_META[country].localName} · {market.warnings.some((warning) => warning.includes("本地导入")) ? "商品页抓取 + 本地语料" : SEARCH_LABEL[market.searchMode] ?? market.searchMode} · {MARKET_STATUS_LABEL[market.status] ?? market.status}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-[20px] text-[#0E5C4E]">{row?.weightedScore?.toFixed(1) ?? "—"}</div>
                  <GatePill gate={row?.complianceGate ?? "UNKNOWN"} />
                </div>
              </div>
              <div className="mt-4 space-y-2.5">
                {[
                  ["需求信号", market.metrics.demand.score],
                  ["产品匹配", market.metrics.productMarketFit.score],
                  ["竞争空间", market.metrics.competition.score],
                  ["利润潜力", market.metrics.marginPotential.score],
                ].map(([label, score]) => (
                  <div key={String(label)}>
                    <div className="mb-1 flex items-center justify-between text-[9px] text-[#77857D]"><span>{label}</span><span className="font-mono">{score === null ? "证据不足" : Math.round(Number(score))}</span></div>
                    <ScoreBar value={score === null ? null : Number(score)} />
                  </div>
                ))}
              </div>
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-[#F0E8DB] pt-3 text-[10px] text-[#77857D]">
                <span>{market.competitors.length} 个可比商品 · 零售 {market.pricing.suggestedRetail !== null ? `${market.pricing.currency} ${market.pricing.suggestedRetail.toFixed(2)}` : "未定价"}</span>
                <span>{check ? COMPLIANCE_LABEL[check.status] ?? check.status : "未做合规"}</span>
              </div>
              {(() => {
                const specific = market.warnings.find((warning) => !warning.startsWith("本地导入研究语料") && !warning.startsWith("语料编译于"));
                return specific ? <p className="mt-2 text-[9px] leading-relaxed text-[#9a6b2f]">{specific}</p> : null;
              })()}
            </Panel>
          );
        })}
      </div>

      <Panel>
        <SectionTitle eyebrow="来源样本" title={`${COUNTRY_META[topMarket.country].name}的来源样本`} action={<DeepLink href={`/markets/${productId}`}>全部市场证据</DeepLink>} />
        <div className="mt-3 space-y-1.5">
          {topMarket.competitors.slice(0, 4).map((competitor) => (
            <ExternalSource key={competitor.sourceEvidenceId} title={competitor.name} url={competitor.url} note={`${competitor.brand ?? "未知品牌"} · ${competitor.price !== null ? `${competitor.currency} ${competitor.price}` : "价格未观察"} · 评分 ${competitor.rating ?? "—"} / 评论 ${competitor.reviewCount ?? "—"}`} />
          ))}
        </div>
        <DataFootnote>观察样本有限，价格是抓取时的公开页面值；评论数不是销量。市场分只用于验证排序，不代表发布批准。</DataFootnote>
      </Panel>
    </div>
  );
}

type CompliancePayload = { compliance: ComplianceData[] };
export function ComplianceCanvas({ productId, country, revision, onSelectCountry, onRequest }: { productId: string; country: Country | null; revision: number; onSelectCountry: (country: Country) => void; onRequest?: (country: Country) => void }) {
  const [data, setData] = useState<CompliancePayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setError(null);
    getJson<CompliancePayload>(`/api/products/${productId}/compliance`)
      .then((payload) => { if (alive) setData(payload); })
      .catch((err) => { if (alive) setError(errorMessage(err)); });
    return () => { alive = false; };
  }, [productId, revision]);
  const selected = country ?? data?.compliance[0]?.country ?? "DE";
  const check = data?.compliance.find((item) => item.country === selected) ?? null;

  if (error) return <EmptyState icon={TriangleAlert} title="合规视图加载失败" body={error} />;
  if (!data) return <LoadingState label="读取官方来源预检…" />;
  return (
    <div className="mx-auto max-w-[1020px] space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionTitle eyebrow="合规预检" title="什么可能阻止这个产品？" />
        <Pill tone="gold">不构成法律意见 / 官方认证</Pill>
      </div>
      <CountryTabs value={selected} onChange={onSelectCountry} counts={Object.fromEntries(data.compliance.map((item) => [item.country, COMPLIANCE_LABEL[item.status]?.slice(0, 4)]))} />
      {!check ? (
        <EmptyState icon={ShieldCheck} title={`还没有${COUNTRY_META[selected].name}的合规预检`} body="抓取该市场的官方来源，并把已验证引文和开放项分开；不会用一句话宣称已经合规。" action={onRequest ? <button type="button" onClick={() => onRequest(selected)} className="rounded-full bg-[#0E5C4E] px-4 py-2 text-[10px] text-white">检查{COUNTRY_META[selected].name}合规</button> : null} />
      ) : (
        <>
          <Panel>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2"><Pill tone={statusTone(check.status)}>{COMPLIANCE_LABEL[check.status] ?? check.status}</Pill><Pill>检查范围 · {check.scopeStatus === "IN_SCOPE" ? "在范围内" : check.scopeStatus === "OUT_OF_SCOPE" ? "超出范围" : check.scopeStatus}</Pill></div>
                <h3 className="mt-2 text-[22px] font-medium tracking-[-0.03em] text-[#12312A]">{COUNTRY_META[check.country].name} · 合规预检</h3>
                <p className="mt-2 max-w-2xl text-[11px] leading-relaxed text-[#6B7B72]">{check.statusReason}</p>
              </div>
              <div className="text-right text-[9px] leading-relaxed text-[#A2AEA6]">
                <div>检查时间</div>
                <div className="mt-1 font-mono text-[10px] text-[#6B7B72]">{new Date(check.researchedAt).toLocaleDateString("zh-CN")}</div>
                <div className="mt-2">{check.officialSources.filter((item) => item.status === "FETCHED").length}/{check.officialSources.length} 官方页已抓取</div>
              </div>
            </div>
          </Panel>

          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <Panel>
              <SectionTitle eyebrow="要求" title="要求与待办" />
              <div className="mt-3 divide-y divide-[#F0E8DB]">
                {check.requirements.map((requirement) => (
                  <div key={requirement.id} className="py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="text-[12px] font-medium text-[#1E413A]">{requirement.title}</div>
                      <Pill tone={requirement.verified ? "teal" : requirement.status === "POSSIBLE" ? "gold" : "neutral"}>
                        {requirement.verified ? "引文已验证" : REQUIREMENT_LABEL[requirement.status] ?? requirement.status}
                      </Pill>
                    </div>
                    <p className="mt-1 text-[10px] leading-relaxed text-[#6B7A72]">{requirement.requirement}</p>
                    {requirement.actionItems.length > 0 ? (
                      <ul className="mt-2 space-y-1">
                        {requirement.actionItems.slice(0, 3).map((item) => <li key={item} className="flex gap-1.5 text-[10px] leading-relaxed text-[#5A746C]"><span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-[#0E5C4E]" />{item}</li>)}
                      </ul>
                    ) : null}
                  </div>
                ))}
              </div>
            </Panel>
            <div className="space-y-4">
              <Panel>
                <SectionTitle eyebrow="来源" title="官方来源" />
                <div className="mt-3 space-y-1.5">
                  {check.officialSources.map((source) => (
                    <ExternalSource key={`${source.url}-${source.title}`} title={source.title} url={source.url} note={`${source.domain} · ${source.status === "FETCHED" ? "已抓取" : "抓取失败，保留待核实"}`} />
                  ))}
                </div>
              </Panel>
              <Panel>
                <SectionTitle eyebrow="归类" title="HS 候选" />
                <div className="mt-3 space-y-2">
                  {check.hsCandidates.length === 0 ? <p className="text-[10px] text-[#A2AEA6]">没有生成 HS 候选。</p> : check.hsCandidates.map((candidate) => (
                    <div key={candidate.code} className="rounded-lg border border-[#F0E8DB] bg-[#FFFBF3] p-3">
                      <div className="flex items-center justify-between gap-2"><span className="font-mono text-[13px] text-[#0E5C4E]">{candidate.code}</span><Pill tone={candidate.verified ? "teal" : "gold"}>{candidate.verified ? "官方匹配" : "候选"}</Pill></div>
                      <div className="mt-1 text-[10px] leading-relaxed text-[#6B7B72]">{candidate.description}</div>
                      <div className="mt-1 text-[9px] text-[#A2AEA6]">{candidate.rationale}</div>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
          </div>
          <DataFootnote>官方原文标题和 URL 保留原语言；预检只抓取公开页面，不能替代报关行、实验室或目标市场监管机构的正式判断。</DataFootnote>
        </>
      )}
    </div>
  );
}

type SimulationPayload = { latest: SimulationResult | null; simulations: SimulationResult[] };
export function SimulationCanvas({ productId, initial, revision }: { productId: string; initial: SimulationResult | null; revision: number }) {
  const [data, setData] = useState<SimulationResult | null>(initial);
  useEffect(() => {
    let alive = true;
    getJson<SimulationPayload>(`/api/products/${productId}/simulations`)
      .then((payload) => { if (alive) setData(payload.latest); })
      .catch(() => {});
    return () => { alive = false; };
  }, [productId, revision]);
  if (!data) return <EmptyState icon={Wallet} title="还没有价格情景" body="在左侧说“采购价降到20元会怎样？”。我会用真实市场基准重算，但不修改商品事实。" />;
  const after = data.after.match;
  return (
    <div className="mx-auto max-w-[980px] space-y-5">
      <SectionTitle eyebrow="价格情景" title="采购价情景重算" action={<Pill tone="gold">仅为情景</Pill>} />
      <Panel>
        <div className="grid gap-5 sm:grid-cols-[1fr_auto_1fr] sm:items-center">
          <div className="rounded-xl bg-[#f5f0e6] p-4">
            <div className="text-[9px] uppercase tracking-[0.12em] text-[#A2AEA6]">商品事实</div>
            <div className="mt-1 text-[26px] font-medium text-[#12312A]">¥{data.before.product.sourcing.priceCNY?.toFixed(2) ?? "—"}</div>
            <div className="mt-1 text-[10px] text-[#77857D]">采购价 · 未被覆盖</div>
          </div>
          <ArrowRight className="mx-auto h-4 w-4 rotate-90 text-[#0E5C4E] sm:rotate-0" />
          <div className="rounded-xl border border-[#cfe2d8] bg-[#F2F8F3] p-4">
            <div className="text-[9px] uppercase tracking-[0.12em] text-[#7E8C84]">假设情景</div>
            <div className="mt-1 text-[26px] font-medium text-[#0E5C4E]">¥{data.overrides.supplierCostCNY?.toFixed(2) ?? "—"}</div>
            <div className="mt-1 text-[10px] text-[#7E8C84]">{data.label}</div>
          </div>
        </div>
        <p className="mt-4 border-t border-[#F0E8DB] pt-3 text-[10px] leading-relaxed text-[#77857D]">价格情景只用于比较，不会覆盖产品事实，也不会改写市场证据或合规状态。</p>
        <div className="mt-3 space-y-2">
          {data.impacts.map((impact) => (
            <div key={{ PRODUCT_DNA: "产品事实", PRICING: "定价", MARKET_MATCH: "市场匹配", COMPLIANCE: "合规", LAUNCH_PAGE: "发布页" }[impact.module] ?? impact.module} className="flex items-start justify-between gap-3 border-t border-[#F0E8DB] py-2.5 text-[10px]">
              <div><span className="font-mono text-[9px] text-[#A2AEA6]">{{ PRODUCT_DNA: "产品事实", PRICING: "定价", MARKET_MATCH: "市场匹配", COMPLIANCE: "合规", LAUNCH_PAGE: "发布页" }[impact.module] ?? impact.module}</span><p className="mt-0.5 text-[#6B7B72]">{impact.detail}</p></div>
              <Pill tone={impact.changed ? "gold" : "neutral"}>{impact.changed ? "已重算" : "未变化"}</Pill>
            </div>
          ))}
        </div>
      </Panel>
      <Panel>
        <SectionTitle eyebrow="排名" title="重算后的验证优先级" />
        <div className="mt-3 divide-y divide-[#F0E8DB]">
          {(after?.countries ?? []).map((row) => (
            <div key={row.country} className="flex items-center justify-between gap-3 py-3">
              <div className="flex items-center gap-3">
                <span className="font-mono text-[10px] text-[#A2AEA6]">{String(row.rank ?? "—").padStart(2, "0")}</span>
                <span className="text-[12px] text-[#1E413A]">{COUNTRY_META[row.country].flag} {COUNTRY_META[row.country].name}</span>
                <GatePill gate={row.complianceGate} />
              </div>
              <div className="font-mono text-[13px] text-[#0E5C4E]">{row.weightedScore?.toFixed(1) ?? "—"}</div>
            </div>
          ))}
        </div>
        <DataFootnote>情景参数与商品事实隔离；要把它变成事实，需要回到产品档案修改并重新确认，而不是直接覆盖。</DataFootnote>
      </Panel>
    </div>
  );
}

type LaunchPayload = { launch: LaunchPageContent | null };
export function LaunchCanvas({ productId, initial, country, revision }: { productId: string; initial: LaunchPageContent | null; country: Country | null; revision: number }) {
  const [data, setData] = useState<LaunchPageContent | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [draft, setDraft] = useState({ headline: "", subheadline: "", description: "" });
  useEffect(() => {
    let alive = true;
    const url = country ? `/api/products/${productId}/launch?country=${country}` : `/api/products/${productId}/launch`;
    getJson<LaunchPayload>(url)
      .then((payload) => { if (alive) setData(payload.launch); })
      .catch((err) => { if (alive) setError(errorMessage(err)); });
    return () => { alive = false; };
  }, [productId, country, revision]);
  useEffect(() => {
    if (data) setDraft({ headline: data.headline, subheadline: data.subheadline, description: data.description });
  }, [data]);

  const saveDraft = async () => {
    if (!data) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload = await api<{ launch: LaunchPageContent }>(`/api/products/${productId}/launch?country=${data.country}`, {
        method: "PATCH",
        body: JSON.stringify(draft),
      });
      setData(payload.launch);
      setEditing(false);
    } catch (err) {
      setSaveError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  if (error) return <EmptyState icon={TriangleAlert} title="发布页加载失败" body={error} />;
  if (!data) return <EmptyState icon={Rocket} title="还没有发布页" body="在左侧说“帮我生成日本市场商品页”。买家可见文案会使用目标市场语言，并以验证素材呈现。" />;
  return (
    <div className="mx-auto max-w-[1020px] space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionTitle eyebrow="本地化发布素材" title="发布前验证页" action={<Pill tone="gold">验证素材 · 不作受监管声明</Pill>} />
        <div className="flex flex-wrap items-center gap-2">
          <Pill>{COUNTRY_META[data.country].flag} {COUNTRY_META[data.country].name}</Pill><Pill>{COUNTRY_META[data.country].language}</Pill><Pill>{data.generatedBy === "AI" ? "AI 生成" : "确定性模板"}</Pill>
          {saveError ? <span className="text-[9px] text-[#B3402C]">{saveError}</span> : null}
          {editing ? <>
            <button type="button" onClick={() => void saveDraft()} disabled={saving} className="rounded-full bg-[#0E5C4E] px-3 py-1.5 text-[10px] text-white disabled:opacity-45">{saving ? "保存中…" : "保存文案"}</button>
            <button type="button" onClick={() => { setEditing(false); if (data) setDraft({ headline: data.headline, subheadline: data.subheadline, description: data.description }); }} className="rounded-full border border-[#DCD0BC] bg-white px-3 py-1.5 text-[10px] text-[#6B7B72]">取消</button>
          </> : <button type="button" onClick={() => setEditing(true)} className="rounded-full border border-[#DCD0BC] bg-white px-3 py-1.5 text-[10px] text-[#6B7B72]">编辑文案</button>}
        </div>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <Panel className="overflow-hidden p-0">
          <div className="border-b border-[#F0E8DB] bg-[#f6f1e7] px-5 py-3 text-[9px] uppercase tracking-[0.16em] text-[#A2AEA6]">买家可见预览 · {COUNTRY_META[data.country].language}</div>
          <div className="p-5 sm:p-6">
            {editing ? (
              <div className="space-y-2">
                <input value={draft.headline} maxLength={160} onChange={(event) => setDraft((current) => ({ ...current, headline: event.target.value }))} className="w-full rounded-lg border border-[#DCD0BC] bg-white px-3 py-2 text-[18px] font-medium text-[#12312A] outline-none focus:border-[#0E5C4E]" aria-label="标题" />
                <input value={draft.subheadline} maxLength={260} onChange={(event) => setDraft((current) => ({ ...current, subheadline: event.target.value }))} className="w-full rounded-lg border border-[#DCD0BC] bg-white px-3 py-2 text-[11px] text-[#1E413A] outline-none focus:border-[#0E5C4E]" aria-label="副标题" />
                <textarea value={draft.description} maxLength={1800} rows={6} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} className="w-full resize-y rounded-lg border border-[#DCD0BC] bg-white px-3 py-2 text-[11px] leading-relaxed text-[#1E413A] outline-none focus:border-[#0E5C4E]" aria-label="描述" />
                <p className="text-[9px] text-[#A2AEA6]">编辑只修改这一个市场的买家可见文案，不改变产品事实或合规状态。</p>
              </div>
            ) : (
              <>
                <h3 className="text-[24px] font-medium leading-tight tracking-[-0.03em] text-[#12312A]">{data.headline}</h3>
                <p className="mt-2 text-[12px] leading-relaxed text-[#6B7B72]">{data.subheadline}</p>
                <p className="mt-4 text-[11px] leading-[1.8] text-[#5A746C]">{data.description}</p>
              </>
            )}
            <div className="mt-5 grid gap-3">
              {data.features.slice(0, 4).map((feature) => <div key={feature.title} className="rounded-lg border border-[#F0E8DB] bg-[#FFFBF3] p-3"><div className="text-[11px] font-medium text-[#1E413A]">{feature.title}</div><p className="mt-0.5 text-[10px] text-[#77857D]">{feature.description}</p></div>)}
            </div>
            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#F0E8DB] pt-4">
              <div><div className="text-[20px] font-medium text-[#0E5C4E]">{data.price !== null ? `${data.currency} ${data.price.toFixed(2)}` : "价格待定"}</div><div className="mt-0.5 text-[9px] text-[#A2AEA6]">{data.priceNote}</div></div>
              <span className="rounded-full bg-[#0E5C4E] px-4 py-2 text-[11px] text-white">{data.ctaLabel}</span>
            </div>
          </div>
        </Panel>
        <div className="space-y-4">
          <Panel>
            <SectionTitle eyebrow="合规清单" title="开放清单" />
            <div className="mt-3 space-y-1.5">
              {data.complianceChecklist.map((item) => <div key={`${item.item}-${item.sourceUrl ?? ""}`} className="flex items-start justify-between gap-2 text-[10px]"><span className="text-[#6B7B72]">{item.item}</span><Pill tone={item.status === "DONE" ? "teal" : "gold"}>{item.status === "DONE" ? "已完成" : item.status === "OPEN" ? "待完成" : "待核实"}</Pill></div>)}
            </div>
          </Panel>
          <Panel>
            <SectionTitle eyebrow="供应商问题" title="向供应商确认" />
            <ul className="mt-3 space-y-1.5">{data.supplierQuestions.slice(0, 5).map((question) => <li key={question} className="flex gap-1.5 text-[10px] leading-relaxed text-[#6B7B72]"><span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-[#B8862F]" />{question}</li>)}</ul>
          </Panel>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link href={`/launch/${productId}`} className="inline-flex items-center gap-2 rounded-full bg-[#0E5C4E] px-4 py-2.5 text-[11px] text-white">编辑完整发布页 <ArrowRight className="h-3.5 w-3.5" /></Link>
        <Link href={`/launch/${productId}/preview?country=${data.country}`} className="inline-flex items-center gap-2 rounded-full border border-[#DCD0BC] bg-white px-4 py-2.5 text-[11px] text-[#6B7B72]">打开预览</Link>
      </div>
    </div>
  );
}

type PassportPayload = { passport: PassportSnapshot | null };
export function PassportCanvas({ productId, initial, revision }: { productId: string; initial: PassportSnapshot | null; revision: number }) {
  const [data, setData] = useState<PassportSnapshot | null>(initial);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    getJson<PassportPayload>(`/api/products/${productId}/passport`)
      .then((payload) => { if (alive) setData(payload.passport); })
      .catch((err) => { if (alive) setError(errorMessage(err)); });
    return () => { alive = false; };
  }, [productId, revision]);
  if (error) return <EmptyState icon={TriangleAlert} title="护照加载失败" body={error} />;
  if (!data) return <EmptyState icon={FileJson} title="还没有数字产品护照" body="完成市场研究后，在左侧说“创建产品护照”。我会把产品、证据、市场、合规、排名和发布页打成带日期的版本快照。" />;
  return (
    <div className="mx-auto max-w-[980px] space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <SectionTitle eyebrow="版本快照" title={`产品护照 v${data.version}`} />
        <div className="flex gap-2"><Pill tone="teal">{data.dataMode === "DEMO" ? "演示数据" : "真实研究快照"}</Pill><Pill>{data.evidence.length} 条证据</Pill></div>
      </div>
      <Panel className="border-[#d8cbb6] bg-[#fbf6ea]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="font-mono text-[9px] uppercase tracking-[0.2em] text-[#B8862F]">PRODUCT PASSPORT</div>
            <h2 className="mt-2 text-[24px] font-medium tracking-[-0.03em] text-[#12312A]">{data.product.name}</h2>
            <div className="mt-2 text-[10px] text-[#77857D]">{data.passportId} · 生成于 {new Date(data.generatedAt).toLocaleString("zh-CN")}</div>
          </div>
          <div className="flex gap-2">
            <a href={`/api/products/${productId}/passport/export`} className="inline-flex items-center gap-1.5 rounded-full bg-[#0E5C4E] px-3.5 py-2 text-[10px] text-white"><Download className="h-3 w-3" /> 导出 JSON</a>
            <Link href={`/passport/${productId}`} className="inline-flex items-center gap-1.5 rounded-full border border-[#DCD0BC] bg-white px-3.5 py-2 text-[10px] text-[#6B7B72]"><Printer className="h-3 w-3" /> 打印 / PDF</Link>
          </div>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <div className="rounded-lg border border-[#EBE0CF] bg-white/60 p-3"><div className="text-[9px] text-[#A2AEA6]">市场快照</div><div className="mt-1 text-[18px] text-[#0E5C4E]">{data.markets.length}</div></div>
          <div className="rounded-lg border border-[#EBE0CF] bg-white/60 p-3"><div className="text-[9px] text-[#A2AEA6]">合规市场</div><div className="mt-1 text-[18px] text-[#0E5C4E]">{data.compliance.length}</div></div>
          <div className="rounded-lg border border-[#EBE0CF] bg-white/60 p-3"><div className="text-[9px] text-[#A2AEA6]">最高验证优先级</div><div className="mt-1 text-[18px] text-[#0E5C4E]">{data.match?.countries[0] ? COUNTRY_META[data.match.countries[0].country].name : "—"}</div></div>
        </div>
      </Panel>
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel>
          <SectionTitle eyebrow="行动" title="下一步" />
          <ul className="mt-3 space-y-2">{data.nextActions.map((action) => <li key={action} className="flex gap-2 text-[11px] leading-relaxed text-[#5A746C]"><Check className="mt-0.5 h-3 w-3 shrink-0 text-[#0E5C4E]" />{action}</li>)}</ul>
        </Panel>
        <Panel>
          <SectionTitle eyebrow="来源" title="证据账本" />
          <div className="mt-3 space-y-1.5">
            {data.evidence.slice(0, 6).map((item) => <div key={item.id} className="flex items-start justify-between gap-2 border-t border-[#F0E8DB] py-2 text-[10px]"><span className="line-clamp-2 text-[#6B7B72]">{item.sourceTitle}{item.country ? ` · ${COUNTRY_META[item.country].name}` : ""}</span><Pill>{VERIFICATION_LABEL[item.verificationStatus] ?? item.verificationStatus}</Pill></div>)}
          </div>
        </Panel>
      </div>
      <Panel>
        <p className="text-[10px] leading-relaxed text-[#77857D]">{data.disclaimer}</p>
      </Panel>
    </div>
  );
}
