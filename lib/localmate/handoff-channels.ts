import type { MexicoMarketplace, ReportMarket } from "./report-model";

const storefronts = { MX: "com.mx", DE: "de", GB: "co.uk", BR: "com.br", US: "com", JP: "co.jp" };
const registrationGuide = {
  MX: "https://vender.amazon.com.mx/vender/guia-de-registro",
  DE: "https://sell.amazon.de/online-verkaufen/registrierungsleitfaden",
  GB: "https://sell.amazon.co.uk/sell-online/registration-guide",
  BR: "https://venda.amazon.com.br/guia-cadastro-vendedor-amazon",
  US: "https://sell.amazon.com/sell/registration-guide",
  JP: "https://sell.amazon.co.jp/sell/account-registration",
};
const globalSelling = "https://sell.amazon.com/global-selling";
const amazonTemplateHelp = "https://sellercentral.amazon.com/help/hub/reference/external/G581?ots=1";

export function handoffChannel(market: ReportMarket, mexicoMarketplace?: MexicoMarketplace) {
  if (market === "MX" && mexicoMarketplace === "mercado_libre") {
    return {
      id: "mercado_libre",
      name: "Mercado Libre México",
      apply: "https://global-selling.mercadolibre.com/",
      guide: "https://global-selling.mercadolibre.com/learning-center/guide/getting-started-as-an-international-seller?moduleKeyId=MO259",
      contact: "https://global-selling.mercadolibre.com/help",
      submit: "https://global-selling.mercadolibre.com/help",
      requirements: "在跨境卖家后台确认账户资格、目标站点、物流方案及类目材料。",
      contactNote: "官方帮助中心，部分支持功能需登录。",
      coverage: "https://global-selling.mercadolibre.com/learning-center/nota/start-selling-in-latin-america-with-global-selling",
      globalName: "Mercado Libre Global Selling",
      templateHelp: "https://global-selling.mercadolibre.com/learning-center/nota/how-to-list-my-products",
      sourceDate: "2026-11-17",
    } as const;
  }

  const storefront = storefronts[market];
  return {
    id: "amazon",
    coverage: globalSelling,
    globalName: "Amazon Global Selling",
    templateHelp: amazonTemplateHelp,
    name: `Amazon.${storefront}`,
    apply: `https://sellercentral.amazon.${storefront}/`,
    requirements: "企业及联系人资料、身份核验、银行及收款信息。实际类目审核和可提交材料须在对应站点确认。",
    guide: registrationGuide[market],
    contact: market === "BR" ? "https://venda.amazon.com.br/ajuda" : `https://sellercentral.amazon.${storefront}/help/hub/support`,
    submit: `https://sellercentral.amazon.${storefront}/help/hub/support`,
    contactNote: "官方客服入口，联系前可能需要登录。",
    sourceDate: "2026-11-17",
  } as const;
}
