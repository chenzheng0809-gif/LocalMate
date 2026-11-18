"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  BookOpen,
  Check,
  FileText,
  Loader2,
  RefreshCw,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import type { ComplianceData, ComplianceIssue, ComplianceRequirement, Country, ProductDNA } from "@/types/domain";
import { COUNTRY_META, COUNTRY_ORDER } from "@/types/domain";
import { api, errorMessage } from "@/lib/client/api";
import { cn } from "@/lib/utils/cn";
import {
  ActionButton,
  CountryMark,
  EmptySurface,
  InlineSource,
  Kicker,
  Rule,
  Tag,
  WorkbenchHeading,
} from "@/components/agent/workbench";

type Payload = { compliance: ComplianceData[]; product?: ProductDNA };

const STATUS_LABEL: Record<string, string> = {
  PRECHECK_COMPLETE: "初步检查完成",
  ACTION_REQUIRED: "需完成事项",
  REVIEW_REQUIRED: "需专业复核",
  RESTRICTED: "已确认限制",
  OUT_OF_SCOPE: "超出范围",
};

const TOPIC_LABEL: Record<string, string> = {
  HS_CLASSIFICATION: "归类",
  IMPORT_RESTRICTIONS: "进口限制",
  PRODUCT_SAFETY: "产品安全",
  LABELING: "标签",
  PACKAGING: "包装",
  TARIFF: "关税",
  DOCUMENTATION: "单证",
  CHEMICAL: "化学",
  SUSTAINABILITY: "可持续",
  MARKET_SURVEILLANCE: "市场监督",
};

const REQUIREMENT_STATUS: Record<string, string> = {
  APPLIES: "适用",
  POSSIBLE: "可能适用",
  NEEDS_REVIEW: "需复核",
  NOT_IDENTIFIED: "未识别",
};

type TaskStatus = "已确认限制" | "需专业复核" | "需完成事项" | "核查依据";

type Task = {
  id: string;
  title: string;
  topic: string;
  status: TaskStatus;
  basis: string;
  verified: boolean;
  requirement?: ComplianceRequirement;
  issue?: ComplianceIssue;
  sources: ComplianceData["officialSources"];
  actions: string[];
  evidenceIds: string[];
};

function topicFor(requirement?: ComplianceRequirement, issue?: ComplianceIssue): string {
  const key = requirement?.topic ?? issue?.topic;
  return key ? TOPIC_LABEL[key] ?? key : "一般要求";
}

function statusFor(check: ComplianceData, requirement?: ComplianceRequirement, issue?: ComplianceIssue): TaskStatus {
  if (check.status === "RESTRICTED" || issue?.type === "RESTRICTION_FOUND") return "已确认限制";
  if (issue?.type === "MISSING_ATTRIBUTE" || issue?.type === "ACTION_REQUIRED") return "需完成事项";
  if (requirement && (requirement.status === "POSSIBLE" || requirement.status === "NEEDS_REVIEW" || !requirement.verified)) return "需专业复核";
  if (requirement && requirement.actionItems.length > 0) return "需完成事项";
  return "核查依据";
}

function statusTone(status: TaskStatus): "teal" | "gold" | "red" | "neutral" {
  if (status === "已确认限制") return "red";
  if (status === "需完成事项") return "gold";
  if (status === "需专业复核") return "gold";
  return "teal";
}

function buildTasks(check: ComplianceData): Task[] {
  const requirements = check.requirements.map((requirement) => {
    const sources = check.officialSources.filter((source) => requirement.evidenceIds.includes(source.evidenceId ?? ""));
    return {
      id: requirement.id,
      title: requirement.title,
      topic: topicFor(requirement),
      status: statusFor(check, requirement),
      basis: requirement.requirement,
      verified: requirement.verified,
      requirement,
      sources,
      actions: requirement.actionItems,
      evidenceIds: requirement.evidenceIds,
    } satisfies Task;
  });
  const issueTasks = check.issues
    .filter((issue) => issue.type === "MISSING_ATTRIBUTE" || issue.type === "AMBIGUOUS_CLASSIFICATION" || issue.type === "ACTION_REQUIRED")
    .map((issue) => {
      const sources = check.officialSources.filter((source) => issue.evidenceIds.includes(source.evidenceId ?? ""));
      return {
        id: issue.id,
        title: issue.type === "MISSING_ATTRIBUTE" ? `补充商品事实：${issue.field ?? "关键属性"}` : issue.action,
        topic: topicFor(undefined, issue),
        status: statusFor(check, undefined, issue),
        basis: issue.action,
        verified: issue.verified,
        issue,
        sources,
        actions: issue.action ? [issue.action] : [],
        evidenceIds: issue.evidenceIds,
      } satisfies Task;
    });
  const seen = new Set<string>();
  return [...issueTasks, ...requirements].filter((task) => {
    const key = `${task.title}-${task.topic}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function ComplianceCanvas({
  product,
  country,
  revision,
  onSelectCountry,
  onRequest,
  onGoProduct,
}: {
  product: ProductDNA;
  country: Country | null;
  revision: number;
  onSelectCountry: (country: Country) => void;
  onRequest?: (country: Country) => void;
  onGoProduct?: () => void;
}) {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [localRevision, setLocalRevision] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"全部" | TaskStatus>("全部");
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let alive = true;
    setError(null);
    fetch(`/api/products/${product.id}/compliance`, { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as Payload & { error?: { message?: string } };
        if (!response.ok) throw new Error(payload.error?.message ?? "加载失败。");
        if (alive) setData(payload);
      })
      .catch((err) => {
        if (alive) setError(errorMessage(err));
      });
    return () => {
      alive = false;
    };
  }, [product.id, revision, localRevision]);

  const selectedCountry = country ?? data?.compliance[0]?.country ?? "DE";
  const check = data?.compliance.find((item) => item.country === selectedCountry) ?? null;

  useEffect(() => {
    if (!country && data?.compliance.length) onSelectCountry(data.compliance[0].country);
  }, [country, data?.compliance, onSelectCountry]);
  const tasks = useMemo(() => (check ? buildTasks(check) : []), [check]);
  const filtered = filter === "全部" ? tasks : tasks.filter((task) => task.status === filter);
  const activeTask = filtered.find((task) => task.id === selectedId) ?? filtered[0] ?? null;

  const refreshCheck = async () => {
    setRefreshing(true);
    setError(null);
    try {
      await api<{ compliance: ComplianceData[] }>(`/api/products/${product.id}/compliance`, {
        method: "POST",
        body: JSON.stringify({ countries: [selectedCountry] }),
      });
      setLocalRevision((value) => value + 1);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setRefreshing(false);
    }
  };

  if (error && !data) return <EmptySurface icon={TriangleAlert} title="合规任务板加载失败" body={error} />;
  if (!data) {
    return (
      <div className="mx-auto max-w-[1120px]">
        <div className="flex items-center gap-2 rounded-[20px] border border-[#EBE1D1] bg-[#FFFDF8] px-5 py-8 text-[11px] text-[#77857D]">
          <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0E5C4E]" /> 正在读取真实合规预检…
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1180px] space-y-5 pb-4">
      <WorkbenchHeading
        eyebrow="02 · 出海决策 / 准入核查"
        title="把法规，变成可以推进的准备任务。"
        description="每项任务都绑定商品、市场、依据和官方来源。这里没有“合规通过”按钮；只有开放项、已确认限制和仍待核查的问题。"
        action={<ActionButton variant="secondary" onClick={onGoProduct} href={onGoProduct ? undefined : `/product/${product.id}`} icon={FileText}>补充商品事实</ActionButton>}
      />

      {error ? <div className="rounded-xl border border-[#F3D0C4] bg-[#FBEBE4] px-4 py-3 text-[9.5px] leading-relaxed text-[#B3402C]">{error}</div> : null}
      {!product.confirmed ? <div className="rounded-xl border border-[#EFDCB4] bg-[#FCF2DF] px-4 py-3 text-[9.5px] leading-relaxed text-[#8A6F3C]">商品简报未确认；以下预检可能基于旧事实。确认后才应继续核查或把任务当作当前结论。</div> : null}

      <div className="flex flex-wrap gap-1.5">
        {COUNTRY_ORDER.map((item) => {
          const itemCheck = data.compliance.find((entry) => entry.country === item);
          const active = item === selectedCountry;
          return (
            <button
              key={item}
              type="button"
              onClick={() => {
                onSelectCountry(item);
                setSelectedId(null);
              }}
              className={cn(
                "flex min-w-[150px] flex-1 items-center justify-between gap-2 rounded-xl border px-3 py-2.5 text-left transition",
                active ? "border-[#0E5C4E] bg-[#0E5C4E] text-white" : itemCheck ? "border-[#E3D8C6] bg-[#FFFDF8] text-[#3A5A52] hover:border-[#0E5C4E]/40" : "border-dashed border-[#E3D8C6] bg-[#FFFBF3] text-[#B4BEB7]",
              )}
            >
              <span className="flex min-w-0 items-center gap-2">
                <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-full border font-mono text-[8px]", active ? "border-white/30 bg-white/10" : "border-[#E3D8C6] bg-[#FBF3E7]")}>{COUNTRY_META[item].flag}</span>
                <span className="min-w-0">
                  <span className="block text-[10px] font-medium">{COUNTRY_META[item].name}</span>
                  <span className={cn("mt-0.5 block truncate text-[8px]", active ? "text-white/60" : "text-[#A2AEA6]")}>{itemCheck ? STATUS_LABEL[itemCheck.status] ?? itemCheck.status : "未预检"}</span>
                </span>
              </span>
              {itemCheck ? <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", active ? "bg-white/70" : itemCheck.status === "RESTRICTED" ? "bg-[#B3402C]" : "bg-[#B8862F]")} /> : null}
            </button>
          );
        })}
      </div>

      {!check ? (
        <EmptySurface
          icon={ShieldCheck}
          title={`还没有${COUNTRY_META[selectedCountry].name}的合规预检`}
          body="抓取该市场的官方来源，把要求、开放项和已确认限制分开记录。不会用一句话宣称已经合规。"
          action={onRequest ? product.confirmed ? <ActionButton onClick={() => onRequest(selectedCountry)}>检查{COUNTRY_META[selectedCountry].name}合规</ActionButton> : <ActionButton onClick={onGoProduct} disabled={!onGoProduct} icon={TriangleAlert}>先确认商品简报</ActionButton> : undefined}
        />
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
            <section className="rounded-[20px] border border-[#EBE1D1] bg-[#FFFDF8] p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CountryMark country={check.country} />
                    <Kicker>{COUNTRY_META[check.country].localName} · {COUNTRY_META[check.country].language}</Kicker>
                    <Tag tone={check.status === "PRECHECK_COMPLETE" ? "teal" : check.status === "RESTRICTED" ? "red" : "gold"}>{STATUS_LABEL[check.status] ?? check.status}</Tag>
                    <Tag tone="neutral">{check.scopeStatus === "IN_SCOPE" ? "在范围内" : "超出范围"}</Tag>
                  </div>
                  <h2 className="mt-3 max-w-[720px] text-[18px] font-medium leading-[1.35] tracking-[-0.025em] text-[#1B3A34]">{check.statusReason}</h2>
                </div>
                <div className="text-right text-[8.5px] leading-relaxed text-[#A2AEA6]">
                  <div>预检日期</div>
                  <div className="mt-0.5 font-mono text-[9px] text-[#6B7B72]">{new Date(check.researchedAt).toLocaleDateString("zh-CN")}</div>
                  <div className="mt-1.5">{check.officialSources.filter((source) => source.status === "FETCHED").length}/{check.officialSources.length} 官方页已抓取</div>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#EFE6D8] pt-3">
                <Tag tone="gold">{tasks.length} 项准备任务</Tag>
                <Tag tone="neutral">{check.documentation.length} 类资料</Tag>
                <Tag tone="neutral">{check.hsCandidates.length} 个 HS 候选</Tag>
                <span className="text-[8.5px] text-[#A2AEA6]">初步检查完成 ≠ 获得正式进口或销售许可</span>
              </div>
            </section>
            <section className="rounded-[20px] border border-[#EBE1D1] bg-[#FBF3E7] p-5">
              <Kicker>这一页怎么用</Kicker>
              <ol className="mt-2 space-y-2">
                {[
                  "先看状态，区分限制、待办、待核查，而不是找“通过”。",
                  "选中一项任务，阅读依据、官方来源和所需资料。",
                  "补充商品事实或重新核查后，任务状态会按真实结果更新。",
                ].map((item, index) => (
                  <li key={item} className="flex gap-2 text-[9.5px] leading-[1.75] text-[#68796F]">
                    <span className="font-mono text-[8px] text-[#B8862F]">0{index + 1}</span>{item}
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <div className="grid gap-4 lg:grid-cols-[0.95fr_1.05fr]">
            <section className="rounded-[20px] border border-[#EBE1D1] bg-[#FFFDF8] p-4 sm:p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <Kicker>准备任务板</Kicker>
                  <h3 className="mt-1 text-[16px] font-medium tracking-[-0.02em] text-[#1C3E36]">{filtered.length} 项待处理 / 核查</h3>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(["全部", "需专业复核", "需完成事项", "已确认限制"] as const).map((option) => (
                    <button key={option} type="button" onClick={() => setFilter(option)} className={cn("rounded-full px-2.5 py-1 text-[8.5px] transition", filter === option ? "bg-[#1E413A] text-white" : "bg-[#FAF2E5] text-[#6B7A72] hover:text-[#0E5C4E]")}>
                      {option}{option !== "全部" ? ` ${tasks.filter((task) => task.status === option).length}` : ""}
                    </button>
                  ))}
                </div>
              </div>
              <div className="mt-3 max-h-[640px] space-y-1.5 overflow-y-auto pr-1">
                {filtered.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-[#E3D8C6] px-3 py-5 text-[10px] leading-relaxed text-[#A2AEA6]">这个筛选下没有任务。可以切换到“全部”，或重新核查该市场。</p>
                ) : (
                  filtered.map((task, index) => (
                    <button
                      key={task.id}
                      type="button"
                      onClick={() => setSelectedId(task.id)}
                      className={cn(
                        "w-full rounded-xl border px-3 py-3 text-left transition",
                        activeTask?.id === task.id ? "border-[#0E5C4E] bg-[#F2F8F3]" : "border-[#F0E8DB] bg-[#FFFDF8] hover:border-[#0E5C4E]/35",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-start gap-2">
                          <span className={cn("mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border font-mono text-[8px]", task.status === "核查依据" ? "border-[#C4DED2] bg-[#E6F2EC] text-[#0E5C4E]" : "border-[#EFDCB4] bg-[#FCF0D3] text-[#8A601F]")}>
                            {task.status === "核查依据" ? <Check className="h-2.5 w-2.5" /> : String(index + 1).padStart(2, "0")}
                          </span>
                          <span className="min-w-0">
                            <span className="block text-[10.5px] font-medium leading-snug text-[#1E413A]">{task.title}</span>
                            <span className="mt-0.5 block text-[8.5px] text-[#A2AEA6]">{task.topic} · {COUNTRY_META[check.country].name} · {task.sources.length} 个来源</span>
                            <span className="mt-1 line-clamp-2 block text-[9px] leading-[1.6] text-[#77857D]">{task.basis}</span>
                          </span>
                        </div>
                        <Tag tone={statusTone(task.status)}>{task.status}</Tag>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </section>

            <section className="rounded-[20px] border border-[#EBE1D1] bg-[#FFFDF8] p-5 sm:p-6">
              {activeTask ? (
                <>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Kicker>任务详情 · {activeTask.topic}</Kicker>
                      <h3 className="mt-1 text-[19px] font-medium leading-[1.35] tracking-[-0.025em] text-[#1B3A34]">{activeTask.title}</h3>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Tag tone={statusTone(activeTask.status)}>{activeTask.status}</Tag>
                        <Tag tone="neutral">{product.name}</Tag>
                        <Tag tone="neutral">{COUNTRY_META[check.country].name}</Tag>
                      </div>
                    </div>
                    <ActionButton variant="secondary" onClick={() => void refreshCheck()} disabled={refreshing || !product.confirmed} icon={refreshRefreshing(refreshing)}>{refreshing ? "核查中…" : !product.confirmed ? "先重新确认商品" : "重新核查"}</ActionButton>
                  </div>

                  <div className="mt-5 space-y-4">
                    <div>
                      <Kicker>核查依据</Kicker>
                      <p className="mt-1.5 text-[10.5px] leading-[1.85] text-[#6B7B72]">{activeTask.basis}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-[8.5px] text-[#A2AEA6]">
                        <span>{activeTask.requirement ? `要求状态：${REQUIREMENT_STATUS[activeTask.requirement.status] ?? activeTask.requirement.status}` : "来自商品事实检查"}</span>
                        <span>·</span>
                        <span>{activeTask.verified ? "引文已验证" : "引文尚未验证"}</span>
                      </div>
                    </div>

                    <Rule />

                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <Kicker>官方来源</Kicker>
                        <span className="text-[8px] text-[#A2AEA6]">{activeTask.sources.length} 个绑定来源</span>
                      </div>
                      <div className="mt-1.5">
                        {activeTask.sources.length > 0 ? activeTask.sources.slice(0, 4).map((source) => (
                          <InlineSource key={`${source.url}-${source.title}`} title={source.title} url={source.url} domain={source.domain} note={source.status === "FETCHED" ? "已抓取，保留原文语言" : "抓取失败，保留待核实"} />
                        )) : (
                          <p className="rounded-lg border border-dashed border-[#E3D8C6] px-3 py-3 text-[9px] leading-relaxed text-[#A2AEA6]">该项没有绑定已抓取的官方引文。保持“需专业复核”，不能把模型推断当作法规依据。</p>
                        )}
                      </div>
                    </div>

                    <Rule />

                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Kicker>所需资料</Kicker>
                        <ul className="mt-1.5 space-y-1">
                          {check.documentation.length > 0 ? check.documentation.slice(0, 5).map((item) => (
                            <li key={item} className="flex gap-1.5 text-[9.5px] leading-relaxed text-[#6B7B72]"><FileText className="mt-0.5 h-2.5 w-2.5 shrink-0 text-[#B8862F]" />{item}</li>
                          )) : <li className="text-[9px] leading-relaxed text-[#A2AEA6]">该市场没有记录具体资料清单；请向供应商、报关行或目标市场监管机构确认，不用通用模板代替事实。</li>}
                        </ul>
                      </div>
                      <div>
                        <Kicker>下一步操作</Kicker>
                        <ul className="mt-1.5 space-y-1">
                          {activeTask.actions.length > 0 ? activeTask.actions.slice(0, 4).map((item) => (
                            <li key={item} className="flex gap-1.5 text-[9.5px] leading-relaxed text-[#6B7B72]"><ArrowRight className="mt-0.5 h-2.5 w-2.5 shrink-0 text-[#0E5C4E]" />{item}</li>
                          )) : <li className="text-[9px] leading-relaxed text-[#A2AEA6]">该项未记录具体操作；先核对官方原文的适用范围，再决定是否需要供应商动作。</li>}
                        </ul>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 border-t border-[#EFE6D8] pt-4">
                      <ActionButton onClick={onGoProduct} href={onGoProduct ? undefined : `/product/${product.id}`} icon={FileText}>补充商品事实</ActionButton>
                      <ActionButton
                        variant="secondary"
                        onClick={() => {
                          const source = activeTask.sources[0];
                          if (source) window.open(source.url, "_blank", "noopener,noreferrer");
                        }}
                        disabled={activeTask.sources.length === 0}
                        icon={BookOpen}
                      >
                        打开官方原文
                      </ActionButton>
                      <ActionButton variant="secondary" onClick={() => void refreshCheck()} disabled={refreshing || !product.confirmed} icon={RefreshCw}>{!product.confirmed ? "先重新确认商品" : "更新核查"}</ActionButton>
                    </div>
                  </div>
                </>
              ) : (
                <EmptySurface icon={ShieldCheck} title="这个筛选下没有任务" body="切换筛选或重新核查该市场。" />
              )}
            </section>
          </div>

          <div className="rounded-[20px] border border-[#EBE1D1] bg-[#FBF3E7] px-5 py-4">
            <p className="text-[9px] leading-[1.8] text-[#77857D]">
              官方原文标题、法规名称和 URL 保留原语言。预检只抓取公开页面，不替代报关行、实验室或目标市场监管机构的正式判断；{check.disclaimers[0] ?? "所有状态都需要在正式进口或销售前复核。"}
            </p>
            {check.hsCandidates.length > 0 ? (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {check.hsCandidates.map((candidate) => <Tag key={candidate.code} tone={candidate.verified ? "teal" : "gold"}>HS {candidate.code} · {candidate.verified ? "官方匹配" : "候选"}</Tag>)}
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

function refreshRefreshing(refreshing: boolean) {
  return refreshing ? Loader2 : RefreshCw;
}
