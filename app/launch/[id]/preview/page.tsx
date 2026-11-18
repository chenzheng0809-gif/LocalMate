import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowLeft, Globe2, ShieldCheck, TriangleAlert } from "lucide-react";
import { PreviewPrintButton } from "@/components/launch/PreviewPrintButton";
import { CountryMark, Kicker, Tag } from "@/components/agent/workbench";
import { getRepositories } from "@/lib/repositories";
import type { Country } from "@/types/domain";
import { COUNTRY_META, COUNTRY_ORDER } from "@/types/domain";
import { formatMoney } from "@/lib/utils/money";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ country?: string }> }): Promise<Metadata> {
  const { id } = await params;
  const { country } = await searchParams;
  const repos = getRepositories();
  const product = repos.products.getById(id);
  const meta = country && COUNTRY_ORDER.includes(country.toUpperCase() as Country) ? COUNTRY_META[country.toUpperCase() as Country] : null;
  return {
    title: product ? `${product.name} · ${meta?.name ?? "本地化"}买家预览` : "本地化买家预览",
    description: "目标市场语言的发布前验证素材，不是线上店铺或监管声明。",
  };
}

const CHECKLIST_LABEL: Record<string, string> = {
  DONE: "已完成",
  OPEN: "待完成",
  VERIFY: "待核实",
};

export default async function LaunchPreviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ country?: string }>;
}) {
  const { id } = await params;
  const { country } = await searchParams;
  const repos = getRepositories();
  const product = repos.products.getById(id);
  if (!product) notFound();
  const requested = COUNTRY_ORDER.includes((country ?? "").toUpperCase() as Country)
    ? ((country ?? "").toUpperCase() as Country)
    : null;
  const launch = requested ? repos.launch.get(id, requested) : repos.launch.getLatestByProduct(id);
  if (!launch) notFound();
  const meta = COUNTRY_META[launch.country];

  return (
    <div className="min-h-screen bg-[#F4EDE1] text-[#12312A]">
      <header className="no-print sticky top-0 z-30 border-b border-[#E6DCCB] bg-[#FFFBF4]/95 backdrop-blur">
        <div className="mx-auto flex min-h-14 max-w-[1180px] flex-wrap items-center justify-between gap-2 px-4 py-2 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#0E5C4E] text-[9px] font-semibold text-white">PP</span>
            <Link href={`/agent/${id}?view=launch&country=${launch.country}`} className="inline-flex items-center gap-1 text-[9px] text-[#6B7A72] hover:text-[#0E5C4E]"><ArrowLeft className="h-3 w-3" /> 返回 Market Switch</Link>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-[8.5px] text-[#A2AEA6] sm:block">验证素材 · 不是线上店铺</span>
            <PreviewPrintButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 sm:py-9 print:max-w-none print:p-0">
        <div className="no-print mb-4 flex flex-wrap items-center gap-2 font-mono text-[8px] uppercase tracking-[0.14em] text-[#A2AEA6]">
          <Globe2 className="h-3 w-3 text-[#0E5C4E]" /> 买家视角预览
          <span className="text-[#D2C6B4]">/</span>
          <span>{product.name}</span>
        </div>

        <article className="preview-sheet overflow-hidden rounded-[22px] border border-[#DED2BE] bg-[#FFFDF8] shadow-[0_24px_70px_rgba(54,53,42,0.07)]">
          <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
            <div className="flex flex-col justify-center border-b border-[#EBE0CF] px-6 py-9 sm:px-10 lg:border-b-0 lg:border-r">
              <div className="flex items-center gap-2">
                <CountryMark country={launch.country} />
                <Kicker>{meta.localName} · buyer-facing draft</Kicker>
                <Tag tone="gold">验证素材</Tag>
              </div>
              <h1 className="mt-5 text-[clamp(2rem,4vw,3.4rem)] font-medium leading-[1.04] tracking-[-0.05em] text-[#12312A]">{launch.headline}</h1>
              <p className="mt-3 max-w-[560px] text-[12px] leading-[1.9] text-[#65706a]">{launch.subheadline}</p>
              <div className="mt-6 flex flex-wrap items-end gap-4">
                <div>
                  <div className="font-mono text-[24px] text-[#0E5C4E]">{formatMoney(launch.price, launch.currency)}</div>
                  <div className="mt-1 max-w-[340px] text-[8.5px] leading-relaxed text-[#A2AEA6]">{launch.priceNote}</div>
                </div>
                <span className="rounded-full bg-[#0E5C4E] px-4 py-2.5 text-[10px] font-medium text-white">{launch.ctaLabel}</span>
              </div>
              <div className="mt-5 flex flex-wrap gap-1.5">
                {launch.targetAudience.slice(0, 3).map((audience) => <Tag key={audience} tone="neutral">{audience}</Tag>)}
              </div>
            </div>
            <div className="bg-[#FBF3E7] p-5 sm:p-7">
              {product.images[0] ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={product.images[0]} alt={product.name} referrerPolicy="no-referrer" className="aspect-square w-full rounded-xl border border-[#E6DCCB] object-cover" />
              ) : (
                <div className="flex aspect-square w-full flex-col items-center justify-center rounded-xl border border-dashed border-[#DED2BE] bg-[#FFFBF3] text-center">
                  <div className="text-[10px] text-[#8A988F]">未提供商品图</div>
                  <div className="mt-1 max-w-[220px] text-[8px] leading-relaxed text-[#B4BEB7]">预览不会用占位图伪装真实商品；正式测试前请补充来源图片。</div>
                </div>
              )}
              <div className="mt-3 flex items-center justify-between gap-2 text-[8.5px] text-[#8A988F]">
                <span>{meta.language} · {launch.currency}</span>
                <span>{launch.generatedBy === "AI" ? "AI 生成，已按语言校验" : "确定性模板"}</span>
              </div>
            </div>
          </div>

          <section className="border-t border-[#EBE0CF] px-6 py-7 sm:px-10">
            <p className="max-w-[820px] text-[11px] leading-[2] text-[#4f5f5a]">{launch.description}</p>
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {launch.features.map((feature) => (
                <div key={feature.title} className="border-t border-[#E2D6C3] pt-3">
                  <div className="text-[11px] font-medium text-[#1E413A]">{feature.title}</div>
                  <p className="mt-1.5 text-[9.5px] leading-[1.8] text-[#77857D]">{feature.description}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="grid gap-7 border-t border-[#EBE0CF] bg-[#FFFBF3] px-6 py-7 sm:px-10 lg:grid-cols-2">
            <div>
              <div className="flex items-center gap-2"><ShieldCheck className="h-3.5 w-3.5 text-[#0E5C4E]" /><Kicker>发布前清单</Kicker></div>
              <div className="mt-2 space-y-1.5">
                {launch.complianceChecklist.length === 0 ? <p className="text-[9px] text-[#A2AEA6]">没有记录清单项。</p> : launch.complianceChecklist.map((item) => (
                  <div key={`${item.item}-${item.sourceUrl ?? ""}`} className="flex items-start justify-between gap-3 border-t border-[#ECE3D5] py-2 first:border-t-0 first:pt-0">
                    <span className="text-[9px] leading-relaxed text-[#6B7B72]">{item.item}</span>
                    <Tag tone={item.status === "DONE" ? "teal" : "gold"}>{CHECKLIST_LABEL[item.status] ?? item.status}</Tag>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <Kicker>供应商需要确认</Kicker>
              <ul className="mt-2 space-y-1.5">
                {launch.supplierQuestions.slice(0, 6).map((question) => <li key={question} className="flex gap-1.5 text-[9px] leading-relaxed text-[#6B7B72]"><span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-[#B8862F]" />{question}</li>)}
                {launch.supplierQuestions.length === 0 ? <li className="text-[9px] text-[#A2AEA6]">没有记录供应商问题。</li> : null}
              </ul>
            </div>
          </section>

          <footer className="border-t border-[#EBE0CF] px-6 py-5 sm:px-10">
            {!product.confirmed ? <p className="mb-3 rounded-lg border border-[#EFDCB4] bg-[#FCF2DF] px-3 py-2 text-[8.5px] leading-relaxed text-[#8A6F3C]">当前商品简报未确认。此预览仅供内部检查，不应发给买家或用于投放；请先确认商品事实。</p> : null}
            <div className="flex items-start gap-2">
              <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#9C6E28]" />
              <p className="text-[8.5px] leading-[1.85] text-[#77857D]">
                这是发布前验证素材，不是线上店铺、正式商品页或监管声明。价格是情景假设；买家可见文案使用目标市场语言，合规状态仍需在正式发布前由持牌专业人士复核。
              </p>
            </div>
          </footer>
        </article>
      </main>
    </div>
  );
}
