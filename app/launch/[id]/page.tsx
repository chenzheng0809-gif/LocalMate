import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowRight, Languages, ShieldCheck, Sparkles } from "lucide-react";
import { LaunchEditor } from "@/components/launch/LaunchEditor";
import { Chip, DataOriginBadge, Disclaimer, Panel } from "@/components/ui/primitives";
import { getRepositories } from "@/lib/repositories";
import type { Country } from "@/types/domain";
import { COUNTRY_ORDER } from "@/types/domain";

export const dynamic = "force-dynamic";

export default async function LaunchPage({
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
  const markets = repos.research.getByProduct(id);
  const requested = COUNTRY_ORDER.includes((country ?? "").toUpperCase() as Country)
    ? ((country ?? "").toUpperCase() as Country)
    : null;
  const launch = requested ? repos.launch.get(id, requested) : repos.launch.getLatestByProduct(id);
  const available = markets.map((market) => market.country);
  const countries = available.length > 0 ? available : [...COUNTRY_ORDER];

  return (
    <div className="container-page py-8 lg:py-12">
      <div className="flex flex-wrap items-center gap-2 font-mono text-[9px] uppercase tracking-[0.18em] text-muted">
        <Link href="/" className="hover:text-soft">产品护照</Link>
        <span className="text-white/20">/</span>
        <Link href={`/product/${id}`} className="hover:text-soft">{product.name}</Link>
        <span className="text-white/20">/</span>
        <span className="text-cyan-300/80">发布页</span>
      </div>

      <div className="mt-5 flex flex-col gap-4 border-b border-white/[0.08] pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex flex-wrap gap-2"><Chip tone="cyan">本地化发布页</Chip><Chip tone="gold">验证素材</Chip>{launch ? <DataOriginBadge mode={launch.generatedBy} /> : null}</div>
          <h1 className="display-md mt-4 text-soft">用市场的语言说出来。</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
            一份发布前概念页，基于已确认简报、已观察定位和开放合规清单。
            它的用途是测试价值主张，不是作出受监管的声明。
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {markets.length > 0 ? <Link href={`/discover/${id}`} className="btn-ghost !px-4 !py-2.5 text-[11px]">市场视图</Link> : null}
          <Link href={`/compliance/${id}`} className="btn-ghost !px-4 !py-2.5 text-[11px]"><ShieldCheck className="h-3.5 w-3.5" /> 合规预检</Link>
          <Link href={`/passport/${id}`} className="btn-primary !px-4 !py-2.5 text-[11px]">打开产品护照 <ArrowRight className="h-3.5 w-3.5" /></Link>
        </div>
      </div>

      <div className="mt-7">
        <LaunchEditor productId={id} initial={launch} availableCountries={countries} />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Panel flat className="p-4">
          <Languages className="h-4 w-4 text-cyan-300/70" />
          <div className="mt-3 text-xs text-soft">语言跟随市场</div>
          <p className="mt-1.5 text-[10px] leading-relaxed text-muted">美国和英国用英语，德国用德语，日本用日语。价格保持当地货币。</p>
        </Panel>
        <Panel flat className="p-4">
          <Sparkles className="h-4 w-4 text-cyan-300/70" />
          <div className="mt-3 text-xs text-soft">不编造证明</div>
          <p className="mt-1.5 text-[10px] leading-relaxed text-muted">不编造评论、销量、认证、奖项或稀缺性。卖点以产品简报为依据。</p>
        </Panel>
        <Panel flat className="p-4">
          <ShieldCheck className="h-4 w-4 text-cyan-300/70" />
          <div className="mt-3 text-xs text-soft">合规始终可见</div>
          <p className="mt-1.5 text-[10px] leading-relaxed text-muted">开放和未验证项目会连同官方来源出现在清单中，不会藏在脚注里。</p>
        </Panel>
      </div>

      <Disclaimer className="mt-6">
        这是发布前验证页，不是上线店铺。价格是情景估算。在核实产品声明、认证或合规陈述之前，
        不要对外发布；如适用，还需由合格专业人士审查。
      </Disclaimer>
    </div>
  );
}
