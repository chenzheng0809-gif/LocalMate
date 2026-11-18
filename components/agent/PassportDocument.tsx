"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BadgeCheck,
  CalendarDays,
  Download,
  FileJson,
  Fingerprint,
  Printer,
  TriangleAlert,
} from "lucide-react";
import type { PassportSnapshot } from "@/types/domain";
import { COUNTRY_META, COUNTRY_ORDER } from "@/types/domain";
import { errorMessage } from "@/lib/client/api";
import {
  ActionButton,
  CountryMark,
  EmptySurface,
  Kicker,
  Meta,
  Tag,
  WorkbenchHeading,
} from "@/components/agent/workbench";

type Payload = { passport: PassportSnapshot | null };

const COMPLIANCE_LABEL: Record<string, string> = {
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

const STATUS_LABEL: Record<string, string> = {
  COMPLETE: "证据完整",
  PARTIAL: "部分证据",
  INSUFFICIENT_EVIDENCE: "证据不足",
  FAILED: "失败",
};

const JOB_LABEL: Record<string, string> = {
  PENDING: "未开始",
  RUNNING: "执行中",
  COMPLETE: "已完成",
  COMPLETED: "已完成",
  PARTIAL: "部分完成",
  FAILED: "失败",
};

const GATE_LABEL: Record<string, string> = {
  CLEAR: "可进入下一步",
  CAUTION: "谨慎",
  BLOCKED: "阻断",
  UNKNOWN: "未知",
};

function dateText(value: string): string {
  return new Date(value).toLocaleDateString("zh-CN", { year: "numeric", month: "2-digit", day: "2-digit" });
}

function oneLine(summary: string): string {
  return summary.replace(/（?ev_[a-z0-9]+[^）]*）?/gi, "").replace(/\s+/g, " ").split(/(?<=。)/)[0]?.slice(0, 120) ?? "";
}

export function PassportCanvas({
  productId,
  initial,
  revision,
  onRequestNewVersion,
}: {
  productId: string;
  initial: PassportSnapshot | null;
  revision: number;
  onRequestNewVersion?: () => void;
}) {
  const [data, setData] = useState<PassportSnapshot | null>(initial);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setError(null);
    fetch(`/api/products/${productId}/passport`, { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as Payload & { error?: { message?: string } };
        if (!response.ok) throw new Error(payload.error?.message ?? "加载失败。");
        if (alive) setData(payload.passport);
      })
      .catch((err) => {
        if (alive) setError(errorMessage(err));
      });
    return () => {
      alive = false;
    };
  }, [productId, revision]);

  if (error) return <EmptySurface icon={TriangleAlert} title="产品护照加载失败" body={error} />;
  if (!data) {
    return (
      <EmptySurface
        icon={FileJson}
        title="还没有数字产品护照"
        body="完成市场研究后，让 Copilot 创建护照。它会把产品、证据、市场、合规、排名和本地化方案冻结成带日期的版本。"
        action={onRequestNewVersion ? <ActionButton onClick={onRequestNewVersion}>创建产品护照</ActionButton> : undefined}
      />
    );
  }

  const top = data.match?.recommendedCountry ?? data.match?.countries[0]?.country ?? null;
  const topRow = data.match?.countries.find((row) => row.country === top);
  const launch = data.launchPage;
  const openActions = [
    ...(data.nextActions ?? []),
    ...data.compliance.flatMap((check) => check.actionItems.slice(0, 2)),
  ].filter((item, index, all) => item && all.indexOf(item) === index).slice(0, 6);
  const marketByCountry = new Map(data.markets.map((market) => [market.country, market]));
  const checkByCountry = new Map(data.compliance.map((check) => [check.country, check]));

  return (
    <div className="mx-auto max-w-[1100px] space-y-5 pb-6">
      <WorkbenchHeading
        eyebrow="03 · 启动验证 / 数字护照"
        title="一份可以带走的决策档案。"
        description="不是证书，也不是 JSON 导出页。它记录已知、未知、优先验证市场、合规预审和仍未完成的任务。"
        action={
          <div className="flex flex-wrap gap-2">
            <a href={`/api/products/${productId}/passport/export?version=${data.version}`} download className="inline-flex items-center justify-center gap-1.5 rounded-full border border-[#DFD4C1] bg-[#FFFDF8] px-3.5 py-2 text-[10px] font-medium text-[#3A5A52] transition hover:border-[#0E5C4E]/45 hover:text-[#0E5C4E]"><Download className="h-3 w-3" /> 导出 JSON</a>
            <ActionButton variant="secondary" href={`/passport/${productId}?version=${data.version}`} icon={Printer}>打印 / HTML 护照</ActionButton>
            {onRequestNewVersion ? <ActionButton onClick={onRequestNewVersion}>签发新版本</ActionButton> : null}
          </div>
        }
      />

      {data.product.confirmed === false ? <div className="rounded-xl border border-[#EFDCB4] bg-[#FCF2DF] px-4 py-3 text-[9.5px] leading-relaxed text-[#8A6F3C]">这份快照记录了未确认的产品简报。它是有用的研究档案，但不能当作已核实事实的发布依据；请先确认商品再签发新版本。</div> : null}

      <article className="overflow-hidden rounded-[22px] border border-[#DED2BE] bg-[#FFFDF8] shadow-[0_22px_60px_rgba(54,53,42,0.06)]">
        <header className="relative border-b border-[#EBE0CF] bg-[#FBF1E2] px-6 py-7 sm:px-9 sm:py-9">
          <div className="pointer-events-none absolute right-6 top-6 hidden h-20 w-20 items-center justify-center rounded-full border border-[#D6C3A2]/40 sm:flex">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border border-[#D6C3A2]/30 font-mono text-[8px] uppercase leading-tight tracking-[0.16em] text-[#9C6E28]">
              验证<br />不是认证
            </div>
          </div>
          <div className="flex items-center gap-2 font-mono text-[8.5px] uppercase tracking-[0.24em] text-[#8A988F]">
            <Fingerprint className="h-3 w-3 text-[#9C6E28]" /> Product Passport · 产品出海护照
          </div>
          <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="max-w-[720px] text-[clamp(1.8rem,3.5vw,3rem)] font-medium leading-[1.04] tracking-[-0.05em] text-[#12312A]">{data.product.name}</h1>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Tag tone="teal">版本 v{data.version}</Tag>
                <Tag tone={data.dataMode === "DEMO" ? "gold" : "neutral"}>{data.dataMode === "DEMO" ? "演示数据" : "真实研究快照"}</Tag>
                <Tag tone="neutral">{data.markets.length} 个市场</Tag>
                <Tag tone="neutral">{data.evidence.length} 条证据</Tag>
              </div>
            </div>
            <div className="shrink-0 text-left sm:text-right">
              <div className="font-mono text-[8px] uppercase tracking-[0.14em] text-[#A2AEA6]">签发时间</div>
              <div className="mt-1 text-[11px] text-[#3A5A52]">{dateText(data.generatedAt)}</div>
              <div className="mt-1 font-mono text-[8px] text-[#B4BEB7]">{data.passportId}</div>
            </div>
          </div>
        </header>

        <section className="grid gap-6 border-b border-[#EBE0CF] px-6 py-7 sm:px-9 lg:grid-cols-[1.2fr_0.8fr]">
          <div>
            <Kicker>决策摘要</Kicker>
            <div className="mt-2 flex flex-wrap items-end gap-4">
              {top ? <CountryMark country={top} /> : null}
              <div>
                <div className="text-[24px] font-medium leading-none tracking-[-0.035em] text-[#12312A]">{top ? `优先验证 ${COUNTRY_META[top].name}` : "暂不排序"}</div>
                <div className="mt-1 text-[9px] text-[#8A988F]">{top ? `${COUNTRY_META[top].localName} · ${COUNTRY_META[top].language} · ${COUNTRY_META[top].currency}` : "没有达到跨市场可比门槛"}</div>
              </div>
              {topRow?.weightedScore !== null && topRow?.weightedScore !== undefined ? <span className="font-mono text-[26px] leading-none text-[#0E5C4E]">{topRow.weightedScore.toFixed(1)}<span className="text-[9px] text-[#A2AEA6]"> /100</span></span> : null}
            </div>
            <p className="mt-3 max-w-[720px] text-[10.5px] leading-[1.9] text-[#6B7B72]">{data.match?.explanation ?? "没有足够的跨市场证据，护照保留市场空白，不补造排名。"}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Tag tone={topRow?.complianceGate === "CAUTION" ? "gold" : "neutral"}>合规门 · {GATE_LABEL[topRow?.complianceGate ?? "UNKNOWN"] ?? topRow?.complianceGate ?? "未知"}</Tag>
              <Tag tone="neutral">研究任务 · {data.job ? JOB_LABEL[data.job.status] ?? data.job.status : "未记录"}</Tag>
              <Tag tone="neutral">证据覆盖 · {data.markets.length}/4</Tag>
            </div>
          </div>
          <div className="rounded-xl border border-[#EAE0D0] bg-[#FFFBF3] p-4">
            <div className="flex items-center gap-2"><CalendarDays className="h-3.5 w-3.5 text-[#9C6E28]" /><Kicker>下一步动作</Kicker></div>
            <ol className="mt-2 space-y-2">
              {openActions.length === 0 ? <li className="text-[9px] text-[#A2AEA6]">没有记录下一步。</li> : openActions.map((action, index) => (
                <li key={action} className="flex gap-2 text-[9.5px] leading-[1.7] text-[#6B7B72]"><span className="font-mono text-[8px] text-[#B8862F]">0{index + 1}</span>{action}</li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-b border-[#EBE0CF] px-6 py-7 sm:px-9">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <Kicker>01 / 商品身份</Kicker>
              <h2 className="mt-1 text-[17px] font-medium tracking-[-0.025em] text-[#1C3E36]">这份护照从哪件商品开始。</h2>
            </div>
            <Tag tone="neutral">{data.product.sourcePlatform === "1688" ? "1688 来源" : data.product.sourcePlatform === "IMAGE" ? "图片识别" : data.product.sourcePlatform === "DEMO" ? "演示产品" : "用户输入"}</Tag>
          </div>
          <div className="mt-4 grid gap-5 lg:grid-cols-[0.35fr_0.65fr]">
            {data.product.images[0] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.product.images[0]} alt={data.product.name} referrerPolicy="no-referrer" className="aspect-square w-full rounded-xl border border-[#E6DCCB] object-cover" />
            ) : (
              <div className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-[#DED2BE] text-[9px] text-[#B4BEB7]">未提供商品图</div>
            )}
            <div className="grid grid-cols-2 gap-x-4 gap-y-4 sm:grid-cols-3">
              <Meta label="品类" value={data.product.category === "OUT_OF_SCOPE" ? "超出范围" : "家居收纳"} />
              <Meta label="材质" value={data.product.attributes.material ?? "未提供"} />
              <Meta label="颜色" value={data.product.attributes.color ?? "未提供"} />
              <Meta label="产品尺寸" value={data.product.attributes.dimensions ?? "未提供"} />
              <Meta label="包装尺寸" value={data.product.attributes.packagingDimensions ?? "未提供"} />
              <Meta label="带包装重量" value={data.product.attributes.weight !== null ? `${data.product.attributes.weight} kg` : "未提供"} />
              <Meta label="采购价" value={data.product.sourcing.priceCNY !== null ? `¥${data.product.sourcing.priceCNY}` : "未提供"} />
              <Meta label="起订量" value={data.product.sourcing.MOQ ?? "未提供"} />
              <Meta label="供应商" value={data.product.sourcing.supplier ?? "未提供"} />
              <div className="col-span-2 mt-1 border-t border-[#F0E8DB] pt-3 sm:col-span-3">
                <Kicker>未完成字段</Kicker>
                <div className="mt-1 flex flex-wrap gap-1.5">
                  {data.product.missingFields.length === 0 ? <Tag tone="teal">关键事实已记录</Tag> : data.product.missingFields.map((field) => <Tag key={field} tone="gold">{field}</Tag>)}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-[#EBE0CF] px-6 py-7 sm:px-9">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <Kicker>02 / 已研究市场</Kicker>
              <h2 className="mt-1 text-[17px] font-medium tracking-[-0.025em] text-[#1C3E36]">四个判断，有日期、有边界。</h2>
            </div>
            <span className="text-[8.5px] text-[#A2AEA6]">市场分只用于验证排序</span>
          </div>
          <div className="mt-4 overflow-hidden rounded-xl border border-[#EBE0CF]">
            <div className="grid grid-cols-[100px_1fr_70px_90px] bg-[#FBF3E7] px-3 py-2 text-[8px] uppercase tracking-[0.12em] text-[#A2AEA6]">
              <span>市场</span><span>一句话判断</span><span>分数</span><span>合规预检</span>
            </div>
            {COUNTRY_ORDER.map((country) => {
              const market = marketByCountry.get(country);
              const row = data.match?.countries.find((item) => item.country === country);
              const check = checkByCountry.get(country);
              return (
                <div key={country} className="grid grid-cols-[100px_1fr_70px_90px] items-start gap-2 border-t border-[#F0E8DB] px-3 py-2.5 text-[9px]">
                  <span className="flex items-center gap-1.5 text-[#3A5A52]"><CountryMark country={country} size="sm" />{COUNTRY_META[country].name}</span>
                  <span className="line-clamp-3 text-[#68796F]">{market ? oneLine(market.narrative.landscapeSummary) : "未研究"}</span>
                  <span className="font-mono text-[10px] text-[#0E5C4E]">{row?.weightedScore?.toFixed(1) ?? "—"}</span>
                  <span className="text-[8.5px] text-[#77857D]">{check ? COMPLIANCE_LABEL[check.status] ?? check.status : "未预检"}</span>
                </div>
              );
            })}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {data.markets.map((market) => <Tag key={market.country} tone={market.status === "COMPLETE" ? "teal" : "gold"}>{COUNTRY_META[market.country].name} {STATUS_LABEL[market.status] ?? market.status}</Tag>)}
          </div>
        </section>

        <section className="grid gap-6 border-b border-[#EBE0CF] px-6 py-7 sm:px-9 lg:grid-cols-2">
          <div>
            <Kicker>03 / 合规预审</Kicker>
            <h2 className="mt-1 text-[17px] font-medium tracking-[-0.025em] text-[#1C3E36]">开放项不会被藏在脚注里。</h2>
            <div className="mt-3 space-y-2">
              {data.compliance.length === 0 ? <p className="text-[9px] text-[#A2AEA6]">该版本未包含合规预检。</p> : data.compliance.map((check) => (
                <div key={check.country} className="rounded-lg border border-[#EBE0CF] p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 text-[10px] font-medium text-[#3A5A52]"><CountryMark country={check.country} size="sm" />{COUNTRY_META[check.country].name}</span>
                    <Tag tone={check.status === "RESTRICTED" ? "red" : "gold"}>{COMPLIANCE_LABEL[check.status] ?? check.status}</Tag>
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
              {data.markets.slice(0, 2).map((market) => (
                <div key={market.country} className="rounded-lg border border-[#EBE0CF] p-3">
                  <div className="flex items-center justify-between gap-2 text-[9px] font-medium text-[#3A5A52]"><span>{COUNTRY_META[market.country].name} · {market.pricing.currency}</span><Tag tone="gold">情景</Tag></div>
                  <div className="mt-1.5 grid grid-cols-3 gap-2 text-[8.5px] text-[#77857D]">
                    <span>基准 {market.pricing.benchmarkRetail ?? "—"}</span>
                    <span>建议 {market.pricing.suggestedRetail?.toFixed(2) ?? "—"}</span>
                    <span>毛利 {market.pricing.grossMarginPct !== null ? `${Math.round(market.pricing.grossMarginPct * 100)}%` : "—"}</span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[8.5px] leading-relaxed text-[#A2AEA6]">{market.pricing.assumptions[0]}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-[#EBE0CF] px-6 py-7 sm:px-9">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <Kicker>05 / 本地化测试方案</Kicker>
              <h2 className="mt-1 text-[17px] font-medium tracking-[-0.025em] text-[#1C3E36]">先测试说法，再决定投入。</h2>
            </div>
            {launch ? <Tag tone="teal">{COUNTRY_META[launch.country].name} · {launch.generatedBy === "AI" ? "AI 生成" : "模板生成"}</Tag> : <Tag tone="gold">尚未生成</Tag>}
          </div>
          {launch ? (
            <div className="mt-3 grid gap-4 rounded-xl border border-[#EBE0CF] bg-[#FFFBF3] p-4 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <div className="text-[8.5px] uppercase tracking-[0.12em] text-[#A2AEA6]">{COUNTRY_META[launch.country].language} · 买家可见草稿</div>
                <div className="mt-1 text-[17px] font-medium leading-tight text-[#12312A]">{launch.headline}</div>
                <p className="mt-1 text-[9.5px] leading-relaxed text-[#68796F]">{launch.subheadline}</p>
                <div className="mt-2 flex flex-wrap gap-1.5"><Tag tone="neutral">{launch.ctaLabel}</Tag><Tag tone="neutral">{launch.complianceChecklist.filter((item) => item.status !== "DONE").length} 项待办</Tag></div>
              </div>
              <div className="text-left sm:text-right">
                <div className="font-mono text-[18px] text-[#0E5C4E]">{launch.price !== null ? `${launch.currency} ${launch.price.toFixed(2)}` : "价格待定"}</div>
                <div className="mt-0.5 max-w-[220px] text-[8px] leading-relaxed text-[#A2AEA6]">{launch.priceNote}</div>
              </div>
            </div>
          ) : (
            <p className="mt-3 rounded-xl border border-dashed border-[#DED2BE] px-4 py-5 text-[9.5px] leading-relaxed text-[#A2AEA6]">本版本没有本地化测试页。Market Switch 会保留真实空状态，不会预先伪造四个国家的页面。</p>
          )}
        </section>

        <section className="grid gap-6 border-b border-[#EBE0CF] px-6 py-7 sm:px-9 lg:grid-cols-2">
          <div>
            <Kicker>06 / 证据账本</Kicker>
            <h2 className="mt-1 text-[17px] font-medium tracking-[-0.025em] text-[#1C3E36]">{data.evidence.length} 条来源，按真实记录列出。</h2>
            <div className="mt-3 max-h-[300px] overflow-y-auto pr-1">
              {data.evidence.slice(0, 16).map((item) => (
                <div key={item.id} className="border-t border-[#F0E8DB] py-2 first:border-t-0 first:pt-0">
                  <div className="flex items-start justify-between gap-2">
                    <span className="line-clamp-2 text-[9px] leading-relaxed text-[#6B7B72]">{item.sourceTitle}{item.country ? ` · ${COUNTRY_META[item.country].name}` : ""}</span>
                    <Tag tone={item.verificationStatus === "VERIFIED" ? "teal" : "neutral"}>{VERIFICATION_LABEL[item.verificationStatus] ?? item.verificationStatus}</Tag>
                  </div>
                  <div className="mt-0.5 font-mono text-[8px] text-[#B4BEB7]">{item.sourceDomain}</div>
                </div>
              ))}
            </div>
          </div>
          <div>
            <Kicker>07 / 优先验证与开放任务</Kicker>
            <h2 className="mt-1 text-[17px] font-medium tracking-[-0.025em] text-[#1C3E36]">这份档案建议你先做什么。</h2>
            <div className="mt-3 space-y-2">
              {openActions.length === 0 ? <p className="text-[9px] text-[#A2AEA6]">没有记录开放任务。</p> : openActions.map((action) => (
                <div key={action} className="flex items-start gap-2 border-t border-[#F0E8DB] py-1.5 first:border-t-0 first:pt-0 text-[9px] leading-relaxed text-[#6B7B72]"><span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-[#B8862F]" />{action}</div>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {top ? <ActionButton variant="secondary" href={`/agent/${data.product.id}?q=${encodeURIComponent(`查看${COUNTRY_META[top].name}合规`)}`}>回到工作台处理任务</ActionButton> : null}
              <Link href={`/passport/${data.product.id}?version=${data.version}`} className="inline-flex items-center gap-1 rounded-full border border-[#DFD4C1] px-3 py-2 text-[9px] text-[#3A5A52] hover:border-[#0E5C4E]/40 hover:text-[#0E5C4E]"><Printer className="h-3 w-3" /> 可打印 HTML</Link>
            </div>
          </div>
        </section>

        <footer className="bg-[#FBF3E7] px-6 py-5 sm:px-9">
          <div className="flex items-start gap-2">
            <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#9C6E28]" />
            <p className="text-[8.5px] leading-[1.8] text-[#77857D]">{data.disclaimer}</p>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#EBE0CF] pt-3 font-mono text-[8px] uppercase tracking-[0.1em] text-[#B4BEB7]">
            <span className="inline-flex items-center gap-1"><BadgeCheck className="h-3 w-3" /> 版本 v{data.version} · {data.passportId}</span>
            <span>{dateText(data.generatedAt)} · Product Passport</span>
          </div>
        </footer>
      </article>
    </div>
  );
}
