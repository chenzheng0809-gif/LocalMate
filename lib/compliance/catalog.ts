import type {
  ComplianceTopic,
  Country,
  EvidenceType,
  ProductDNA,
} from "@/types/domain";

export interface OfficialSourceDefinition {
  id: string;
  country: Country;
  title: string;
  url: string;
  domain: string;
  topics: ComplianceTopic[];
  keywords: string[];
  evidenceType: EvidenceType;
  note: string;
}

export const OFFICIAL_SOURCES: Record<Country, OfficialSourceDefinition[]> = {
  US: [
    {
      id: "us_cbp",
      country: "US",
      title: "CBP — Internet Purchases",
      url: "https://www.cbp.gov/trade/basic-import-export/internet-purchases",
      domain: "cbp.gov",
      topics: ["IMPORT_RESTRICTIONS", "DOCUMENTATION", "TARIFF"],
      keywords: ["importer", "entry", "duty", "customs", "shipment"],
      evidenceType: "OFFICIAL_GUIDANCE",
      note: "Official CBP guidance on importing goods purchased online.",
    },
    {
      id: "us_cpsc",
      country: "US",
      title: "CPSC — Business & Manufacturing",
      url: "https://www.cpsc.gov/Business--Manufacturing",
      domain: "cpsc.gov",
      topics: ["PRODUCT_SAFETY", "MARKET_SURVEILLANCE"],
      keywords: ["consumer product", "safety", "hazard", "regulation", "manufacturer"],
      evidenceType: "OFFICIAL_REGULATION",
      note: "Official CPSC business gateway.",
    },
    {
      id: "us_origin",
      country: "US",
      title: "eCFR — 19 CFR Part 134, Country of Origin Marking",
      url: "https://www.ecfr.gov/current/title-19/chapter-I/part-134",
      domain: "ecfr.gov",
      topics: ["LABELING"],
      keywords: ["country of origin", "marking", "conspicuous", "article"],
      evidenceType: "OFFICIAL_REGULATION",
      note: "Official eCFR page for US country-of-origin marking rules.",
    },
    {
      id: "us_tariff",
      country: "US",
      title: "USITC — Harmonized Tariff Schedule",
      url: "https://hts.usitc.gov/",
      domain: "hts.usitc.gov",
      topics: ["TARIFF", "HS_CLASSIFICATION"],
      keywords: ["harmonized tariff", "HTS", "classification", "duty"],
      evidenceType: "OFFICIAL_REGULATION",
      note: "Official USITC HTS search. A candidate code is not a binding classification.",
    },
    {
      id: "us_lacey",
      country: "US",
      title: "APHIS — Lacey Act Declaration Requirements",
      url: "https://www.aphis.usda.gov/plant-imports/file-lacey-act-declaration/requirements",
      domain: "aphis.usda.gov",
      topics: ["SUSTAINABILITY", "DOCUMENTATION"],
      keywords: ["Lacey", "declaration", "plant", "wood", "import"],
      evidenceType: "OFFICIAL_REGULATION",
      note: "Official APHIS Lacey Act declaration page (may block automated fetching).",
    },
  ],
  JP: [
    {
      id: "jp_customs",
      country: "JP",
      title: "Japan Customs — Tariff Schedule",
      url: "https://www.customs.go.jp/english/tariff/2026_10_31/index.htm",
      domain: "customs.go.jp",
      topics: ["TARIFF", "HS_CLASSIFICATION", "IMPORT_RESTRICTIONS"],
      keywords: ["tariff", "customs", "import", "duty"],
      evidenceType: "OFFICIAL_TARIFF",
      note: "Official Japan Customs tariff schedule landing page.",
    },
    {
      id: "jp_meti",
      country: "JP",
      title: "METI — Product Safety",
      url: "https://www.meti.go.jp/english/policy/economy/consumer/index.html",
      domain: "meti.go.jp",
      topics: ["PRODUCT_SAFETY", "MARKET_SURVEILLANCE"],
      keywords: ["product safety", "consumer", "accident", "safety"],
      evidenceType: "OFFICIAL_GUIDANCE",
      note: "Official METI product-safety policy page.",
    },
    {
      id: "jp_caa",
      country: "JP",
      title: "Consumer Affairs Agency — Consumer Policy",
      url: "https://www.caa.go.jp/en/policy/consumer_policy/",
      domain: "caa.go.jp",
      topics: ["LABELING", "PRODUCT_SAFETY"],
      keywords: ["consumer", "labeling", "safety", "policy"],
      evidenceType: "OFFICIAL_GUIDANCE",
      note: "Official Consumer Affairs Agency policy page.",
    },
    {
      id: "jp_jetro",
      country: "JP",
      title: "JETRO — Customs examination and cargo inspection Q&A",
      url: "https://www.jetro.go.jp/world/qa/04A-020107.html",
      domain: "jetro.go.jp",
      topics: ["DOCUMENTATION", "IMPORT_RESTRICTIONS"],
      keywords: ["通関", "書類", "輸入", "税関"],
      evidenceType: "OFFICIAL_GUIDANCE",
      note: "Official JETRO Q&A on Japanese import customs procedures (Japanese).",
    },
  ],
  DE: [
    {
      id: "eu_gpsr",
      country: "DE",
      title: "European Commission — General Product Safety Regulation",
      url: "https://commission.europa.eu/business-economy-euro/product-safety-and-requirements/product-safety/general-product-safety-regulation_en",
      domain: "commission.europa.eu",
      topics: ["PRODUCT_SAFETY", "LABELING", "MARKET_SURVEILLANCE"],
      keywords: ["responsible person", "safety", "traceability", "manufacturer", "product"],
      evidenceType: "OFFICIAL_REGULATION",
      note: "Official European Commission GPSR page.",
    },
    {
      id: "eu_eudr",
      country: "DE",
      title: "European Commission — EU Deforestation Regulation",
      url: "https://environment.ec.europa.eu/topics/forests/deforestation/regulation-deforestation-free-products_en",
      domain: "environment.ec.europa.eu",
      topics: ["SUSTAINABILITY", "DOCUMENTATION"],
      keywords: ["deforestation", "due diligence", "wood", "operator", "products"],
      evidenceType: "OFFICIAL_REGULATION",
      note: "Official European Commission EUDR page.",
    },
    {
      id: "de_zoll",
      country: "DE",
      title: "German Customs (Zoll) — Customs online",
      url: "https://www.zoll.de/EN/Home/home_node.html",
      domain: "zoll.de",
      topics: ["TARIFF", "IMPORT_RESTRICTIONS"],
      keywords: ["customs", "import", "duty", "goods"],
      evidenceType: "OFFICIAL_GUIDANCE",
      note: "Official German customs portal.",
    },
    {
      id: "de_verpackg",
      country: "DE",
      title: "Zentrale Stelle Verpackungsregister — LUCID",
      url: "https://www.verpackungsregister.org/en/",
      domain: "verpackungsregister.org",
      topics: ["PACKAGING"],
      keywords: ["packaging", "register", "LUCID", "producer"],
      evidenceType: "OFFICIAL_REGULATION",
      note: "Official German packaging register (site may block automated fetching).",
    },
    {
      id: "eu_taric",
      country: "DE",
      title: "European Commission — TARIC measure information",
      url: "https://ec.europa.eu/taxation_customs/dds2/taric/measures.jsp?Lang=en&SimDate=20261113&Area=DE&MeasType=&StartPub=&EndPub=&QuaCode=1&QuaDesc=&Taric=3924900000",
      domain: "ec.europa.eu",
      topics: ["TARIFF", "HS_CLASSIFICATION"],
      keywords: ["goods nomenclature", "measure", "duty", "TARIC"],
      evidenceType: "OFFICIAL_TARIFF",
      note: "Official EU TARIC database page for the candidate code.",
    },
  ],
  UK: [
    {
      id: "uk_import",
      country: "UK",
      title: "GOV.UK — Import goods into the UK: step by step",
      url: "https://www.gov.uk/import-goods-into-uk",
      domain: "gov.uk",
      topics: ["IMPORT_RESTRICTIONS", "DOCUMENTATION", "TARIFF"],
      keywords: ["import", "customs", "duty", "declaration", "goods"],
      evidenceType: "OFFICIAL_GUIDANCE",
      note: "Official UK import process guidance.",
    },
    {
      id: "uk_gpsr",
      country: "UK",
      title: "GOV.UK — General Product Safety Regulations 2005: Great Britain",
      url: "https://www.gov.uk/government/publications/general-product-safety-regulations-2005/general-product-safety-regulations-2005-great-britain",
      domain: "gov.uk",
      topics: ["PRODUCT_SAFETY", "LABELING"],
      keywords: ["safety", "producer", "supplier", "marking", "product"],
      evidenceType: "OFFICIAL_REGULATION",
      note: "Official publication of the GB General Product Safety Regulations 2005.",
    },
    {
      id: "uk_tariff",
      country: "UK",
      title: "UK Trade Tariff",
      url: "https://www.trade-tariff.service.gov.uk/",
      domain: "trade-tariff.service.gov.uk",
      topics: ["TARIFF", "HS_CLASSIFICATION"],
      keywords: ["commodity code", "duty", "VAT", "import"],
      evidenceType: "OFFICIAL_TARIFF",
      note: "Official UK Trade Tariff service.",
    },
    {
      id: "uk_timber",
      country: "UK",
      title: "GOV.UK — Guide to the UK Timber Regulations 2013",
      url: "https://assets.publishing.service.gov.uk/media/67acbcac88ce626360cd21b8/Guide-to-uk-timber-regulations-2013-2.pdf",
      domain: "assets.publishing.service.gov.uk",
      topics: ["SUSTAINABILITY", "DOCUMENTATION"],
      keywords: ["timber", "due diligence", "regulation", "operator"],
      evidenceType: "OFFICIAL_REGULATION",
      note: "Official UK timber regulation guidance PDF (not parsed as text by this app).",
    },
    {
      id: "uk_epr",
      country: "UK",
      title: "GOV.UK — Extended producer responsibility for packaging",
      url: "https://www.gov.uk/guidance/extended-producer-responsibility-for-packaging",
      domain: "gov.uk",
      topics: ["PACKAGING"],
      keywords: ["packaging", "producer", "obligation", "responsibility"],
      evidenceType: "OFFICIAL_GUIDANCE",
      note: "Official UK packaging producer-responsibility guidance.",
    },
  ],
};

export interface ComplianceRule {
  id: string;
  country: Country;
  topic: ComplianceTopic;
  title: string;
  requirement: string;
  appliesTo: "IMPORT" | "MARKET" | "BOTH" | "UNCERTAIN";
  sourceIds: string[];
  actionItems: string[];
  blocking: boolean;
  severity: "HIGH" | "MEDIUM" | "LOW";
  condition: (product: ProductDNA) => boolean;
  conditionNote?: string;
}

function isWood(product: ProductDNA): boolean {
  const material = `${product.attributes.material ?? ""}`.toLowerCase();
  return /wood|walnut|oak|bamboo|木|竹|holz/.test(material);
}

export const COMPLIANCE_RULES: Record<Country, ComplianceRule[]> = {
  US: [
    {
      id: "us_entry",
      country: "US",
      topic: "IMPORT_RESTRICTIONS",
      title: "商业报关",
      requirement:
        "以商业销售为目的进口的货物通常需要报关，并指定进口记录人。必须向 CBP 提供归类、价值和原产地文件。本次预检不会代为报关。",
      appliesTo: "IMPORT",
      sourceIds: ["us_cbp"],
      actionItems: [
        "指定进口记录人和持牌报关行。",
        "准备商业发票、装箱单和报关所需归类数据。",
      ],
      blocking: true,
      severity: "HIGH",
      condition: () => true,
    },
    {
      id: "us_origin",
      country: "US",
      topic: "LABELING",
      title: "原产国标记",
      requirement:
        "进口商品可能需要醒目、清晰且永久的原产国标记。具体标记方式取决于商品和 CBP 规则；印刷包装前请先确认。",
      appliesTo: "BOTH",
      sourceIds: ["us_origin", "us_cbp"],
      actionItems: [
        "在产品或零售包装上添加正确原产国。",
        "保留供应商原产地证据，并与报关行复核标记。",
      ],
      blocking: true,
      severity: "HIGH",
      condition: () => true,
    },
    {
      id: "us_safety",
      country: "US",
      topic: "PRODUCT_SAFETY",
      title: "消费品安全复核",
      requirement:
        "消费品可能受 CPSC 法规和标准约束。适用规则取决于产品设计、目标用户和使用方式。通用预检无法认证合规。",
      appliesTo: "MARKET",
      sourceIds: ["us_cpsc"],
      actionItems: [
        "核查是否适用强制性 CPSC 标准、禁令或报告义务。",
        "保存产品安全档案和供应商测试报告。",
      ],
      blocking: false,
      severity: "MEDIUM",
      condition: () => true,
    },
    {
      id: "us_tariff",
      country: "US",
      topic: "TARIFF",
      title: "HTSUS 归类与关税",
      requirement:
        "税率取决于最终 HTSUS 归类。本报告中的候选编码只是研究线索，不是有约束力的归类裁定。",
      appliesTo: "IMPORT",
      sourceIds: ["us_tariff"],
      actionItems: ["与持牌报关行确认最终编码和税率。"],
      blocking: false,
      severity: "MEDIUM",
      condition: () => true,
    },
    {
      id: "us_lacey",
      country: "US",
      topic: "SUSTAINABILITY",
      title: "Lacey Act 植物产品复核",
      requirement:
        "某些植物产品（包括部分木制品）受 Lacey Act 申报和采购来源要求约束。适用性取决于树种、产品成分和进口数据。",
      appliesTo: "IMPORT",
      sourceIds: ["us_lacey"],
      actionItems: [
        "确认成品是否需要 Lacey Act 申报。",
        "收集属/种、采伐国家和供应商尽职调查记录。",
      ],
      blocking: true,
      severity: "HIGH",
      condition: isWood,
      conditionNote: "由产品简报中的木材/竹材触发。",
    },
  ],
  JP: [
    {
      id: "jp_entry",
      country: "JP",
      topic: "IMPORT_RESTRICTIONS",
      title: "日本进口申报",
      requirement:
        "商业进口到日本需要办理海关手续并提交随附文件。进口商负责准确申报并缴纳关税和税费。",
      appliesTo: "IMPORT",
      sourceIds: ["jp_customs", "jp_jetro"],
      actionItems: [
        "与日本报关行确认进口申报和文件集。",
        "准备发票、装箱单、运输文件和产品详情。",
      ],
      blocking: true,
      severity: "HIGH",
      condition: () => true,
    },
    {
      id: "jp_tariff",
      country: "JP",
      topic: "TARIFF",
      title: "日本关税归类",
      requirement:
        "日本关税取决于关税归类和原产地。候选编码只是研究线索；最终统计编码应由报关行确认。",
      appliesTo: "IMPORT",
      sourceIds: ["jp_customs", "jp_customs"],
      actionItems: ["确认最终日本统计编码和关税税率。"],
      blocking: false,
      severity: "MEDIUM",
      condition: () => true,
    },
    {
      id: "jp_safety",
      country: "JP",
      topic: "PRODUCT_SAFETY",
      title: "消费品安全复核",
      requirement:
        "日本消费品安全规则可能根据产品和使用方式适用。本次预检不能证明产品符合日本技术标准。",
      appliesTo: "MARKET",
      sourceIds: ["jp_meti", "jp_caa"],
      actionItems: ["核查 METI/CAA 产品安全要求，并保留供应商测试证据。"],
      blocking: false,
      severity: "MEDIUM",
      condition: () => true,
    },
    {
      id: "jp_labeling",
      country: "JP",
      topic: "LABELING",
      title: "家居用品标签复核",
      requirement:
        "日本《家庭用品品质表示法》覆盖指定家庭用品。该产品是否属于覆盖范围、哪些标签为强制要求，必须对照最新指定清单核实。",
      appliesTo: "MARKET",
      sourceIds: ["jp_caa"],
      actionItems: ["核查最新指定商品清单和日本标签要求。"],
      blocking: false,
      severity: "MEDIUM",
      condition: () => true,
    },
  ],
  DE: [
    {
      id: "de_gpsr",
      country: "DE",
      topic: "PRODUCT_SAFETY",
      title: "欧盟 GPSR 责任人与可追溯性",
      requirement:
        "根据欧盟《通用产品安全条例》，投放欧盟市场的消费品需要一名在欧盟设立的责任经济运营者，并提供可追溯性和安全信息。本次预检不认证 GPSR 合规。",
      appliesTo: "BOTH",
      sourceIds: ["eu_gpsr"],
      actionItems: [
        "指定欧盟境内的责任人，并添加其联系方式。",
        "上架前建立产品安全档案和可追溯记录。",
      ],
      blocking: true,
      severity: "HIGH",
      condition: () => true,
    },
    {
      id: "de_eudr",
      country: "DE",
      topic: "SUSTAINABILITY",
      title: "欧盟零毁林条例复核",
      requirement:
        "投放欧盟市场的木材及某些木制品可能属于《欧盟零毁林条例》范围。运营者可能需要尽职调查信息和尽职调查声明；适用性取决于最终产品范围和商品类别。",
      appliesTo: "IMPORT",
      sourceIds: ["eu_eudr"],
      actionItems: [
        "根据最终归类确认 EUDR 产品范围。",
        "向木材供应商收集地理位置和合法采伐证据。",
      ],
      blocking: true,
      severity: "HIGH",
      condition: isWood,
      conditionNote: "由产品简报中的木材/竹材触发。",
    },
    {
      id: "de_packaging",
      country: "DE",
      topic: "PACKAGING",
      title: "德国包装生产者责任",
      requirement:
        "在德国销售包装商品的卖家可能负有德国包装制度下的注册和系统参与义务。门槛和义务取决于卖家及包装类型。",
      appliesTo: "MARKET",
      sourceIds: ["de_verpackg"],
      actionItems: ["核查 LUCID 注册和包装系统参与义务。"],
      blocking: false,
      severity: "MEDIUM",
      condition: () => true,
    },
    {
      id: "de_tariff",
      country: "DE",
      topic: "TARIFF",
      title: "欧盟海关归类与关税",
      requirement:
        "欧盟进口关税和措施取决于最终 TARIC 归类和原产地。候选编码只是研究线索，不是有约束力的归类决定。",
      appliesTo: "IMPORT",
      sourceIds: ["eu_taric", "de_zoll"],
      actionItems: ["与欧盟报关行确认最终 TARIC 编码和进口措施。"],
      blocking: false,
      severity: "MEDIUM",
      condition: () => true,
    },
  ],
  UK: [
    {
      id: "uk_import",
      country: "UK",
      topic: "IMPORT_RESTRICTIONS",
      title: "英国进口申报与关税",
      requirement:
        "进口货物到英国需要海关申报，并缴纳适用关税和进口增值税。进口商仍负责准确归类和申报价值。",
      appliesTo: "IMPORT",
      sourceIds: ["uk_import", "uk_tariff"],
      actionItems: [
        "建立进口申报路径，并确认进口记录人。",
        "准备发票、装箱单、原产地和归类数据。",
      ],
      blocking: true,
      severity: "HIGH",
      condition: () => true,
    },
    {
      id: "uk_gpsr",
      country: "UK",
      topic: "PRODUCT_SAFETY",
      title: "英国 GB 通用产品安全法规",
      requirement:
        "在大不列颠供应的消费品必须安全，并满足适用的一般安全义务。生产商/进口商角色和标记义务取决于供应链。",
      appliesTo: "BOTH",
      sourceIds: ["uk_gpsr"],
      actionItems: [
        "记录安全评估和供应商测试证据。",
        "在要求范围内添加生产商/进口商标识和批次可追溯信息。",
      ],
      blocking: true,
      severity: "HIGH",
      condition: () => true,
    },
    {
      id: "uk_tariff",
      country: "UK",
      topic: "TARIFF",
      title: "英国贸易关税归类",
      requirement:
        "英国关税和进口增值税取决于商品编码和原产地。本报告中的候选编码只是研究线索，不是有法律约束力的归类。",
      appliesTo: "IMPORT",
      sourceIds: ["uk_tariff", "uk_tariff"],
      actionItems: ["在英国贸易关税系统中确认商品编码和税率。"],
      blocking: false,
      severity: "MEDIUM",
      condition: () => true,
    },
    {
      id: "uk_timber",
      country: "UK",
      topic: "SUSTAINABILITY",
      title: "英国木材法规尽职调查",
      requirement:
        "将木材及木制品投放英国市场的运营者，可能需要根据英国木材法规开展尽职调查并保存记录。适用性取决于产品及是否在范围内。",
      appliesTo: "IMPORT",
      sourceIds: ["uk_timber"],
      actionItems: ["确认英国木材法规范围，并保留供应商尽职调查记录。"],
      blocking: true,
      severity: "HIGH",
      condition: isWood,
      conditionNote: "由产品简报中的木材/竹材触发。",
    },
    {
      id: "uk_packaging",
      country: "UK",
      topic: "PACKAGING",
      title: "英国包装生产者责任",
      requirement:
        "在英国供应包装或包装商品的企业可能承担包装生产者责任义务。门槛和数据义务取决于企业和包装。",
      appliesTo: "MARKET",
      sourceIds: ["uk_epr"],
      actionItems: ["核查 EPR 包装注册、数据和费用义务。"],
      blocking: false,
      severity: "MEDIUM",
      condition: () => true,
    },
  ],
};

export function rulesForCountry(country: Country): ComplianceRule[] {
  return COMPLIANCE_RULES[country];
}
