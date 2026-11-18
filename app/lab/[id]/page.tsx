import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, FlaskConical, Workflow } from "lucide-react";
import { WhatIfLab } from "@/components/lab/WhatIfLab";
import { Chip, EmptyState, Panel, SectionHeading } from "@/components/ui/primitives";
import { getRepositories } from "@/lib/repositories";

export const dynamic = "force-dynamic";

export default async function LabPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const repos = getRepositories();
  const product = repos.products.getById(id);
  if (!product) notFound();
  const markets = repos.research.getByProduct(id);
  const latest = repos.simulations.getLatest(id);

  return (
    <div className="container-page py-8 lg:py-12">
      <div className="flex flex-wrap items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em] text-muted">
        <Link href="/" className="hover:text-soft">产品护照</Link>
        <span className="text-white/20">/</span>
        <Link href={`/product/${id}`} className="hover:text-soft">{product.name}</Link>
        <span className="text-white/20">/</span>
        <span className="text-cyan-300/80">假设实验室</span>
      </div>

      <div className="mt-5 flex flex-col gap-4 border-b border-white/[0.08] pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap gap-2"><Chip tone="cyan">假设实验室</Chip><Chip tone="gold">仅为情景</Chip></div>
          <h1 className="display-md mt-4 text-soft">修改输入，看看什么会崩。</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            实验室会用你的覆盖值重新运行定价和匹配模型。依赖失效是显式的：
            材质变化会让合规门过期；产品或价格变化会让发布文案失效。
          </p>
        </div>
        <div className="flex gap-2">
          {markets.length > 0 ? <Link href={`/discover/${id}`} className="btn-ghost !px-4 !py-2.5 text-[11px]">市场视图</Link> : null}
          <Link href={`/launch/${id}`} className="btn-gold !px-4 !py-2.5 text-[11px]">发布页 <ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>
      </div>

      {markets.length === 0 ? (
        <div className="mt-8">
          <EmptyState
            title="请先运行市场研究"
            description="实验室需要一个基准市场模型：可用于比较的定价情景和当前排名。"
            icon={<FlaskConical className="h-8 w-8" />}
            action={<Link href={`/product/${id}`} className="btn-primary">返回产品 <ArrowRight className="h-4 w-4" /></Link>}
          />
        </div>
      ) : (
        <>
          <div className="mt-7">
            <WhatIfLab product={product} markets={markets} initial={latest} />
          </div>

          <section className="mt-14">
            <SectionHeading eyebrow="为什么重要" title="假设变了，数字却悄悄不变，就是负债。" description="每个依赖产物都会基于新输入重算，或被明确标记失效。实验室不会假装过期的合规检查或发布页仍然有效。" />
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {[
                { title: "成本变化", body: "重算到岸成本、建议零售价（若来自基准）、利润、利润指标和加权市场排名。" },
                { title: "材质变化", body: "使合规门失效，情景后状态强制为 REVIEW_REQUIRED，并把现有发布文案标记为过时。" },
                { title: "目标价变化", body: "按用户价格重算费用和利润。该价格标记为情景，不是市场观察。" },
              ].map((item) => (
                <Panel key={item.title} flat className="p-5">
                  <Workflow className="h-4 w-4 text-cyan-300/70" />
                  <h3 className="mt-3 text-sm text-soft">{item.title}</h3>
                  <p className="mt-2 text-[11px] leading-relaxed text-muted">{item.body}</p>
                </Panel>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}
