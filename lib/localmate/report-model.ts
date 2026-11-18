export const reportMarkets = ["MX", "DE", "GB", "BR", "US", "JP"] as const;
export type ReportMarket = typeof reportMarkets[number];

export const mexicoMarketplaces = ["amazon", "mercado_libre"] as const;
export type MexicoMarketplace = typeof mexicoMarketplaces[number];

export function defaultMexicoMarketplace(goal: string): MexicoMarketplace {
  return /mercado\s*libre|mercadolibre|美客多/i.test(goal) ? "mercado_libre" : "amazon";
}

export type ReportInput = {
  mexicoMarketplace?: MexicoMarketplace;
  productId: string;
  category?: string;
  productUpdatedAt: string;
  name: string;
  dimensions: string;
  packagingDimensions: string;
  weightKg: number;
  purchaseCNY: number;
  budgetCNY: number;
};

export type ReportSection = {
  market: string;
  title: string;
  lines: string[];
  marketSignal?: { channel: string; listings: number; priced: number; searchLeads: number };
  releaseHold?: boolean;
  economics?: {
    breakEvenCNY: number;
    testPriceCNY: number;
    stressContributionCNY: number;
    localTestPrice: string | null;
    pilotUnits: number;
  };
};

export const dimensionUnits = ["cm", "m", "mm"] as const;
export type DimensionUnit = typeof dimensionUnits[number];

export function parseDimensions(value: string | null | undefined) {
  const match = value?.trim().match(/^([0-9.]+(?:\s*[x×*ｘX]\s*[0-9.]+){1,2})\s*(mm|cm|m|毫米|厘米|米)$/i);
  if (!match) return null;
  const sides = match[1].split(/\s*[x×*ｘX]\s*/).map(Number);
  if (!sides.every(side => Number.isFinite(side) && side > 0 && side <= 1_000_000)) return null;
  const units = { 毫米: "mm", 厘米: "cm", 米: "m" } as const;
  const unit = (units[match[2] as keyof typeof units] ?? match[2].toLowerCase()) as DimensionUnit;
  return { sides, unit };
}

export function reportDimensions(value: string | null | undefined) {
  return parseDimensions(value)?.sides.length === 3;
}
