import portableFanSamples from "./portable-fan-samples.json";

export function isPortableFan(productName: string) {
  return /便携.{0,6}风扇|ventilador.{0,12}portátil|portable.{0,20}fan/i.test(productName);
}

/** Dated, narrow observations explicitly matched to the sampled product type. */
export function marketSamples(productName: string, market: string) {
  return isPortableFan(productName)
    ? portableFanSamples.filter(item => item.market === market)
    : [];
}

type Sales = { sales?: number | null; salesPlus?: boolean };

export function highSales(item: Sales) {
  return item.sales != null && (item.sales > 500 || (item.sales === 500 && item.salesPlus === true));
}

export function formatSales(item: Sales) {
  return item.sales == null ? null : `${item.sales.toLocaleString("zh-CN")}${item.salesPlus ? "+" : ""} 件`;
}

export function rankedMarketSamples(productName: string, market: string) {
  return marketSamples(productName, market).filter(highSales).sort((a, b) => b.sales - a.sales);
}

export function sampleDescription(item: ReturnType<typeof marketSamples>[number]) {
  return [`页面销量 ${formatSales(item)}`, item.positioning].join(" · ");
}
