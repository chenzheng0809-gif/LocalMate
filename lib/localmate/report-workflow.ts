import { OFFICIAL_SOURCES } from "@/lib/compliance/catalog";
import { getFetchClient } from "@/lib/search/fetch-client";
import type { ProductDNA } from "@/types/domain";
import { legacyCountry } from "./mission-model";
import { handoffChannel } from "./handoff-channels";
import { searchMercadoLibre } from "./openai-market-search";
import { isPortableFan, rankedMarketSamples, sampleDescription } from "./market-samples";
import { pilotPlaybooks } from "./report-playbook";
import { runGbPrecheck, supportsGbPrecheck } from "./compliance-kb";
import type { ReportMarket, ReportSection } from "./report-model";
import type { TaskResult, TeamTask } from "./team-model";

const profiles = {
  MX: { channel: "Mercado Libre México", language: "es-MX", search: "organizador de equipaje", travel: "Organizador de equipaje para viaje", storage: "Organizador para el hogar", travelCopy: "Separa la ropa y los accesorios para aprovechar mejor el espacio de la maleta.", storageCopy: "Mantén tus artículos de uso diario organizados y a la mano.", size: "Dimensiones" },
  DE: { channel: "Amazon.de", language: "de-DE", search: "Packwürfel Koffer Organizer", travel: "Koffer-Organizer für Reisen", storage: "Organizer für Zuhause", travelCopy: "Kleidung und Zubehör getrennt im Koffer verstauen.", storageCopy: "Kleine Alltagsgegenstände übersichtlich aufbewahren.", size: "Maße" },
  GB: { channel: "Amazon UK", language: "en-GB", search: "travel packing organisers", travel: "Travel packing organiser", storage: "Home storage organiser", travelCopy: "Keep clothing and small accessories organised in your suitcase.", storageCopy: "Keep everyday essentials tidy and easy to find.", size: "Dimensions" },
  BR: { channel: "Mercado Livre Brasil", language: "pt-BR", search: "organizador de mala para viagem", travel: "Organizador de mala para viagem", storage: "Organizador para casa", travelCopy: "Separe roupas e acessórios para organizar melhor a sua mala.", storageCopy: "Deixe seus itens do dia a dia organizados e fáceis de encontrar.", size: "Dimensões" },
  US: { channel: "Amazon US", language: "en-US", search: "travel packing organizers", travel: "Travel packing organizer", storage: "Home storage organizer", travelCopy: "Keep clothes and small accessories organized in your suitcase.", storageCopy: "Keep everyday items tidy and easy to find.", size: "Dimensions" },
  JP: { channel: "Amazon Japan", language: "ja-JP", search: "旅行用 衣類収納ポーチ", travel: "旅行用衣類収納ポーチ", storage: "小物収納オーガナイザー", travelCopy: "衣類や小物を分けて、スーツケースの中をすっきり整理できます。", storageCopy: "毎日使う小物をまとめて、見つけやすく整理できます。", size: "サイズ" },
} satisfies Record<ReportMarket, Record<string, string>>;

export function authorityLinks(market: ReportMarket) {
  const country = legacyCountry(market);
  if (country) {
    const official = OFFICIAL_SOURCES[country];
    return [official.find(item => item.topics.includes("TARIFF")), official.find(item => item.topics.includes("LABELING"))]
      .filter(item => !!item).map(({ title, url }) => ({ title, url }));
  }
  return market === "MX" ? [
    { title: "SNICE · 商业标签官方目录", url: "https://www.snice.gob.mx/cs/avi/snice/etiquetado.info.com.html" },
    { title: "SNICE · 墨西哥贸易官方入口", url: "https://www.snice.gob.mx/cs/avi/snice/home.html" },
  ] : [
    { title: "Receita Federal · 国际包裹进口手册", url: "https://www.gov.br/receitafederal/pt-br/assuntos/aduana-e-comercio-exterior/manuais/remessas-postal-e-expressa/manual-de-encomendas-internacionais" },
  ];
}

const storageTerms = {
  MX: { desk: "organizador de escritorio", box: "caja organizadora", shelf: "estante organizador" },
  DE: { desk: "Schreibtisch-Organizer", box: "Aufbewahrungsbox", shelf: "Aufbewahrungsregal" },
  GB: { desk: "Desk organiser", box: "Storage box", shelf: "Storage shelf" },
  BR: { desk: "organizador de mesa", box: "caixa organizadora", shelf: "prateleira organizadora" },
  US: { desk: "Desk organizer", box: "Storage box", shelf: "Storage shelf" },
  JP: { desk: "デスクオーガナイザー", box: "収納ボックス", shelf: "収納ラック" },
};

export async function executeReportRole(task: TeamTask, product: ProductDNA): Promise<TaskResult> {
  const input = task.report!;
  const portableFan = isPortableFan(input.name);
  const travel = /旅行|行李|衣物收纳袋|packing.cubes?|travel.organiz/i.test(input.name);
  const kind = product.category === "DESK_ORGANIZER" ? "desk" : product.category === "SHELF_RACK" ? "shelf" :
    product.category === "STORAGE_BOX" && /盒|箱|筐|篮|box|bin|basket/i.test(input.name) ? "box" : null;
  const sections: NonNullable<TaskResult["sections"]> = [];
  const evidence: NonNullable<TaskResult["evidence"]> = [];
  type RoleRow = Omit<ReportSection, "market"> & { sources?: NonNullable<TaskResult["evidence"]> };
  const rows = await Promise.all(task.markets.map(async (code): Promise<RoleRow> => {
    const market = code as ReportMarket;
    const profile = profiles[market];
    const playbook = pilotPlaybooks[market];
    const channel = handoffChannel(market, input.mexicoMarketplace);
    const mexicoPilot = channel.id === "mercado_libre";
    const fanPilot = portableFan && mexicoPilot;
    const localName = travel ? profile.travel : kind ? storageTerms[market][kind] :
      product.category === "DECOR_STORAGE" ? profile.storage : input.name;
    const keyword = travel ? profile.search : kind ? storageTerms[market][kind] : null;
    if (task.agent === "Scout") {
      const [page, search] = await Promise.all([
        getFetchClient().fetchPage(channel.guide, { signal: AbortSignal.timeout(4500), cache: true }).catch(() => null),
        mexicoPilot ? searchMercadoLibre(input.name) : undefined,
      ]);
      const readDate = page?.ok && page.text.length > 200 ? page.fetchedAt.slice(0, 10) : null;
      const samples = fanPilot ? rankedMarketSamples(input.name, market) : [];
      const samplePaths = new Set(samples.map(item => new URL(item.url).pathname));
      const citations = search?.citations.filter(item => !samplePaths.has(new URL(item.url).pathname)) ?? [];
      return {
        title: mexicoPilot ? "墨西哥竞品与渠道" : "入驻入口与联系渠道",
        lines: [
          `${channel.name} · ${channel.requirements}`,
          channel.contactNote,
          ...samples.map(item => `${item.title} · ${sampleDescription(item)}`),
          ...(search?.status === "searched" ? [citations.length
            ? "下方包含 GPT 联网找到的商品链接。请打开原页确认价格、库存及相似度。"
            : search.citations.length ? "GPT 联网找到的商品链接与已有快照重合。" : "GPT 联网未返回可核对的直接商品链接。"] : []),
          ...(search?.status === "unavailable" ? ["本次联网搜索未完成。可继续使用已有来源，或手动补一条商品链接。"] : []),
          ...(search?.status === "disabled" ? ["本次使用已导入的来源与官方入口。可补充当前商品链接。"] : []),
        ],
        sources: [
          { market, title: "站点申请", url: channel.apply },
          { market, title: "官方卖家注册要求", url: channel.guide, note: readDate ? `读取于 ${readDate}` : "官方指南 · 本次未读取正文" },
          { market, title: "官方客服", url: channel.contact },
          { market, title: "官方站点覆盖", url: channel.coverage },
          ...citations.map(item => ({
            ...item, market, origin: "OPENAI_WEB_SEARCH" as const,
            note: "GPT 联网检索 · 待打开原页核对",
          })),
          ...samples.map(item => ({
            market, title: item.title, url: item.url,
            note: sampleDescription(item),
          })),
        ],
      };
    }
    if (task.agent === "Margin") {
      return {
        title: "真实询价与买家报价",
        lines: [
          ...(mexicoPilot ? ["使用 MXN 测算单件贡献。录入实际售价、采购、运费、平台费、税费和获客成本，并标注汇率及费用来源。"] : []),
          "询价沿用确认过的单品包装。整箱出货时录入箱规、箱数和每箱毛重。",
          "收到回单后核对币种、费用范围、时效和有效期，再选用报价。",
        ],
      };
    }
    if (task.agent === "Guard") {
      const authorities = [...new Map([...authorityLinks(market), playbook.regulator].map(item => [item.url, item])).values()];
      const [sources, kb] = await Promise.all([Promise.all(authorities.map(async item => {
        const page = await getFetchClient().fetchPage(item.url, { signal: AbortSignal.timeout(4500), cache: true }).catch(() => null);
        return { ...item, market, note: page?.ok && page.text.length > 200 ? "本次已读取的官方入口" : "官方入口 · 本次未读到正文" };
      })), market === "GB" && supportsGbPrecheck(product) ? runGbPrecheck(product).catch(() => null) : Promise.resolve(null)]);
      const restricted = fanPilot || product.category === "OUT_OF_SCOPE" || product.attributes.electrical === true;
      return {
        title: restricted ? "先按专项类目确认准入" : "准入准备与上线条件",
        releaseHold: restricted,
        lines: [
          restricted ? "当前商品超出普通收纳品预检范围。请先把详细规格交给目标市场的报关或合规方做专项核查。" :
            `预备资料：供应商发票、SKU 规格、${travel ? "面料及辅料组成" : "材质清单"}、原产地和包装标签样稿。`,
          ...(fanPilot ? [
            "资料不足 · 向供应商索取电池类型、容量、额定电压和是否可拆卸的信息。请货代核对所选运输方式需要的文件。",
            "需专业复核 · 请依据实物规格、商品归类和进口途径，核对电气安全、标签及认证适用性。",
            "需专业复核 · 确认 Mercado Libre 实际类目、属性及销售限制，也要核对西语标签和说明书。",
          ] : [playbook.reviewQuestion]),
          "交付给报关或渠道负责人的核对表：进口主体、拟用商品编码、实际材质、标签带图样稿、进货发票、平台类目与限制。请对方注明结论依据和日期。",
          ...(kb ? [`英国知识库核查结果：${kb.answer}。具体规则见引用。`,
            ...[...new Set(kb.missing_evidence.map(item => item.description || item.evidence_id))].slice(0, 6).map(item => `准备文件：${item}`)] : []),
          "发布前把标签样稿与实际发货商品逐项对照。页面只保留已有证据支持的性能描述。",
        ], sources: [...sources, ...(kb?.citations.map(item => ({ market, title: item.title, url: item.url, note: item.locator ?? undefined })) ?? [])],
      };
    }
    if (fanPilot) {
      const rechargeable = /充电|recargable|rechargeable/i.test(input.name);
      return {
        title: "本土化上架草稿 · es-MX",
        lines: [
          `标题：Ventilador portátil${rechargeable ? " recargable" : ""}`,
          "首屏文案：Ventilador portátil. Consulta las dimensiones del producto para verificar si se ajusta al espacio disponible.",
          "电池、续航、风速和认证等信息，补充资料后再添加。",
        ],
      };
    }
    return {
      title: `本土化上架草稿 · ${profile.language}`,
      lines: [
        `标题：${localName}`,
        ...(travel || kind || product.category === "DECOR_STORAGE" ? [`首屏文案：${travel ? profile.travelCopy : profile.storageCopy}`] :
          ["原商品名已保留，标题和用途请交当地译审，先用下面的规格字段建草稿。"]),
        ...(keyword ? [`可试搜索词：${keyword}`] : []),
        `${profile.size}: ${input.dimensions}.`,
        `上传实物、尺寸标尺和完整包装三张图。数量、颜色、材质、配送时效按实际 SKU 逐项填入 ${channel.name}。`,
        "发给当地试用者的问题：尺寸是否一眼看懂，在哪里使用，最容易误会的规格是什么。收到反馈后先改标题和首图。",
        travel ? "图片顺序建议：行李箱内使用场景 → 尺寸标注 → 实际收到的件数与包装。件数只用实际发货配置。" :
          "图片顺序建议：使用场景 → 尺寸比例 → 实际发货件数与包装。",
      ],
    };
  }));
  rows.forEach((row, index) => {
    const { sources, ...section } = row;
    sections.push({ market: task.markets[index], ...section });
    evidence.push(...(sources ?? []));
  });
  return { summary: `已交付 ${sections.length} 个市场的报告章节。`, sections, evidence };
}
