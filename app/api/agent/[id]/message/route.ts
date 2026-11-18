import { enforceGuestLimit } from "@/lib/ai/guest";
import { z } from "zod";
import { getAIProvider } from "@/lib/ai/factory";
import { getRepositories } from "@/lib/repositories";
import { updateProduct } from "@/lib/product/service";
import { evidenceFromUserInput } from "@/lib/search/evidence-extractor";
import { enqueueResearchJob } from "@/lib/workflow/research";
import { runComplianceCheck } from "@/lib/compliance/service";
import { buildMatchAnalysis } from "@/lib/matching/engine";
import { runSimulation } from "@/lib/simulation/service";
import { generateLaunchPage } from "@/lib/launch/service";
import { createPassport } from "@/lib/passport/service";
import { mapLimit } from "@/lib/utils/async";
import { config } from "@/lib/config";
import { missingFieldLabel } from "@/lib/agent/labels";
import { AppError } from "@/lib/errors";
import { json, readJson, routeError } from "@/lib/api/respond";
import {
  classifyAgentIntent,
  detectCountry,
  detectCountries,
  parseSupplierPrice,
} from "@/lib/agent/intent";
import type { AgentReply, AgentSource } from "@/types/agent";
import type {
  ComplianceData,
  Country,
  MarketResearchData,
  ProductDNA,
} from "@/types/domain";
import { CATEGORY_LABELS, COUNTRY_META, COUNTRY_ORDER } from "@/types/domain";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const ContextSchema = z.object({
  view: z.enum(["overview", "product", "markets", "compliance", "simulation", "launch", "passport"]).optional(),
  country: z.enum(["US", "JP", "DE", "UK"]).nullable().optional(),
});

const MessageSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  context: ContextSchema.optional(),
});

const GATE_LABEL: Record<string, string> = {
  CLEAR: "可进入下一步",
  CAUTION: "谨慎",
  BLOCKED: "阻断",
  UNKNOWN: "未知",
};

const COMPLIANCE_LABEL: Record<string, string> = {
  PRECHECK_COMPLETE: "初步检查完成",
  ACTION_REQUIRED: "需完成事项",
  REVIEW_REQUIRED: "需专业复核",
  RESTRICTED: "已确认限制",
  OUT_OF_SCOPE: "超出范围",
};

const JOB_LABEL: Record<string, string> = {
  PENDING: "未开始",
  RUNNING: "执行中",
  COMPLETE: "已完成",
  COMPLETED: "已完成",
  PARTIAL: "部分完成",
  FAILED: "失败",
};

function sourcesForMarket(market: MarketResearchData | undefined): AgentSource[] {
  if (!market) return [];
  return market.competitors
    .filter((item) => item.url)
    .slice(0, 4)
    .map((item) => ({ title: item.name, url: item.url, note: "公开商品页观察" }));
}

function sourcesForCompliance(data: ComplianceData | null): AgentSource[] {
  if (!data) return [];
  return data.officialSources.slice(0, 5).map((source) => ({
    title: source.title,
    url: source.url,
    note: source.status === "FETCHED" ? "官方页面已抓取" : "官方页面抓取失败，保留待核实",
  }));
}

function rankLines(markets: MarketResearchData[], match: ReturnType<typeof buildMatchAnalysis> | null, compliance: ComplianceData[]) {
  if (!match) return [];
  return match.countries.slice(0, 4).map((row) => {
    const market = markets.find((item) => item.country === row.country);
    const check = compliance.find((item) => item.country === row.country);
    const price = market?.pricing.suggestedRetail;
    return `#${row.rank ?? "—"} ${COUNTRY_META[row.country].name} · ${row.weightedScore?.toFixed(1) ?? "数据不足"}/100 · ${GATE_LABEL[row.complianceGate] ?? row.complianceGate}${price !== null && price !== undefined ? ` · 情景零售价 ${COUNTRY_META[row.country].currency} ${price.toFixed(2)}` : ""}${check ? ` · ${COMPLIANCE_LABEL[check.status] ?? check.status}` : ""}`;
  });
}

function productCard(product: ProductDNA, lines: string[] = []) {
  return {
    title: product.name,
    subtitle: `${CATEGORY_LABELS[product.category]} · ${product.confirmed ? "简报已确认" : "待确认"}`,
    lines: [
      `材质：${product.attributes.material ?? "未提供"} · 尺寸：${product.attributes.dimensions ?? "未提供"}`,
      `包装：${product.attributes.packagingDimensions ?? "未提供"} · 重量：${product.attributes.weight !== null ? `${product.attributes.weight} kg` : "未提供"}`,
      `采购价：${product.sourcing.priceCNY !== null ? `¥${product.sourcing.priceCNY}` : "未提供"} · 起订量：${product.sourcing.MOQ ?? "未提供"} · 供应商：${product.sourcing.supplier ?? "未提供"}`,
      ...lines,
    ],
    chips: product.missingFields.length > 0 ? product.missingFields.slice(0, 4).map(missingFieldLabel) : ["字段完整"],
  };
}

async function ensureCompliance(
  repos: ReturnType<typeof getRepositories>,
  product: ProductDNA,
  countries: Country[],
): Promise<ComplianceData[]> {
  const ai = getAIProvider();
  return mapLimit(countries, config.maxAiConcurrency, async (country) => {
    const existing = repos.compliance.get(product.id, country);
    if (existing) return existing;
    const result = await runComplianceCheck({ product, country, ai, repos });
    repos.evidence.insertMany(result.evidence);
    return repos.compliance.upsert({ productId: product.id, country, data: result.data });
  });
}

export async function POST(request: Request, context: { params: Promise<unknown> }) {
  try {
    const params = (await context.params) as { id?: string };
    const id = params.id;
    if (!id) throw new AppError("产品 ID 缺失。", { status: 400 });
    const { message, context: inputContext } = MessageSchema.parse(await readJson(request));
    await enforceGuestLimit(request);
    const repos = getRepositories();
    const product = repos.products.getById(id);
    if (!product) throw new AppError("产品不存在。", { status: 404 });

    if (product.category === "OUT_OF_SCOPE" || product.attributes.electrical === true) {
      return json({
        reply: "这个产品超出第一版范围。第一版只覆盖非电动家居收纳产品；电动、食品、化妆品、医疗和儿童用品不会进入市场研究或合规预检。",
        view: "overview",
        card: {
          title: "超出研究范围",
          subtitle: "不会生成市场分或合规结论",
          lines: ["如果这是收纳用途的家居产品，请回到产品档案修正品类或移除电子属性后重新确认。", "我不会把超出范围的产品包装成可研究对象。"],
          chips: ["超出范围"],
        },
        nextActions: ["返回首页换一个产品"],
        product,
      } satisfies AgentReply);
    }

    const contextView = inputContext?.view;
    const contextCountry = inputContext?.country ?? null;
    let intent = classifyAgentIntent(message);
    if (intent === "OVERVIEW" && contextView) {
      if (contextView === "compliance" && /(解释|为什么|依据|来源|资料|补充|下一步|这项|这个)/.test(message)) intent = "COMPLIANCE";
      else if (contextView === "markets" && /(另一个|对比|并排|比较|市场|下一步)/.test(message)) intent = "MARKETS";
      else if (contextView === "simulation" && /(再低|再高|如果|下一步)/.test(message)) intent = "SIMULATE_PRICE";
      else if (contextView === "launch" && /(标题|文案|本地化|改|短|长|语气)/.test(message)) intent = "LAUNCH";
    }
    const country = detectCountry(message);
    const markets = repos.research.getByProduct(id);
    const compliance = repos.compliance.getByProduct(id);
    const latestJob = repos.jobs.getLatestByProduct(id);
    let reply: AgentReply;

    const progressQuestion = /(研究|任务).*(进度|状态|到哪|多久)|进度|到哪一步|还有多久|还在跑|完成了吗/.test(message);
    if (latestJob && ["PENDING", "RUNNING"].includes(latestJob.status) && progressQuestion) {
      const events = repos.jobs.listEvents(latestJob.id).slice(-3);
      return json({
        reply: `四国研究正在执行：${latestJob.currentStage ?? "进行中"}（${latestJob.progress}%）。计划依次经过商品信息提取、多国市场研究、合规证据检索、机会分析和上市方案生成；未完成的结果不会提前写入档案。`,
        view: contextView === "markets" ? "markets" : "overview",
        card: {
          title: "真实执行状态",
          subtitle: `${latestJob.status === "PENDING" ? "未开始" : "执行中"} · ${latestJob.progress}%`,
          lines: events.map((event) => event.message),
          chips: ["不会编造等待中的结果"],
        },
        nextActions: [],
        product,
        marketCount: markets.length,
      } satisfies AgentReply);
    }

    if (latestJob && !["PENDING", "RUNNING"].includes(latestJob.status) && progressQuestion) {
      const events = repos.jobs.listEvents(latestJob.id).slice(-3);
      const terminalMatch = repos.matches.getLatest(id) ?? (markets.length > 0 ? buildMatchAnalysis({ product, markets, compliance }) : null);
      const top = terminalMatch?.recommendedCountry ?? markets[0]?.country ?? null;
      return json({
        reply: `最近一次四国研究已结束（${JOB_LABEL[latestJob.status] ?? latestJob.status}）。已写入 ${markets.length}/4 个市场；${markets.length === 0 ? "没有形成可用市场数据，失败原因保留在任务记录里。" : "未完成的证据和合规开放项仍会保留，不会被补造成结论。"}`,
        view: "markets",
        card: {
          title: "最近一次研究",
          subtitle: `${JOB_LABEL[latestJob.status] ?? latestJob.status} · ${latestJob.progress}%`,
          lines: events.map((event) => event.message),
          chips: ["真实任务记录"],
        },
        nextActions: markets.length === 0 ? ["重新研究四国市场"] : [top ? `检查${COUNTRY_META[top].name}合规` : "解释当前市场判断"],
        product,
        marketCount: markets.length,
      } satisfies AgentReply);
    }

    if (intent === "CONFIRM") {
      if (product.confirmed) {
        reply = {
          reply: "这份产品简报已经确认。可以直接开始四国研究，或让我检查某个市场的合规要求。",
          view: "overview",
          card: productCard(product),
          nextActions: ["研究四国市场", "德国有哪些合规要求？", "采购价降到20元会怎样？"],
          product,
        };
      } else {
        const confirmed = updateProduct(repos, id, { confirm: true });
        repos.evidence.insertMany([
          evidenceFromUserInput({
            productId: id,
            claimSupported: "用户在智能体对话中明确确认产品简报后才开始研究。",
            excerpt: JSON.stringify({
              name: confirmed.name,
              category: confirmed.category,
              attributes: confirmed.attributes,
              sourcing: confirmed.sourcing,
              confirmedAt: confirmed.confirmedAt,
            }),
          }),
        ]);
        reply = {
          reply: "已按你的确认锁定产品简报。下一步建议先跑美国、日本、德国、英国四国研究；结果只代表验证优先级，不代表发布批准。",
          view: "overview",
          card: productCard(confirmed, ["确认记录已写入证据账本"]),
          nextActions: ["研究四国市场", "先检查德国合规", "生成日本市场商品页"],
          product: confirmed,
        };
      }
      return json(reply);
    }

    if (!product.confirmed) {
      return json({
        reply: "研究前需要你确认产品简报。请先检查属性、采购价和包装信息；确认后我才会调用市场研究或合规工具。",
        view: "overview",
        card: productCard(product, ["未确认前不会启动研究，也不会生成结论"]),
        nextActions: ["确认产品简报", "补充缺失字段"],
        confirmRequired: true,
        product,
      } satisfies AgentReply);
    }

    if (intent === "RESEARCH" || intent === "MARKETS") {
      const force = /重新|重跑|再研究|刷新/.test(message);
      if (markets.length > 0 && !force && intent === "MARKETS") {
        const match = repos.matches.getLatest(id) ?? repos.matches.save(id, buildMatchAnalysis({ product, markets, compliance }));
        const top = match.countries[0];
        return json({
          reply: top
            ? `四国研究已在证据账本里。当前验证优先级是${COUNTRY_META[top.country].name}（${top.weightedScore?.toFixed(1)}/100，合规门：${GATE_LABEL[top.complianceGate] ?? top.complianceGate}）。分数是验证排序，不是发布批准。`
            : "已有市场数据，但证据覆盖不足，暂时无法给出可靠排序。",
          view: "markets",
          card: {
            title: "四国验证优先级",
            subtitle: "商业分与合规门分开计算",
            lines: rankLines(markets, match, compliance),
            chips: ["观察样本有限", "合规门独立"],
          },
          sources: sourcesForMarket(markets.find((item) => item.country === top.country) ?? markets[0]),
          nextActions: ["查看德国合规要求", "模拟采购价降到20元", "创建产品护照"],
          match,
          product,
          marketCount: markets.length,
        } satisfies AgentReply);
      }

      if (markets.length > 0 && !force) {
        const match = repos.matches.getLatest(id) ?? repos.matches.save(id, buildMatchAnalysis({ product, markets, compliance }));
        return json({
          reply: "已有可用的四国研究结果。我没有重复消耗抓取和模型调用；你可以直接查看工作台，或要求我重新研究。",
          view: "markets",
          card: {
            title: "四国验证优先级",
            subtitle: "已有证据",
            lines: rankLines(markets, match, compliance),
            chips: ["已有结果"],
          },
          nextActions: ["重新研究四国市场", "德国有哪些合规要求？"],
          match,
          product,
          marketCount: markets.length,
        } satisfies AgentReply);
      }

      const job = enqueueResearchJob(
        { repos },
        { productId: id, countries: [...COUNTRY_ORDER], force },
      );
      return json({
        reply: "已启动四国市场研究：观察公开商品页、计算需求与竞争代理、抓取官方来源做合规预检。进度会实时显示在右侧 Copilot；缺失证据会保持为空。",
        view: "markets",
        card: {
          title: "四国研究已启动",
          subtitle: "美国 · 日本 · 德国 · 英国",
          lines: ["市场发现 → 商品观察 → 定价情景 → 合规预检 → 加权排序", "预计需要几分钟；不会编造等待中的结果"],
          chips: ["真实任务", `任务 ${job.id.slice(-6)}`],
        },
        nextActions: ["查看执行进度", "研究完成后检查德国合规"],
        progressJobId: job.id,
        product,
      } satisfies AgentReply);
    }

    if (intent === "COMPLIANCE") {
      const askedCountries = detectCountries(message);
      if (askedCountries.length > 1) {
        const updated = await ensureCompliance(repos, product, askedCountries);
        const first = updated[0];
        return json({
          reply: `已对${askedCountries.map((item) => COUNTRY_META[item].name).join("、")}分别做合规预检。每个市场都要单独看“已确认限制 / 需完成事项 / 需专业复核 / 初步检查完成”，不会用一句话给出最终合格结论。`,
          view: "compliance",
          country: first.country,
          card: {
            title: "多国合规预检",
            subtitle: "每个市场独立判断",
            lines: updated.map((check) => `${COUNTRY_META[check.country].name} · ${COMPLIANCE_LABEL[check.status] ?? check.status} · ${check.statusReason.slice(0, 110)}`),
            chips: ["不构成官方认证"],
          },
          sources: updated.flatMap((check) => sourcesForCompliance(check)).slice(0, 6),
          nextActions: ["查看德国合规要求", "模拟采购价变化", "生成日本发布页"],
          compliance: first,
          product,
          marketCount: markets.length,
        } satisfies AgentReply);
      }
      const requested = country ?? contextCountry ?? (compliance.length === 0 ? "DE" : null);
      if (requested) {
        const updated = await ensureCompliance(repos, product, [requested]);
        const check = updated[0];
        return json({
          reply: `${COUNTRY_META[requested].name}的合规预检是“${COMPLIANCE_LABEL[check.status] ?? check.status}”。这不是“合规认证”：${check.statusReason}`,
          view: "compliance",
          country: requested,
          card: {
            title: `${COUNTRY_META[requested].name}合规预检`,
            subtitle: "官方来源与开放项分开显示",
            lines: [
              `状态：${COMPLIANCE_LABEL[check.status] ?? check.status}`,
              ...check.requirements.slice(0, 4).map((item) => `${item.verified ? "引文已验证" : "待核实"} · ${item.title}`),
              ...check.hsCandidates.slice(0, 1).map((item) => `HS 候选 ${item.code}｜${item.description}`),
            ],
            chips: [`${check.officialSources.filter((item) => item.status === "FETCHED").length}/${check.officialSources.length} 官方页已抓取`],
          },
          sources: sourcesForCompliance(check),
          nextActions: ["查看其他市场合规", "模拟采购价变化", "生成发布页"],
          compliance: check,
          product,
          marketCount: markets.length,
        } satisfies AgentReply);
      }
      return json({
        reply: compliance.length > 0
          ? "四个市场的合规预检都在工作台里。每个市场都要单独看：限制、待办、待核查和初步检查完成是不同状态。"
          : "还没有合规预检结果。告诉我具体市场（例如“德国”），我会抓取该市场的官方来源。",
        view: "compliance",
        card: {
          title: "合规预检",
          subtitle: "不构成法律意见或官方认证",
          lines: compliance.map((item) => `${COUNTRY_META[item.country].name} · ${COMPLIANCE_LABEL[item.status] ?? item.status} · ${item.statusReason.slice(0, 90)}`),
          chips: compliance.length > 0 ? [`${compliance.length} 个市场`] : ["等待选择市场"],
        },
        nextActions: ["德国有哪些合规要求？", "美国有哪些合规要求？", "英国有哪些合规要求？"],
        product,
        marketCount: markets.length,
      } satisfies AgentReply);
    }

    if (intent === "SIMULATE_PRICE") {
      const nextPrice = parseSupplierPrice(message);
      if (nextPrice === null) {
        return json({
          reply: "请给我一个明确的采购价，例如“采购价降到20元会怎样？”。我会把它作为假设情景重算，不会覆盖商品事实。",
          view: "simulation",
          nextActions: ["采购价降到20元会怎样？", "采购价降到35元会怎样？"],
          product,
        } satisfies AgentReply);
      }
      if (markets.length === 0) {
        return json({
          reply: "价格模拟需要先有市场基准和定价情景。请先让我研究四国市场。",
          view: "markets",
          nextActions: ["研究四国市场"],
          product,
        } satisfies AgentReply);
      }
      const simulation = await runSimulation({
        repos,
        productId: id,
        overrides: { supplierCostCNY: nextPrice },
        label: `聊天情景：采购价 ¥${nextPrice}`,
      });
      const after = simulation.after.match;
      const best = after?.countries[0];
      return json({
        reply: `已按采购价 ¥${nextPrice} 作为假设情景重算。${best ? `重算后优先级仍是${COUNTRY_META[best.country].name}（${best.weightedScore?.toFixed(1)}/100）。` : "证据覆盖不足，重算后仍无法给出排序。"} 商品事实没有被覆盖；这是可回滚的情景。`,
        view: "simulation",
        card: {
          title: "采购价情景",
          subtitle: `事实成本 ${product.sourcing.priceCNY !== null ? `¥${product.sourcing.priceCNY}` : "未提供"} → 情景成本 ¥${nextPrice}`,
          lines: [
            ...simulation.impacts.filter((item) => item.changed).map((item) => `${{ PRODUCT_DNA: "产品事实", PRICING: "定价情景", MARKET_MATCH: "市场匹配", COMPLIANCE: "合规", LAUNCH_PAGE: "发布页" }[item.module] ?? item.module} · ${item.detail}`),
            ...(after?.countries ?? []).slice(0, 4).map((row) => `${COUNTRY_META[row.country].name} · ${row.weightedScore?.toFixed(1) ?? "数据不足"}/100 · 合规门 ${GATE_LABEL[row.complianceGate] ?? row.complianceGate}`),
          ],
          chips: ["仅为情景", "不覆盖商品事实"],
        },
        nextActions: ["查看价格模拟", "生成日本发布页"],
        simulation,
        product,
        marketCount: markets.length,
      } satisfies AgentReply);
    }

    if (intent === "LAUNCH" && /(改|修改|短|长|标题|文案|本地化|语气)/.test(message) && !/(生成|新建|重做|另一个)/.test(message)) {
      const target = country ?? contextCountry ?? (["JP", "US", "DE", "UK"] as Country[]).find((item) => markets.some((market) => market.country === item)) ?? "JP";
      const existing = repos.launch.get(id, target);
      return json({
        reply: existing
          ? "这次不重新生成页面，避免覆盖你已有的文案。请在右侧工作台的 Market Switch 里直接编辑标题、副标题和描述；保存会调用现有 PATCH 接口。"
          : `还没有${COUNTRY_META[target].name}版本。请先在 Market Switch 选择该市场并生成，再做本地化修改。`,
        view: "launch",
        country: target,
        card: existing ? {
          title: existing.headline,
          subtitle: `${COUNTRY_META[target].name} · ${COUNTRY_META[target].language} · 已有版本`,
          lines: ["直接编辑不会修改产品事实、市场证据或合规状态。"],
          chips: ["编辑现有版本", "不重新生成"],
        } : null,
        nextActions: [],
        launch: existing ?? null,
        product,
      } satisfies AgentReply);
    }

    if (intent === "LAUNCH") {
      const target = country ?? contextCountry ?? (["JP", "US", "DE", "UK"] as Country[]).find((item) => markets.some((market) => market.country === item)) ?? "JP";
      const launch = await generateLaunchPage({
        product,
        country: target,
        market: repos.research.get(id, target),
        compliance: repos.compliance.get(id, target),
        tone: "MINIMAL",
        ai: getAIProvider(),
        repos,
      });
      return json({
        reply: `已生成${COUNTRY_META[target].name}市场的发布前验证页（${COUNTRY_META[target].language}）。买家可见文案保留目标市场语言；合规清单和供应商问题保持中文，并明确标注“验证素材”。`,
        view: "launch",
        country: target,
        card: {
          title: launch.headline,
          subtitle: `${COUNTRY_META[target].name} · ${COUNTRY_META[target].language} · ${launch.generatedBy === "AI" ? "AI 生成" : "确定性模板"}`,
          lines: [launch.subheadline, launch.description.slice(0, 180), `价格：${launch.priceNote}`],
          chips: ["发布前验证素材", "不作受监管声明"],
        },
        nextActions: ["查看完整发布页", "调整发布文案", "创建产品护照"],
        launch,
        product,
      } satisfies AgentReply);
    }

    if (intent === "PASSPORT") {
      if (markets.length === 0) {
        return json({
          reply: "产品护照需要至少一个市场的真实研究快照。请先运行四国研究。",
          view: "markets",
          nextActions: ["研究四国市场"],
          product,
        } satisfies AgentReply);
      }
      const latestPassport = repos.passports.getLatest(id);
      const wantsNewVersion = /(新版本|更新|重新生成|重新保存|再保存)/.test(message);
      const passport = latestPassport && !wantsNewVersion ? latestPassport.snapshot : createPassport({ repos, productId: id });
      return json({
        reply: `已准备产品护照 v${passport.version}：这是带日期的决策快照，不是证书。可以导出 JSON、打印，或继续生成新版本。`,
        view: "passport",
        card: {
          title: `产品护照 v${passport.version}`,
          subtitle: `${passport.markets.length} 个市场 · ${passport.compliance.length} 个合规市场 · ${passport.evidence.length} 条证据`,
          lines: passport.nextActions.slice(0, 4),
          chips: [passport.dataMode === "DEMO" ? "演示数据" : "真实研究快照", "版本化"],
        },
        nextActions: ["导出 JSON", "创建新版本", "打印 / PDF"],
        passport,
        product,
      } satisfies AgentReply);
    }

    const match = markets.length > 0 ? repos.matches.getLatest(id) ?? repos.matches.save(id, buildMatchAnalysis({ product, markets, compliance })) : null;
    return json({
      reply: product.confirmed
        ? "产品简报已确认。你可以让我比较四国市场、检查某个市场的合规要求、做价格情景，或生成目标市场发布页。"
        : "先确认识别出的产品简报，再开始研究。所有结论都会回到证据账本和真实工具结果。",
      view: "overview",
      card: productCard(product, match ? rankLines(markets, match, compliance).slice(0, 1) : []),
      nextActions: ["研究四国市场", "德国有哪些合规要求？", "采购价降到20元会怎样？", "生成日本市场商品页"],
      product,
      match,
      marketCount: markets.length,
      complianceCount: compliance.length,
    } satisfies AgentReply);
  } catch (error) {
    return routeError(error);
  }
}
