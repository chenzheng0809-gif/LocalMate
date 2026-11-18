import type { ReportMarket } from "./report-model";

export const pilotPlaybooks: Record<ReportMarket, {
  currency: string;
  feeUrl: string;
  channelAction: string;
  fulfilment: string;
  reviewQuestion: string;
  regulator: { title: string; url: string };
}> = {
  MX: {
    currency: "MXN",
    feeUrl: "https://vendedores.mercadolibre.com.mx/nota/como-usar-el-simulador-de-costos-de-mercado-libre",
    channelAction: "在 Mercado Libre México 建一条西语草稿，选择真实类目。用费用模拟器录入售价、发货重量和同一邮编，比较可用的刊登和配送选项对实收的影响。",
    fulfilment: "向货代索取到墨西哥的含税/不含税两种报价，并找清楚谁作为进口主体。单件直发与合包入仓分开计算。",
    reviewQuestion: "让当地进口方按材质、用途和归类核对西语标签及是否落入具体 NOM 的适用范围，提供审核后的标签样稿。",
    regulator: { title: "SNICE · 商业标签官方目录", url: "https://www.snice.gob.mx/cs/avi/snice/etiquetado.info.com.html" },
  },
  DE: {
    currency: "EUR",
    feeUrl: "https://sell.amazon.de/preisgestaltung",
    channelAction: "在 Amazon.de 用同一欧元售价比较自配送与 FBA 的实收。德语商品页先制作一版，售价给用户显示时注明是否含税和配送。",
    fulfilment: "分别取得发往德国单件直发与批量入仓的报价，请货代写明头程、清关、末端配送和退货处理。",
    reviewQuestion: "确认德国销售包装和寄件包装由谁承担义务，按 ZSVR 指引确认 LUCID 注册及系统参与是否适用，同时核对适用的欧盟商品安全与在线展示要求。",
    regulator: { title: "ZSVR · 德国网售与包装指引", url: "https://www.verpackungsregister.org/en/knowledge-bases/mail-order-companies-and-online-retailers" },
  },
  GB: {
    currency: "GBP",
    feeUrl: "https://sell.amazon.co.uk/pricing/estimate",
    channelAction: "先把试卖范围限定到大不列颠。以同一英镑售价输入 Amazon UK 费用计算器，保存自配送和 FBA 两组结果。",
    fulfilment: "让货代明确英国进口主体、含税交付方式和本地退货地址。北爱尔兰另外确认后再扩大配送范围。",
    reviewQuestion: "请英国进口方按材质和商品用途确认标签、追溯信息和有关安全资料。纺织品还要按实际产品核对纤维标签适用性。",
    regulator: { title: "GOV.UK · 生产商及进口商商品安全指引", url: "https://www.gov.uk/guidance/product-safety-law-compliance-advice-for-manufacturers-and-importers" },
  },
  BR: {
    currency: "BRL",
    feeUrl: "https://vendedores.mercadolivre.com.br/nota/como-usar-o-simulador-de-custos-do-mercado-livre",
    channelAction: "在 Mercado Livre Brasil 用葡语商品页和巴西雷亚尔售价做草稿。先确认卖家账号可用的刊登和运输方式，再用实际类目跑费用模拟器。",
    fulfilment: "请巴西进口方区分跨境包裹与商业备货两种方案，给出税费、配送时间和退货成本的书面报价。",
    reviewQuestion: "让当地进口方确认适用的进口路径、商品分类和葡语标签。包裹规则与商用备货口径分别核对。",
    regulator: { title: "Receita Federal · 国际包裹进口手册", url: "https://www.gov.br/receitafederal/pt-br/assuntos/aduana-e-comercio-exterior/manuais/remessas-postal-e-expressa/manual-de-encomendas-internacionais" },
  },
  US: {
    currency: "USD",
    feeUrl: "https://sell.amazon.com/pricing/estimate",
    channelAction: "在 Amazon US 用同类 ASIN 或实际包装规格跑收入计算器，分别记录自配送和 FBA 的费用、净回款及尺寸分档。先试一个 SKU。",
    fulfilment: "以实际外包装三边和毛重询价，核对计费重量、清关费用与退件处理，英寸标注保留一位小数即可。",
    reviewQuestion: "用真实材质和商品结构请报关方复核商品分类和原产地标识。箱包或布艺收纳件另核对适用范围及可能的标签豁免，记录依据。",
    regulator: { title: "FTC · 美国纺织品及羊毛标签适用范围", url: "https://www.ftc.gov/business-guidance/resources/threading-your-way-through-labeling-requirements-under-textile-wool-acts" },
  },
  JP: {
    currency: "JPY",
    feeUrl: "https://sell.amazon.co.jp/pricing",
    channelAction: "在 Amazon Japan 用日文类目建草稿，录入日元售价、包装三边、重量，使用当地 FBA 模拟器与自配送报价比对。",
    fulfilment: "请货代同时列出入日本仓和单件配送方案，单独问清退货地址、反向运费和商品标签处理。",
    reviewQuestion: "让日本进口方按实际品目核对《家庭用品品质表示法》的涵盖范围和日语表示项目，并确认负责主体。",
    regulator: { title: "日本消费者厅 · 家庭用品品质表示法适用范围", url: "https://www.caa.go.jp/policies/policy/representation/household_goods/outline/outline_04.html" },
  },
};
