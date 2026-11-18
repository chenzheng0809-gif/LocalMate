import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  CalendarDays,
  Download,
  ExternalLink,
  FileJson,
  Fingerprint,
  Globe2,
  Printer,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { PassportActions } from "@/components/passport/PassportActions";
import { CountryMark, Kicker, Meta, Tag } from "@/components/agent/workbench";
import { getRepositories } from "@/lib/repositories";
import type { ComplianceStatus, Country, MarketResearchData } from "@/types/domain";
import { COUNTRY_META, COUNTRY_ORDER } from "@/types/domain";
import { formatDate, formatDateOnly } from "@/lib/utils/date";
import { formatMoney, percentage } from "@/lib/utils/money";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const product = getRepositories().products.getById(id);
  return {
    title: product ? `${product.name} · 数字产品护照` : "数字产品护照 · Product Passport",
    description: "可浏览、可打印的产品出海决策档案；包含市场判断、合规预审、证据和开放任务。",
  };
}

const COMPLIANCE_LABEL: Record<ComplianceStatus, string> = {
  PRECHECK_COMPLETE: "初步检查完成",
  ACTION_REQUIRED: "需完成事项",
  REVIEW_REQUIRED: "需专业复核",
  RESTRICTED: "已确认限制",
  OUT_OF_SCOPE: "超出范围",
};

const VERIFICATION_LABEL: Record<string, string> = {
  VERIFIED: "已验证",
  PARTIALLY_VERIFIED: "部分验证",
  UNVERIFIED: "未验证",
  IMPORTED_SNAPSHOT: "导入快照",
};

const GATE_LABEL: Record<string, string> = {
  CLEAR: "可进入下一步",
  CAUTION: "谨慎",
  BLOCKED: "阻断",
  UNKNOWN: "未知",
};

const JOB_LABEL: Record<string, string> = {
  PENDING: "未开始",
  RUNNING: "执行中",
  COMPLETE: "已完成",
  COMPLETED: "已完成",
  PARTIAL: "部分完成",
  FAILED: "失败",
};

function oneLine(summary: string): string {
  return summary.replace(/（?ev_[a-z0-9]+[^）]*）?/gi, "").replace(/\s+/g, " ").split(/(?<=。)/)[0]?.slice(0, 100) ?? "";
}

function gateTone(gate: string | undefined): "teal" | "gold" | "red" | "neutral" {
  if (gate === "CAUTION") return "gold";
  if (gate === "BLOCKED") return "red";
  if (gate === "CLEAR") return "teal";
  return "neutral";
}

export default async function PassportPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ version?: string }>;
}) {
  const { id } = await params;
  const { version } = await searchParams;
  const repos = getRepositories();
  const product = repos.products.getById(id);
  if (!product) notFound();
  const versions = repos.passports.listByProduct(id);
  const requestedVersion = version ? Number(version) : null;
  const record = requestedVersion && Number.isFinite(requestedVersion)
    ? repos.passports.getByVersion(id, requestedVersion)
    : repos.passports.getLatest(id);
  const passport = record?.snapshot ?? null;
  const latestVersion = versions[0]?.version ?? null;
  const top = passport?.match?.recommendedCountry ?? null;
  const topRow = passport?.match?.countries.find((row) => row.country === top) ?? null;
  const marketByCountry = new Map<Country, MarketResearchData>(
    (passport?.markets ?? []).map((market) => [market.country, market]),
  );
  const checkByCountry = new Map((passport?.compliance ?? []).map((check) => [check.country, check]));
  const openActions = Array.from(new Set([
    ...(passport?.nextActions ?? []),
    ...(passport?.compliance ?? []).flatMap((check) => check.actionItems.slice(0, 1)),
  ])).slice(0, 6);

  return (
    <div className="passport-page min-h-screen bg-[#F4EDE1] text-[#12312A]">
      <header className="no-print sticky top-0 z-30 border-b border-[#E6DCCB] bg-[#FFFBF4]/95 backdrop-blur">
        <div className="mx-auto flex min-h-14 max-w-[1180px] flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-6">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-2" aria-label="Product Passport 首页">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0E5C4E] text-[9px] font-semibold text-white">PP</span>
              <span className="hidden text-[10px] font-medium text-[#1E413A] sm:block">Product Passport</span>
            </Link>
            <span className="hidden h-3 w-px bg-[#DFD4C1] sm:block" />
            <Link href={`/agent/${id}`} className="inline-flex items-center gap-1 text-[9px] text-[#6B7A72] hover:text-[#0E5C4E]"><ArrowLeft className="h-3 w-3" /> 返回工作台</Link>
          </div>
          <PassportActions productId={id} hasPassport={Boolean(passport)} version={passport?.version} />
        </div>
      </header>

      <main className="mx-auto max-w-[1180px] px-4 py-6 sm:px-6 sm:py-8 print:max-w-none print:p-0">
        <div className="no-print mb-4 flex flex-wrap items-center gap-2 font-mono text-[8px] uppercase tracking-[0.16em] text-[#A2AEA6]">
          <Link href={`/agent/${id}?view=product`} className="hover:text-[#0E5C4E]">{product.name}</Link>
          <span className="text-[#D2C6B4]">/</span>
          <span className="text-[#0E5C4E]">数字护照</span>
          {record ? <span className="ml-auto inline-flex items-center gap-1"><CalendarDays className="h-3 w-3" /> 签发于 {formatDate(record.createdAt)}</span> : null}
        </div>

        {!passport ? (
          <section className="rounded-[22px] border border-[#E6DCCB] bg-[#FFFDF8] p-7 sm:p-12">
            <div className="flex items-center gap-2"><FileJson className="h-4 w-4 text-[#B8862F]" /><Kicker>还没有签发护照</Kicker></div>
            <h1 className="mt-3 text-[clamp(1.8rem,4vw,3rem)] font-medium leading-[1.05] tracking-[-0.05em] text-[#12312A]">先有证据，再有一份可以带走的文件。</h1>
            <p className="mt-3 max-w-[640px] text-[11px] leading-[1.9] text-[#68796F]">
              护照需要至少一个市场的真实研究。它会冻结当时的产品事实、市场判断、合规预检、排名和下一步；不存在的证据不会补造。
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <PassportActions productId={id} hasPassport={false} />
              <Link href={`/agent/${id}`} className="text-[9px] text-[#6B7A72] underline decoration-[#D2C6B4] underline-offset-4 hover:text-[#0E5C4E]">先回到工作台研究市场</Link>
            </div>
            {versions.length > 0 ? <div className="mt-5 text-[9px] text-[#A2AEA6]">已有版本：{versions.map((item) => `v${item.version}`).join(" · ")}</div> : null}
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                { icon: Fingerprint, title: "不可变快照", body: "每次签发创建新版本，旧版本仍可查阅和导出。" },
                { icon: ShieldCheck, title: "未知不被隐藏", body: "缺证据、开放合规项和失败任务会留在文件里。" },
                { icon: Globe2, title: "可分享", body: "浏览器可读、可打印为 PDF，也可导出 JSON。" },
              ].map((item) => (
                <div key={item.title} className="rounded-xl border border-[#EBE0CF] bg-[#FFFBF3] p-4">
                  <item.icon className="h-3.5 w-3.5 text-[#0E5C4E]" />
                  <div className="mt-2 text-[10px] font-medium text-[#1E413A]">{item.title}</div>
                  <p className="mt-1 text-[9px] leading-relaxed text-[#8A988F]">{item.body}</p>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <>
            <div className="no-print mb-3 flex flex-wrap items-center gap-1.5">
              {versions.map((item) => (
                <Link
                  key={item.version}
                  href={`/passport/${id}?version=${item.version}`}
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[8.5px] transition ${item.version === passport.version ? "border-[#0E5C4E] bg-[#0E5C4E] text-white" : "border-[#E3D8C6] bg-[#FFFDF8] text-[#6B7A72] hover:border-[#0E5C4E]/40"}`}
                >
                  v{item.version}{item.version === latestVersion ? " · 最新" : ""}
                </Link>
              ))}
              <span className="ml-1 inline-flex items-center gap-1 font-mono text-[8px] uppercase tracking-[0.1em] text-[#B4BEB7]"><BadgeCheck className="h-3 w-3" /> 版本化决策文件</span>
              <a href={`/api/products/${id}/passport/export?version=${passport.version}`} className="ml-auto inline-flex items-center gap-1 text-[8.5px] text-[#0E5C4E] hover:underline"><Download className="h-3 w-3" /> 下载当前 JSON</a>
            </div>

            {!passport.product.confirmed ? <div className="no-print mb-3 rounded-xl border border-[#EFDCB4] bg-[#FCF2DF] px-4 py-3 text-[9.5px] leading-relaxed text-[#8A6F3C]">这份快照记录了未确认的产品简报。它是研究档案，不应作为已核实事实的发布依据。</div> : null}

            <article className="passport-sheet overflow-hidden rounded-[22px] border border-[#DED2BE] bg-[#FFFDF8] shadow-[0_24px_70px_rgba(54,53,42,0.07)]">
              <section className="relative border-b border-[#EBE0CF] bg-[#FBF1E2] px-6 py-7 sm:px-9 sm:py-9">
                <div className="pointer-events-none absolute right-6 top-6 hidden h-24 w-24 items-center justify-center rounded-full border border-[#D6C3A2]/40 sm:flex">
                  <div className="flex h-16 w-16 items-center justify-center rounded-full border border-[#D6C3A2]/30 text-center font-mono text-[8px] uppercase leading-[1.5] tracking-[0.16em] text-[#9C6E28]">验证<br />不是<br />认证</div>
                </div>
                <div className="flex items-center gap-2 font-mono text-[8.5px] uppercase tracking-[0.24em] text-[#8A988F]"><Fingerprint className="h-3 w-3 text-[#9C6E28]" /> Product Passport · 产品出海护照</div>
                <div className="mt-4 flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
                  <div className="min-w-0">
                    <h1 className="max-w-[760px] text-[clamp(2rem,4.2vw,3.4rem)] font-medium leading-[1.03] tracking-[-0.055em] text-[#12312A]">{passport.product.name}</h1>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <Tag tone="teal">版本 v{passport.version}</Tag>
                      <Tag tone={passport.dataMode === "DEMO" ? "gold" : "neutral"}>{passport.dataMode === "DEMO" ? "演示数据" : "真实研究快照"}</Tag>
                      <Tag tone={passport.product.confirmed ? "teal" : "gold"}>{passport.product.confirmed ? "简报已确认" : "简报未确认"}</Tag>
                      <Tag tone="neutral">{passport.markets.length}/4 市场</Tag>
                    </div>
                  </div>
                  <div className="shrink-0 text-left sm:text-right">
                    <div className="font-mono text-[8px] uppercase tracking-[0.12em] text-[#A2AEA6]">签发日期</div>
                    <div className="mt-1 text-[11px] text-[#3A5A52]">{formatDateOnly(passport.generatedAt)}</div>
                    <div className="mt-1 font-mono text-[8px] text-[#B4BEB7]">{passport.passportId}</div>
                  </div>
                </div>
              </section>

              <section className="grid gap-6 border-b border-[#EBE0CF] px-6 py-7 sm:px-9 lg:grid-cols-[1.2fr_0.8fr]">
                <div>
                  <Kicker>决策摘要</Kicker>
                  <div className="mt-2 flex flex-wrap items-end gap-4">
                    {top ? <CountryMark country={top} /> : null}
                    <div>
                      <h2 className="text-[clamp(1.4rem,2.8vw,2.2rem)] font-medium leading-none tracking-[-0.04em] text-[#12312A]">{top ? `优先验证 ${COUNTRY_META[top].name}` : "暂不排序"}</h2>
                      <div className="mt-1.5 text-[9px] text-[#8A988F]">{top ? `${COUNTRY_META[top].localName} · ${COUNTRY_META[top].language} · ${COUNTRY_META[top].currency}` : "没有市场达到跨市场可比门槛"}</div>
                    </div>
                    {topRow?.weightedScore !== null && topRow?.weightedScore !== undefined ? <span className="font-mono text-[28px] leading-none text-[#0E5C4E]">{topRow.weightedScore.toFixed(1)}<span className="text-[9px] text-[#A2AEA6]"> /100</span></span> : null}
                  </div>
                  <p className="mt-3 max-w-[720px] text-[10.5px] leading-[1.95] text-[#6B7B72]">{passport.match?.explanation ?? "证据不足，护照保留排序空白；市场分不是发布批准。"}</p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    <Tag tone={gateTone(topRow?.complianceGate)}>合规门 · {GATE_LABEL[topRow?.complianceGate ?? "UNKNOWN"] ?? topRow?.complianceGate ?? "未知"}</Tag>
                    <Tag tone="neutral">研究任务 · {passport.job ? JOB_LABEL[passport.job.status] ?? passport.job.status : "未记录"}</Tag>
                    <Tag tone="neutral">证据 · {passport.evidence.length} 条</Tag>
                  </div>
                </div>
                <div className="rounded-xl border border-[#EAE0D0] bg-[#FFFBF3] p-4">
                  <div className="flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5 text-[#9C6E28]" /><Kicker>下一步动作</Kicker></div>
                  <ol className="mt-2 space-y-2">
                    {openActions.length === 0 ? <li className="text-[9px] text-[#A2AEA6]">没有记录开放动作。</li> : openActions.map((action, index) => (
                      <li key={action} className="flex gap-2 text-[9.5px] leading-[1.75] text-[#6B7B72]"><span className="font-mono text-[8px] text-[#B8862F]">0{index + 1}</span>{action}</li>
                    ))}
                  </ol>
                </div>
              </section>

              <section className="passport-avoid-break border-b border-[#EBE0CF] px-6 py-7 sm:px-9">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div><Kicker>01 / 商品身份</Kicker><h2 className="mt-1 text-[17px] font-medium tracking-[-0.025em] text-[#1C3E36]">这份档案从哪件商品开始。</h2></div>
                  <span className="text-[8px] text-[#A2AEA6]">来源与确认分开记录</span>
                </div>
                <div className="mt-4 grid gap-5 lg:grid-cols-[0.34fr_0.66fr]">
                  {passport.product.images[0] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={passport.product.images[0]} alt={passport.product.name} referrerPolicy="no-referrer" className="aspect-square w-full rounded-xl border border-[#E6DCCB] object-cover" />
                  ) : (
                    <div className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-[#DED2BE] text-[9px] text-[#B4BEB7]">未提供商品图</div>
                  )}
                  <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
                    <Meta label="品类" value={passport.product.category === "OUT_OF_SCOPE" ? "超出范围" : "非电动家居收纳"} />
                    <Meta label="材质" value={passport.product.attributes.material ?? "未提供"} />
                    <Meta label="颜色" value={passport.product.attributes.color ?? "未提供"} />
                    <Meta label="产品尺寸" value={passport.product.attributes.dimensions ?? "未提供"} />
                    <Meta label="包装尺寸" value={passport.product.attributes.packagingDimensions ?? "未提供"} />
                    <Meta label="带包装重量" value={passport.product.attributes.weight !== null ? `${passport.product.attributes.weight} kg` : "未提供"} />
                    <Meta label="采购价" value={passport.product.sourcing.priceCNY !== null ? `¥${passport.product.sourcing.priceCNY}` : "未提供"} />
                    <Meta label="起订量" value={passport.product.sourcing.MOQ ?? "未提供"} />
                    <Meta label="供应商" value={passport.product.sourcing.supplier ?? "未提供"} />
                    <div className="col-span-2 border-t border-[#F0E8DB] pt-3 sm:col-span-3">
                      <Kicker>未完成字段</Kicker>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {passport.product.missingFields.length === 0 ? <Tag tone="teal">关键事实已记录</Tag> : passport.product.missingFields.map((field) => <Tag key={field} tone="gold">{field}</Tag>)}
                      </div>
                    </div>
                  </div>
                </div>
              </section>

              <section className="passport-avoid-break border-b border-[#EBE0CF] px-6 py-7 sm:px-9">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div><Kicker>02 / 市场判断</Kicker><h2 className="mt-1 text-[17px] font-medium tracking-[-0.025em] text-[#1C3E36]">四个市场，有日期、有边界。</h2></div>
                  <span className="text-[8px] text-[#A2AEA6]">分数只用于验证排序</span>
                </div>
                <div className="mt-4 overflow-x-auto rounded-xl border border-[#EBE0CF]">
                  <table className="w-full min-w-[720px] border-collapse text-left">
                    <thead>
                      <tr className="bg-[#FBF3E7] text-[8px] uppercase tracking-[0.1em] text-[#A2AEA6]">
                        <th className="px-3 py-2 font-medium">市场</th>
                        <th className="px-3 py-2 font-medium">一句话判断</th>
                        <th className="px-3 py-2 font-medium">优先级</th>
                        <th className="px-3 py-2 font-medium">建议零售价</th>
                        <th className="px-3 py-2 font-medium">合规预检</th>
                      </tr>
                    </thead>
                    <tbody>
                      {COUNTRY_ORDER.map((country) => {
                        const market = marketByCountry.get(country);
                        const row = passport.match?.countries.find((item) => item.country === country);
                        const check = checkByCountry.get(country);
                        const meta = COUNTRY_META[country];
                        return (
                          <tr key={country} className="border-t border-[#F0E8DB] align-top text-[9px] text-[#6B7B72]">
                            <td className="px-3 py-2.5"><span className="flex items-center gap-1.5"><CountryMark country={country} size="sm" /><span className="text-[#1E413A]">{meta.name}</span></span></td>
                            <td className="max-w-[360px] px-3 py-2.5 leading-relaxed">{market ? oneLine(market.narrative.landscapeSummary) : <span className="text-[#B8862F]">未研究</span>}</td>
                            <td className="px-3 py-2.5 font-mono text-[10px] text-[#0E5C4E]">{row?.weightedScore?.toFixed(1) ?? "—"}<span className="ml-0.5 text-[7.5px] text-[#B4BEB7]">/100</span></td>
                            <td className="px-3 py-2.5 font-mono text-[9px] text-[#1E413A]">{market ? formatMoney(market.pricing.suggestedRetail, meta.currency) : "—"}</td>
                            <td className="px-3 py-2.5">{check ? <Tag tone={check.status === "RESTRICTED" ? "red" : "gold"}>{COMPLIANCE_LABEL[check.status]}</Tag> : <span className="text-[8px] text-[#A2AEA6]">未预检</span>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {passport.markets.map((market) => <Tag key={market.country} tone={market.status === "COMPLETE" ? "teal" : "gold"}>{COUNTRY_META[market.country].name} · {market.status === "COMPLETE" ? "证据完整" : market.status === "PARTIAL" ? "部分证据" : market.status === "INSUFFICIENT_EVIDENCE" ? "证据不足" : market.status}</Tag>)}
                </div>
              </section>

              <section className="passport-avoid-break grid gap-6 border-b border-[#EBE0CF] px-6 py-7 sm:px-9 lg:grid-cols-2">
                <div>
                  <Kicker>03 / 合规预审</Kicker>
                  <h2 className="mt-1 text-[17px] font-medium tracking-[-0.025em] text-[#1C3E36]">开放项不会被藏在脚注里。</h2>
                  <div className="mt-3 space-y-2">
                    {passport.compliance.length === 0 ? <p className="text-[9px] text-[#A2AEA6]">该版本未包含合规预检。</p> : passport.compliance.map((check) => (
                      <div key={check.country} className="rounded-lg border border-[#EBE0CF] p-3">
                        <div className="flex items-center justify-between gap-2">
                          <span className="flex items-center gap-1.5 text-[10px] font-medium text-[#3A5A52]"><CountryMark country={check.country} size="sm" />{COUNTRY_META[check.country].name}</span>
                          <Tag tone={check.status === "RESTRICTED" ? "red" : "gold"}>{COMPLIANCE_LABEL[check.status]}</Tag>
                        </div>
                        <p className="mt-1 line-clamp-2 text-[9px] leading-relaxed text-[#77857D]">{check.statusReason}</p>
                        <div className="mt-1.5 text-[8px] text-[#A2AEA6]">{check.officialSources.filter((source) => source.status === "FETCHED").length}/{check.officialSources.length} 官方页已抓取 · 不构成正式许可</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <Kicker>04 / 关键业务假设</Kicker>
                  <h2 className="mt-1 text-[17px] font-medium tracking-[-0.025em] text-[#1C3E36]">哪些数字是事实，哪些只是情景。</h2>
                  <div className="mt-3 space-y-2">
                    {passport.markets.slice(0, 2).map((market) => (
                      <div key={market.country} className="rounded-lg border border-[#EBE0CF] p-3">
                        <div className="flex items-center justify-between gap-2 text-[9px] font-medium text-[#3A5A52]"><span>{COUNTRY_META[market.country].name} · {market.pricing.currency}</span><Tag tone="gold">情景</Tag></div>
                        <div className="mt-2 grid grid-cols-3 gap-2">
                          <Meta label="基准零售" value={formatMoney(market.pricing.benchmarkRetail, market.pricing.currency)} />
                          <Meta label="建议零售" value={formatMoney(market.pricing.suggestedRetail, market.pricing.currency)} />
                          <Meta label="毛利" value={percentage(market.pricing.grossMarginPct)} />
                        </div>
                        <p className="mt-2 line-clamp-2 text-[8.5px] leading-relaxed text-[#A2AEA6]">{market.pricing.assumptions[0] ?? "没有记录定价假设。"}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>

              <section className="passport-avoid-break border-b border-[#EBE0CF] px-6 py-7 sm:px-9">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div><Kicker>05 / 本地化测试方案</Kicker><h2 className="mt-1 text-[17px] font-medium tracking-[-0.025em] text-[#1C3E36]">先测试说法，再决定投入。</h2></div>
                  {passport.launchPage ? <Tag tone="teal">{COUNTRY_META[passport.launchPage.country].name} · {passport.launchPage.generatedBy === "AI" ? "AI 生成" : "模板生成"}</Tag> : <Tag tone="gold">尚未生成</Tag>}
                </div>
                {passport.launchPage ? (
                  <div className="mt-3 grid gap-4 rounded-xl border border-[#EBE0CF] bg-[#FFFBF3] p-4 sm:grid-cols-[1fr_auto] sm:items-end">
                    <div>
                      <div className="text-[8px] uppercase tracking-[0.12em] text-[#A2AEA6]">{COUNTRY_META[passport.launchPage.country].language} · 买家可见草稿</div>
                      <div className="mt-1 text-[18px] font-medium leading-tight text-[#12312A]">{passport.launchPage.headline}</div>
                      <p className="mt-1 text-[9.5px] leading-relaxed text-[#68796F]">{passport.launchPage.subheadline}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5"><Tag tone="neutral">{passport.launchPage.ctaLabel}</Tag><Tag tone="neutral">{passport.launchPage.complianceChecklist.filter((item) => item.status !== "DONE").length} 项待办</Tag></div>
                    </div>
                    <div className="text-left sm:text-right">
                      <div className="font-mono text-[18px] text-[#0E5C4E]">{formatMoney(passport.launchPage.price, passport.launchPage.currency)}</div>
                      <div className="mt-0.5 max-w-[230px] text-[8px] leading-relaxed text-[#A2AEA6]">{passport.launchPage.priceNote}</div>
                    </div>
                  </div>
                ) : (
                  <p className="mt-3 rounded-xl border border-dashed border-[#DED2BE] px-4 py-5 text-[9.5px] leading-relaxed text-[#A2AEA6]">本版本没有本地化测试页。Market Switch 会保留真实空状态，不会预先伪造四个国家的页面。</p>
                )}
              </section>

              <section className="passport-avoid-break grid gap-6 border-b border-[#EBE0CF] px-6 py-7 sm:px-9 lg:grid-cols-2">
                <div>
                  <Kicker>06 / 证据账本</Kicker>
                  <h2 className="mt-1 text-[17px] font-medium tracking-[-0.025em] text-[#1C3E36]">{passport.evidence.length} 条来源，按真实记录列出。</h2>
                  <div className="mt-3 max-h-[330px] overflow-y-auto pr-1">
                    {passport.evidence.slice(0, 20).map((item) => (
                      <div key={item.id} className="border-t border-[#F0E8DB] py-2 first:border-t-0 first:pt-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="line-clamp-2 text-[9px] leading-relaxed text-[#6B7B72]">{item.sourceTitle}{item.country ? ` · ${COUNTRY_META[item.country].name}` : ""}</div>
                            <div className="mt-0.5 font-mono text-[7.5px] text-[#B4BEB7]">{item.sourceDomain}</div>
                          </div>
                          {item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noreferrer noopener" className="shrink-0 text-[#0E5C4E]/60 hover:text-[#0E5C4E]" aria-label={`打开来源 ${item.sourceTitle}`}><ExternalLink className="h-3 w-3" /></a> : null}
                        </div>
                        <div className="mt-1"><Tag tone={item.verificationStatus === "VERIFIED" ? "teal" : "neutral"}>{VERIFICATION_LABEL[item.verificationStatus] ?? item.verificationStatus}</Tag></div>
                      </div>
                    ))}
                    {passport.evidence.length === 0 ? <p className="text-[9px] text-[#A2AEA6]">没有捕获证据条目。</p> : null}
                  </div>
                </div>
                <div>
                  <Kicker>07 / 优先验证与开放任务</Kicker>
                  <h2 className="mt-1 text-[17px] font-medium tracking-[-0.025em] text-[#1C3E36]">这份文件建议你先做什么。</h2>
                  <div className="mt-3 space-y-2">
                    {openActions.length === 0 ? <p className="text-[9px] text-[#A2AEA6]">没有记录开放任务。</p> : openActions.map((action) => (
                      <div key={action} className="flex items-start gap-2 border-t border-[#F0E8DB] py-1.5 text-[9px] leading-relaxed text-[#6B7B72] first:border-t-0 first:pt-0"><span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-[#B8862F]" />{action}</div>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Link href={`/agent/${id}`} className="inline-flex items-center gap-1 rounded-full border border-[#DFD4C1] px-3 py-2 text-[9px] text-[#3A5A52] hover:border-[#0E5C4E]/40 hover:text-[#0E5C4E]">回到工作台处理任务</Link>
                    <Link href={`/passport/${id}?version=${passport.version}`} className="inline-flex items-center gap-1 rounded-full border border-[#DFD4C1] px-3 py-2 text-[9px] text-[#3A5A52] hover:border-[#0E5C4E]/40 hover:text-[#0E5C4E]"><Printer className="h-3 w-3" /> 当前版本</Link>
                  </div>
                </div>
              </section>

              <footer className="bg-[#FBF3E7] px-6 py-5 sm:px-9">
                <div className="flex items-start gap-2">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#9C6E28]" />
                  <p className="text-[8.5px] leading-[1.85] text-[#77857D]">{passport.disclaimer}</p>
                </div>
                <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#EBE0CF] pt-3 font-mono text-[8px] uppercase tracking-[0.1em] text-[#B4BEB7]">
                  <span className="inline-flex items-center gap-1"><BadgeCheck className="h-3 w-3" /> 版本 v{passport.version} · {passport.passportId}</span>
                  <span>{formatDate(passport.generatedAt)} · Product Passport</span>
                </div>
              </footer>
            </article>
          </>
        )}
      </main>
    </div>
  );
}
