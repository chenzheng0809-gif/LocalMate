import type { ReportMarket } from "./report-model";

export const fanReferences = {
  MX: [
    { title: "墨西哥 DOF · NOM-024 原始公告 §5", url: "https://www.dof.gob.mx/nota_detalle.php?codigo=5309980&fecha=12/08/2013",
      basis: "原始公告第 5 节讨论适用产品包装和容器的商业信息。", action: "准备西语包装、说明书和保修样稿，请进口商按现行版本及具体型号核对适用要求。" },
    { title: "墨西哥 SNICE · 商业标签目录", url: "https://www.snice.gob.mx/cs/avi/snice/etiquetado.info.com.html",
      basis: "墨西哥经济部的商业标签规范查找入口。", action: "向供应商索取铭牌、电压、充电方式及适配器资料，请进口商按税号和供电配置核对适用标准。" },
  ],
  DE: [
    { title: "EUR-Lex · 欧盟通用产品安全法规 §5–6、§9", url: "https://eur-lex.europa.eu/eli/reg/2023/988",
      basis: "法规列出一般安全要求、安全评价因素以及制造商文件义务。", action: "请欧盟责任人与进口商核对产品及线上销售要求，并检查叶片防护、充电发热和德语警示的风险文件。" },
    { title: "EUR-Lex · 欧盟电池法规 §1", url: "https://eur-lex.europa.eu/eli/reg/2023/1542",
      basis: "该法规涵盖电池，以及内置电池涉及的相应要求。", action: "确认电池化学体系、容量与可拆卸性，请进口商按投放日期核对标签、技术资料及电池责任义务。" },
  ],
  GB: [
    { title: "英国 OPSS · 大不列颠电气设备安全指南 §3", url: "https://www.gov.uk/government/publications/electrical-equipment-safety-regulations-2016/electrical-equipment-safety-regulations-2016-great-britain",
      basis: "指南第 3 节按额定交流与直流电压划定这项法规的适用范围。", action: "分别记录风扇和随附适配器的额定电压，请进口商核对两者各自的适用法规。" },
    { title: "英国政府 · 电池与蓄电池指南", url: "https://www.gov.uk/guidance/batteries",
      basis: "指南区分大不列颠与北爱尔兰的电池要求，并讨论装入设备的电池。", action: "确认电池参数及销售目的地，请进口商核对适用的标签和生产者责任。" },
  ],
  BR: [
    { title: "巴西 Siscomex · 进口公告 017/2026", url: "https://www.gov.br/siscomex/pt-br/noticias/noticias-siscomex-importacao/Comunicados/importacao-no-2026-017/",
      basis: "该公告针对特定 NCM 子目更新风扇进口的 Inmetro 属性与行政处理。", action: "请巴西进口商先核定 NCM，再查看该子目当前的进口申报与 Inmetro 处理方式。" },
    { title: "巴西 Inmetro · 风扇能效登记入口", url: "https://www.gov.br/inmetro/pt-br/assuntos/regulamentacao/avaliacao-da-conformidade/programa-brasileiro-de-etiquetagem/tabelas-de-eficiencia-energetica/ventiladores/",
      basis: "Inmetro 提供按风扇型号及特性查询登记记录的入口。", action: "区分 USB 供电、内置充电电池和市电适配器配置，请当地机构核定现行范围及型号是否需要登记。" },
  ],
  US: [
    { title: "美国 CPSC · 充电手持风扇召回案例", url: "https://www.cpsc.gov/Recalls/2021/Rite-Aid-Recalls-Rechargeable-Handheld-Fans-Due-to-Fire-Hazard",
      basis: "这一召回案例的风险是锂离子电池充电时过热，涉及公告列明的型号。", action: "核对实际型号与召回记录，并向供应商索取本型号的充电保护和过热风险测试资料。" },
    { title: "美国 PHMSA · 锂电池运输指南", url: "https://www.phmsa.dot.gov/lithiumbatteries",
      basis: "美国运输监管机构提供锂电池托运指南和测试摘要说明。", action: "如含锂电池，向供应商索取与电芯或电池组匹配的测试摘要，请货代核对本票运输配置。" },
  ],
  JP: [
    { title: "日本经济产业省 · 电气用品安全法", url: "https://www.meti.go.jp/english/policy/economy/consumer/pse/index.html",
      basis: "METI 介绍受监管电气用品类别、进口商程序及标识要求。", action: "请日本进口商分别核对风扇本体与随附 AC 适配器的电源配置及 PSE 适用范围。" },
    { title: "日本经济产业省 · 二次锂电池实务指南", url: "https://www.meti.go.jp/english/policy/economy/consumer/product_safety/pse_procedure/pdf/pse_regulatory-instructions.pdf",
      basis: "实务指南区分二次锂电池与设备之间的组合、装入和进口情形。", action: "记录电池是否内置、可拆或单独随箱进口，由当地责任方逐项确认电池适用范围。" },
  ],
} satisfies Record<ReportMarket, { title: string; url: string; basis: string; action: string }[]>;
