import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getRepositories } from "@/lib/repositories";
import { AgentWorkspace } from "@/components/agent/AgentWorkspace";
import type { AgentView } from "@/types/agent";
import type { Country } from "@/types/domain";
import { COUNTRY_ORDER } from "@/types/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const product = getRepositories().products.getById(id);
  return {
    title: product ? `${product.name} · 出海工作台` : "智能体工作台 · Product Passport",
    description: "用自然语言研究海外市场、检查准入任务、模拟价格并准备本地化验证。",
  };
}

export default async function AgentPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ q?: string | string[]; view?: string | string[]; country?: string | string[] }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const repos = getRepositories();
  const product = repos.products.getById(id);
  if (!product) notFound();
  const markets = repos.research.getByProduct(id);
  const compliance = repos.compliance.getByProduct(id);
  const match = repos.matches.getLatest(id);
  const latestJob = repos.jobs.getLatestByProduct(id);
  const launch = repos.launch.getLatestByProduct(id);
  const initialPrompt = Array.isArray(query.q) ? query.q[0] : query.q;
  const rawView = Array.isArray(query.view) ? query.view[0] : query.view;
  const rawCountry = Array.isArray(query.country) ? query.country[0] : query.country;
  const allowedViews: AgentView[] = ["overview", "product", "markets", "compliance", "simulation", "launch", "passport"];
  const initialView = rawView && allowedViews.includes(rawView as AgentView) ? (rawView as AgentView) : undefined;
  const initialCountry = rawCountry && COUNTRY_ORDER.includes(rawCountry.toUpperCase() as Country) ? (rawCountry.toUpperCase() as Country) : undefined;

  return (
    <AgentWorkspace
      initialProduct={product}
      initialSummary={{
        marketCount: markets.length,
        complianceCount: compliance.length,
        hasMatch: Boolean(match),
        hasLaunch: Boolean(launch),
      }}
      initialJob={latestJob}
      initialPrompt={initialPrompt?.slice(0, 2000)}
      initialView={initialView}
      initialCountry={initialCountry}
    />
  );
}
