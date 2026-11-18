import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  CircleAlert,
  ExternalLink,
  FileCheck2,
  FileSearch,
  Globe2,
  Link2,
  ListChecks,
  ShieldAlert,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import { ComplianceRunner } from "@/components/compliance/ComplianceRunner";
import {
  Chip,
  DataOriginBadge,
  Disclaimer,
  EmptyState,
  Panel,
  SectionHeading,
  StatusPill,
  statusLabel,
  verificationLabel,
} from "@/components/ui/primitives";
import { getRepositories } from "@/lib/repositories";
import { COUNTRY_META, COUNTRY_ORDER } from "@/types/domain";
import { formatDate } from "@/lib/utils/date";

export const dynamic = "force-dynamic";

const STATUS_COPY: Record<string, string> = {
  RESTRICTED: "未解除限制前，不要进口或发布。",
  ACTION_REQUIRED: "发布前需要完成卖家动作。",
  REVIEW_REQUIRED: "预检不完整。应把合规门视为未关闭。",
  PRECHECK_COMPLETE: "本次有限预检的证据集完整。",
  OUT_OF_SCOPE: "该产品超出第一版范围。",
};

export default async function CompliancePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repos = getRepositories();
  const product = repos.products.getById(id);
  if (!product) notFound();
  const checks = repos.compliance.getByProduct(id);
  const markets = repos.research.getByProduct(id);
  const match = repos.matches.getLatest(id);
  const ordered = [...checks].sort((a, b) => COUNTRY_ORDER.indexOf(a.country) - COUNTRY_ORDER.indexOf(b.country));
  const reviewCount = ordered.filter((check) => check.status === "REVIEW_REQUIRED").length;
  const actionCount = ordered.filter((check) => check.status === "ACTION_REQUIRED" || check.status === "RESTRICTED").length;

  return (
    <div className="container-page py-8 lg:py-12">
      <div className="flex flex-wrap items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em] text-muted">
        <Link href="/" className="hover:text-soft">产品护照</Link>
        <span className="text-white/20">/</span>
        <Link href={`/product/${id}`} className="hover:text-soft">{product.name}</Link>
        <span className="text-white/20">/</span>
        <span className="text-cyan-300/80">合规预检</span>
      </div>

      <div className="mt-5 flex flex-col gap-4 border-b border-white/[0.08] pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap gap-2"><Chip tone="cyan">合规预检</Chip><Chip tone="gold">不构成法律意见</Chip></div>
          <h1 className="display-md mt-4 text-soft">什么可能阻止这个产品？</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            四个法域，逐一抓取官方来源。只有当引文能与抓取页面匹配时，结论才会标记为“已验证”。
            其他所有项目都会保持开放，并明确展示。
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ComplianceRunner productId={id} hasChecks={checks.length > 0} />
          {markets.length > 0 ? <Link href={`/discover/${id}`} className="btn-ghost !px-4 !py-2.5 text-[11px]">市场视图 <ArrowRight className="h-3.5 w-3.5" /></Link> : null}
        </div>
      </div>

      {checks.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="还没有合规检查"
            description="运行四国预检。智能体会抓取官方页面、提取带引文的要求、校验每条引文，然后执行确定性规则集。"
            icon={<ShieldCheck className="h-8 w-8" />}
            action={<ComplianceRunner productId={id} hasChecks={false} />}
          />
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-3">
            <Panel flat className="p-4">
              <div className="font-mono text-[8px] uppercase tracking-[0.14em] text-muted">国家检查</div>
              <div className="mt-2 font-mono text-2xl text-soft">{ordered.length}/4</div>
              <div className="mt-1 text-[10px] text-muted">US · JP · DE · UK</div>
            </Panel>
            <Panel flat className="p-4">
              <div className="font-mono text-[8px] uppercase tracking-[0.14em] text-muted">待复核</div>
              <div className="mt-2 font-mono text-2xl text-gold-300">{reviewCount}</div>
              <div className="mt-1 text-[10px] text-muted">预检证据不完整</div>
            </Panel>
            <Panel flat className="p-4">
              <div className="font-mono text-[8px] uppercase tracking-[0.14em] text-muted">卖家动作 / 限制</div>
              <div className="mt-2 font-mono text-2xl text-amber-200">{actionCount}</div>
              <div className="mt-1 text-[10px] text-muted">必须在投入发布预算前关闭</div>
            </Panel>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {ordered.map((check) => (
              <a key={check.country} href={`#${check.country}`} className="chip border-white/10 text-muted hover:border-cyan-300/30 hover:text-cyan-200">
                {COUNTRY_META[check.country].flag} {COUNTRY_META[check.country].name} · {statusLabel(check.status)}
              </a>
            ))}
          </div>

          <div className="mt-10 space-y-10">
            {ordered.map((check) => {
              const meta = COUNTRY_META[check.country];
              const countryMatch = match?.countries.find((item) => item.country === check.country);
              return (
                <section key={check.country} id={check.country} className="scroll-mt-32">
                  <div className="flex flex-col gap-4 border-b border-white/[0.08] pb-5 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] font-mono text-[11px] text-cyan-200">{meta.flag}</span>
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="display-md text-soft">{meta.name}</h2>
                          <StatusPill status={check.status} />
                          <DataOriginBadge mode={check.dataMode} />
                        </div>
                        <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-muted">{STATUS_COPY[check.status]} {check.statusReason}</p>
                        <div className="mt-2 font-mono text-[8px] uppercase tracking-[0.12em] text-muted/60">检查于 {formatDate(check.researchedAt)} · 合规门：{countryMatch?.complianceGate ? statusLabel(countryMatch.complianceGate) : "未知"}</div>
                      </div>
                    </div>
                    <Link href={`/markets/${id}#${check.country}`} className="btn-quiet !px-2 !py-1.5 text-[10px]">市场详情 <ArrowUpRight className="h-3 w-3" /></Link>
                  </div>

                  <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
                    <div className="space-y-5">
                      <Panel className="overflow-hidden">
                        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
                          <div className="flex items-center gap-2"><FileSearch className="h-4 w-4 text-cyan-300" /><div className="text-sm text-soft">HS 候选</div></div>
                          <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-muted">无约束力</span>
                        </div>
                        <div className="divide-y divide-white/[0.06]">
                          {check.hsCandidates.length === 0 ? <p className="px-5 py-5 text-[11px] text-muted">没有生成 HS 候选。请补充材质和产品详情后重新运行。</p> : check.hsCandidates.map((candidate) => (
                            <div key={candidate.code} className="px-5 py-4">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="font-mono text-sm text-cyan-200">{candidate.code}</span>
                                  <Chip tone={candidate.verified ? "green" : "gold"}>{candidate.verified ? "官方匹配" : "候选"}</Chip>
                                </div>
                                <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-muted">{candidate.confidence === "HIGH" ? "高" : candidate.confidence === "MEDIUM" ? "中" : "低"}置信度</span>
                              </div>
                              <div className="mt-2 font-mono text-[8px] uppercase tracking-[0.12em] text-muted/60">HS 品目描述（英文原文）</div>
                              <div className="mt-0.5 text-[11px] text-soft">{candidate.description}</div>
                              <p className="mt-1.5 text-[10px] leading-relaxed text-muted">{candidate.rationale} {candidate.verificationNote}</p>
                              {candidate.countrySpecificNote ? <p className="mt-1 text-[10px] leading-relaxed text-gold-200/70">{candidate.countrySpecificNote}</p> : null}
                            </div>
                          ))}
                        </div>
                        <div className="border-t border-white/[0.06] px-5 py-3 text-[10px] leading-relaxed text-muted">仅为候选归类。有约束力的认定由持牌报关行或目的国海关作出。</div>
                      </Panel>

                      <Panel className="overflow-hidden">
                        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
                          <div className="flex items-center gap-2"><ListChecks className="h-4 w-4 text-cyan-300" /><div className="text-sm text-soft">要求与动作</div></div>
                          <span className="font-mono text-[8px] uppercase tracking-[0.12em] text-muted">{check.requirements.length} 条规则</span>
                        </div>
                        <div className="divide-y divide-white/[0.06]">
                          {check.requirements.length === 0 ? <p className="px-5 py-5 text-[11px] text-muted">没有生成要求条目。这不代表健康证明；请查看开放问题。</p> : check.requirements.map((requirement) => (
                            <div key={requirement.id} className="px-5 py-4">
                              <div className="flex flex-wrap items-start justify-between gap-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-[11px] text-soft">{requirement.title}</span>
                                  <Chip tone={requirement.verified ? "green" : requirement.status === "POSSIBLE" || requirement.status === "NEEDS_REVIEW" ? "gold" : "slate"}>
                                    {requirement.verified ? "引文已验证" : statusLabel(requirement.status)}
                                  </Chip>
                                </div>
                                <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-muted">{requirement.appliesTo}</span>
                              </div>
                              <p className="mt-1.5 text-[10px] leading-relaxed text-muted">{requirement.requirement}</p>
                              {requirement.actionItems.length > 0 ? (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {requirement.actionItems.slice(0, 4).map((action) => <Chip key={action} tone="slate">{action}</Chip>)}
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </Panel>

                      <Panel flat className="p-5">
                        <div className="flex items-center gap-2"><FileCheck2 className="h-4 w-4 text-cyan-300" /><div className="text-sm text-soft">文件清单</div></div>
                        <ul className="mt-3 space-y-2">
                          {check.documentation.map((item) => <li key={item} className="flex items-start gap-2 text-[11px] leading-relaxed text-muted"><span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-cyan-300/70" />{item}</li>)}
                        </ul>
                      </Panel>
                    </div>

                    <div className="space-y-4">
                      {check.issues.length > 0 ? (
                        <Panel flat className="p-5">
                          <div className="flex items-center gap-2"><CircleAlert className="h-4 w-4 text-gold-400" /><div className="text-sm text-soft">开放问题</div></div>
                          <div className="mt-3 space-y-2.5">
                            {check.issues.map((issue) => (
                              <div key={issue.id} className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-mono text-[8px] uppercase tracking-[0.1em] text-gold-300/80">{statusLabel(issue.type)}</span>
                                  <span className="font-mono text-[8px] text-muted">{issue.severity === "HIGH" ? "高" : issue.severity === "MEDIUM" ? "中" : "低"}</span>
                                </div>
                                <p className="mt-1.5 text-[10px] leading-relaxed text-muted">{issue.action}</p>
                                <div className="mt-1 font-mono text-[8px] uppercase tracking-[0.1em] text-muted/50">{issue.verified ? "已验证证据" : "未验证"}</div>
                              </div>
                            ))}
                          </div>
                        </Panel>
                      ) : null}

                      <Panel flat className="p-5">
                        <div className="flex items-center gap-2"><Link2 className="h-4 w-4 text-cyan-300" /><div className="text-sm text-soft">官方来源</div></div>
                        <div className="mt-3 space-y-2.5">
                          {check.officialSources.map((source) => (
                            <div key={source.url} className="border-b border-white/[0.05] pb-2.5 last:border-0 last:pb-0">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <div className="text-[10px] leading-snug text-soft/80">{source.title}</div>
                                  <div className="mt-0.5 font-mono text-[8px] text-muted">{source.domain} · {verificationLabel(source.status)}</div>
                                </div>
                                <a href={source.url} target="_blank" rel="noreferrer" className="shrink-0 text-cyan-300/70 hover:text-cyan-200" aria-label={`打开 ${source.title}`}><ExternalLink className="h-3 w-3" /></a>
                              </div>
                              {source.status === "FETCH_FAILED" ? <div className="mt-1 font-mono text-[8px] text-rose-300/70">抓取失败 · 未作为已验证证据使用</div> : null}
                            </div>
                          ))}
                        </div>
                      </Panel>

                      <Panel flat className="p-5">
                        <div className="label-mono">仍未知的内容</div>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {check.missingAttributes.length === 0 ? <Chip tone="green">未声明缺失属性</Chip> : check.missingAttributes.map((item) => <Chip key={item} tone="gold">{item}</Chip>)}
                        </div>
                        {check.actionItems.length > 0 ? (
                          <div className="mt-4 border-t border-white/[0.06] pt-3">
                            <div className="label-mono">下一步动作</div>
                            <ul className="mt-2 space-y-1.5">{check.actionItems.slice(0, 8).map((item) => <li key={item} className="flex items-start gap-2 text-[10px] leading-relaxed text-muted"><span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-gold-400" />{item}</li>)}</ul>
                          </div>
                        ) : null}
                      </Panel>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-gold-400/15 bg-gold-400/[0.03] px-4 py-3">
                    <div className="flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.14em] text-gold-300/80"><TriangleAlert className="h-3 w-3" /> 预检边界</div>
                    <p className="mt-1.5 text-[10px] leading-relaxed text-muted">{check.disclaimers.join(" ")}</p>
                  </div>
                </section>
              );
            })}
          </div>
        </>
      )}

      <section className="mt-14">
        <SectionHeading eyebrow="诚实层" title="引文匹配不等于认证。" description="预检可以告诉你哪些官方来源段落支持某项要求，但不能出具法律意见、有约束力的关税归类或平台批准。" />
        <div className="mt-6 grid gap-4 md:grid-cols-3">
          {[
            { icon: BadgeCheck, title: "已验证意味着什么", body: "在归一化后，被引用的段落在抓取的官方页面上找到了。这不代表整页都被正确解读。" },
            { icon: ShieldAlert, title: "什么保持开放", body: "加载失败的页面、没有已验证引文的规则、模糊的产品归类，以及任何未检查的国家。" },
            { icon: Globe2, title: "谁来做决定", body: "海关、监管机构、公告机构、平台和合格律师。适用时，卖家仍是进口记录人。" },
          ].map((item) => (
            <Panel key={item.title} flat className="p-5">
              <item.icon className="h-4 w-4 text-gold-400/80" />
              <h3 className="mt-3 text-sm text-soft">{item.title}</h3>
              <p className="mt-2 text-[11px] leading-relaxed text-muted">{item.body}</p>
            </Panel>
          ))}
        </div>
      </section>

      <Disclaimer className="mt-8">
        仅为合规预检。这不是法律意见、海关裁定、产品认证或市场准入保证。
        官方来源可能随时变化。进口或发布前，请向相关主管机关或合格专业人士确认每一个开放项。
      </Disclaimer>
    </div>
  );
}
