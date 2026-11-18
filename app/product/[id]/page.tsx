import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  CircleAlert,
  Clock3,
  ExternalLink,
  FileJson,
  Fingerprint,
  ImageIcon,
  MapPin,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { ProductEditor } from "@/components/product/ProductEditor";
import { ResearchConsole } from "@/components/product/ResearchConsole";
import { Chip, DataOriginBadge, Disclaimer, KeyValue, Panel, SectionHeading, StatusPill } from "@/components/ui/primitives";
import { getRepositories } from "@/lib/repositories";
import { formatDate } from "@/lib/utils/date";
import { titleCase } from "@/lib/utils/format";

export const dynamic = "force-dynamic";

const EXTRACTION_LABEL: Record<string, string> = {
  COMPLETE: "完整",
  PARTIAL: "部分完整",
  NEEDS_REVIEW: "待复核",
};

const FIELD_LABEL: Record<string, string> = {
  "attributes.weight": "重量",
  "attributes.material": "材质",
  "attributes.dimensions": "尺寸",
  "attributes.packagingDimensions": "包装尺寸",
  "attributes.color": "颜色",
  "attributes.intendedUse": "使用场景",
  "sourcing.priceCNY": "供应商价格",
  "sourcing.MOQ": "起订量",
  "sourcing.supplier": "供应商",
};

const PROVENANCE_LABEL: Record<string, string> = {
  SOURCE_EXTRACTED: "来源页面提取",
  AI_INFERRED: "AI 推断",
  USER_CONFIRMED: "用户确认",
  UNKNOWN: "未知",
};

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repos = getRepositories();
  const product = repos.products.getById(id);
  if (!product) notFound();
  const job = repos.jobs.getLatestByProduct(id);
  const jobEvents = job ? repos.jobs.listEvents(job.id) : [];
  const markets = repos.research.getByProduct(id);
  const evidenceCount = repos.evidence.listByProduct(id, 200).length;
  const launch = repos.launch.getLatestByProduct(id);
  const passport = repos.passports.getLatest(id);
  const outOfScope = product.category === "OUT_OF_SCOPE" || product.attributes.electrical === true;
  const missing = product.missingFields;

  return (
    <div className="container-page py-8 lg:py-12">
      <div className="flex flex-wrap items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em] text-muted">
        <Link href="/" className="hover:text-soft">产品护照</Link>
        <span className="text-white/20">/</span>
        <span className="text-cyan-300/80">产品档案</span>
        <span className="text-white/20">/</span>
        <span className="text-muted/60">{product.id}</span>
      </div>

      <div className="mt-5 flex flex-col gap-5 border-b border-white/[0.08] pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Chip tone={outOfScope ? "red" : "cyan"}>{outOfScope ? "超出范围" : "范围内 · 家居收纳"}</Chip>
            <DataOriginBadge mode={product.mode} />
            <span className="font-mono text-[9px] uppercase tracking-[0.14em] text-muted">{product.sourcePlatform.replaceAll("_", " ")}</span>
            {product.confirmed ? <StatusPill status="CONFIRMED" /> : <StatusPill status="NEEDS REVIEW" />}
          </div>
          <h1 className="display-md mt-4 max-w-3xl text-soft">{product.name}</h1>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted">
            {product.description || "尚未提供描述。补充一段简短简报，研究智能体才有具体内容可验证。"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {markets.length > 0 ? <Link href={`/discover/${id}`} className="btn-primary !px-4 !py-2.5 text-[12px]">市场视图 <ArrowRight className="h-3.5 w-3.5" /></Link> : null}
          {markets.length > 0 ? <Link href={`/compliance/${id}`} className="btn-ghost !px-4 !py-2.5 text-[12px]"><ShieldCheck className="h-3.5 w-3.5" /> 合规预检</Link> : null}
          {launch ? <Link href={`/launch/${id}`} className="btn-ghost !px-4 !py-2.5 text-[12px]">发布页</Link> : null}
          {passport ? <Link href={`/passport/${id}`} className="btn-ghost !px-4 !py-2.5 text-[12px]"><FileJson className="h-3.5 w-3.5" /> 产品护照</Link> : null}
        </div>
      </div>

      {outOfScope ? (
        <div className="mt-6 flex items-start gap-4 rounded-2xl border border-rose-300/25 bg-rose-300/[0.05] p-5">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-rose-300" />
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-rose-100">OUT_OF_SCOPE</span>
              <StatusPill status="不参与市场排名" />
            </div>
            <p className="mt-2 max-w-3xl text-[12px] leading-relaxed text-muted">
              这个产品看起来包含电子元件，或不属于非电动家居收纳。第一版不会为此范围研究、排名或生成发布素材。
              如果这是误判，请修改品类或电子元件标记；否则不要用这份档案做市场决策。
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-8 grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-6">
          {product.images.length > 0 ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {product.images.slice(0, 4).map((image, index) => (
                <div key={`${image}-${index}`} className="group relative aspect-[4/3] overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.02]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={image} alt={`${product.name} ${index + 1}`} referrerPolicy="no-referrer" className="h-full w-full object-cover opacity-90 transition group-hover:scale-[1.03] group-hover:opacity-100" />
                  <span className="absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 font-mono text-[8px] text-white/60">图片 {index + 1}</span>
                </div>
              ))}
            </div>
          ) : (
            <Panel flat className="flex items-center gap-3 px-4 py-3.5">
              <ImageIcon className="h-4 w-4 text-muted" />
              <span className="text-[11px] text-muted">没有产品图片。简报只有文字，视觉相关主张仍未经核实。</span>
            </Panel>
          )}

          <ProductEditor product={product} />

          <ResearchConsole
            productId={product.id}
            confirmed={product.confirmed}
            initialJob={job}
            initialEvents={jobEvents}
            hasMarkets={markets.length > 0}
          />
        </div>

        <div className="space-y-4">
          <Panel className="p-5">
            <div className="flex items-center gap-2">
              <Fingerprint className="h-4 w-4 text-cyan-300" />
              <h2 className="text-sm text-soft">记录中的证据</h2>
            </div>
            <div className="mt-4">
              <KeyValue label="档案状态" value={product.confirmed ? "已确认" : "待确认"} />
              <KeyValue label="提取状态" value={EXTRACTION_LABEL[product.extractionStatus] ?? titleCase(product.extractionStatus)} />
              <KeyValue label="创建时间" value={formatDate(product.createdAt)} />
              <KeyValue label="确认时间" value={formatDate(product.confirmedAt)} />
              <KeyValue label="来源 URL" value={product.sourceUrl ? <a href={product.sourceUrl} target="_blank" rel="noreferrer" className="link-cyan inline-flex items-center gap-1">打开 <ExternalLink className="h-3 w-3" /></a> : "—"} />
              <KeyValue label="证据条目" value={String(evidenceCount)} />
            </div>
            {!product.confirmed ? (
              <div className="mt-4 rounded-xl border border-gold-400/20 bg-gold-400/[0.04] p-3.5">
                <div className="flex items-center gap-2 text-[11px] text-gold-200"><Clock3 className="h-3.5 w-3.5" /> 确认门槛</div>
                <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
                  请检查字段并点击 <span className="text-soft">确认简报</span>。在此之前，研究会被有意禁用。
                </p>
              </div>
            ) : (
              <div className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-300/15 bg-emerald-300/[0.04] p-3.5 text-[11px] text-emerald-200/90">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                简报已确认。AI 推断字段现在属于用户批准的基线。
              </div>
            )}
          </Panel>

          <Panel flat className="p-5">
            <div className="flex items-center justify-between">
              <div className="label-mono">来源账本</div>
              <span className="font-mono text-[9px] text-muted/50">{Object.keys(product.provenance).length} 个字段</span>
            </div>
            <div className="mt-3 space-y-2.5">
              {Object.entries(product.provenance).map(([field, value]) => (
                <div key={field} className="flex items-center justify-between gap-3">
                  <span className="truncate font-mono text-[10px] text-muted" title={field}>{FIELD_LABEL[field] ?? field}</span>
                  <span className="shrink-0 font-mono text-[8px] uppercase tracking-[0.12em] text-soft/70">{PROVENANCE_LABEL[value] ?? value}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 border-t border-white/[0.06] pt-3">
              <div className="label-mono">缺失字段</div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {missing.length === 0 ? <Chip tone="green">无</Chip> : missing.map((field) => <Chip key={field} tone="gold">{FIELD_LABEL[field] ?? field}</Chip>)}
              </div>
            </div>
          </Panel>

          <Panel flat className="p-5">
            <div className="label-mono">范围与下一步</div>
            <div className="mt-3 space-y-2 text-[11px] leading-relaxed text-muted">
              <p className="flex items-start gap-2"><Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-cyan-300" /> {markets.length > 0 ? "市场研究已完成。打开市场视图查看排名和证据。" : "确认后，智能体会并行研究四个市场。"}</p>
              <p className="flex items-start gap-2"><MapPin className="mt-0.5 h-3 w-3 shrink-0 text-cyan-300" /> 市场：美国 · 日本 · 德国 · 英国</p>
              <p className="flex items-start gap-2"><CircleAlert className="mt-0.5 h-3 w-3 shrink-0 text-gold-400" /> 合规预检不构成法律意见或官方认证。</p>
            </div>
          </Panel>

          <Disclaimer>
            字段来源不等于准确性保证。“来源页面提取”表示数值来自商品页；“AI 推断”表示模型补齐了空白，
            且用户尚未独立核验。研究前请确认简报。
          </Disclaimer>
        </div>
      </div>

      <section className="mt-14">
        <SectionHeading eyebrow="接下来会发生什么" title="一份产品简报，变成一份决策档案。" />
        <div className="mt-6 grid gap-px overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.08] md:grid-cols-4">
          {[
            { n: "01", title: "市场解读", body: "四个并行研究，附带实时来源 URL 和明确缺口。", href: markets.length ? `/discover/${id}` : undefined },
            { n: "02", title: "合规预检", body: "官方来源证据、引文校验和 HS 候选。", href: markets.length ? `/compliance/${id}` : undefined },
            { n: "03", title: "假设实验室", body: "修改成本或材料，查看哪些输出会失效。", href: markets.length ? `/lab/${id}` : undefined },
            { n: "04", title: "产品护照", body: "包含证据、未知项和下一步动作的版本化文件。", href: `/passport/${id}` },
          ].map((item) => (
            <div key={item.n} className="bg-[#050f19] p-5">
              <div className="font-mono text-[9px] tracking-[0.18em] text-cyan-300/50">{item.n}</div>
              <div className="mt-4 text-sm text-soft">{item.title}</div>
              <p className="mt-2 text-[11px] leading-relaxed text-muted">{item.body}</p>
              {item.href ? <Link href={item.href} className="link-cyan mt-3 inline-flex items-center gap-1 text-[10px]">打开 <ArrowRight className="h-3 w-3" /></Link> : <span className="mt-3 block font-mono text-[9px] uppercase tracking-[0.12em] text-muted/40">研究后可用</span>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
