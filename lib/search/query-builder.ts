import type { Country, ProductCategory, ProductDNA } from "@/types/domain";
import { COUNTRY_LANGUAGE } from "@/types/domain";

type Lexicon = Record<ProductCategory, Record<"en" | "ja" | "de", string[]>>;

const LEXICON: Lexicon = {
  DESK_ORGANIZER: {
    en: ["desk organizer", "desktop storage rack", "desk tidy", "office desk storage"],
    ja: ["デスク収納", "卓上 収納 ラック", "デスクオーガナイザー", "机上ラック"],
    de: ["Schreibtisch Organizer", "Schreibtisch Aufbewahrung", "Schreibtischregal", "Schreibwaren Aufbewahrung"],
  },
  STORAGE_BOX: {
    en: ["storage box", "storage basket", "home storage container"],
    ja: ["収納ボックス", "収納かご", "収納コンテナ"],
    de: ["Aufbewahrungsbox", "Staubox", "Aufbewahrungskorb"],
  },
  SHELF_RACK: {
    en: ["desk shelf", "storage rack", "desktop shelf organizer"],
    ja: ["デスク上置き棚", "収納ラック", "卓上棚"],
    de: ["Schreibtischregal", "Regal Aufbewahrung", "Tischregal"],
  },
  DECOR_STORAGE: {
    en: ["decorative storage", "decorative organizer", "home decor storage"],
    ja: ["飾り 収納", "インテリア 収納", "装飾 収納"],
    de: ["dekorative Aufbewahrung", "Deko Organizer", "Wohnaccessoire Aufbewahrung"],
  },
  OTHER_HOME_ORGANIZATION: {
    en: ["home organization", "home storage solution", "household organizer"],
    ja: ["家庭用 収納", "収納グッズ", "整理用品"],
    de: ["Haushaltsorganisation", "Aufbewahrungslösung", "Ordnungssystem"],
  },
  OUT_OF_SCOPE: {
    en: ["product"],
    ja: ["商品"],
    de: ["Produkt"],
  },
};

const LOCAL_PHRASES: Record<"en" | "ja" | "de", string[]> = {
  en: ["buy online", "reviews", "price", "best"],
  ja: ["通販", "口コミ", "価格", "おすすめ"],
  de: ["kaufen", "Erfahrungen", "Preis", "Tests"],
};

export function coreTerms(
  product: Pick<ProductDNA, "category" | "name">,
  country: Country,
): string[] {
  const language = COUNTRY_LANGUAGE[country];
  const terms = LEXICON[product.category]?.[language] ?? LEXICON.OTHER_HOME_ORGANIZATION[language];
  return terms.slice(0, 3);
}

export function primaryRetailQuery(
  product: Pick<ProductDNA, "category" | "name" | "attributes">,
  country: Country,
): string {
  const language = COUNTRY_LANGUAGE[country];
  const term = coreTerms(product, country)[0] ?? product.name;
  const material = product.attributes.material?.toLowerCase();
  if (!material) return term;
  const words: Record<string, string> = {
    wood: language === "de" ? "Holz" : language === "ja" ? "木製" : "wooden",
    plastic: language === "de" ? "Kunststoff" : language === "ja" ? "プラスチック" : "plastic",
    metal: language === "de" ? "Metall" : language === "ja" ? "金属" : "metal",
  };
  const key = Object.keys(words).find((candidate) => material.includes(candidate));
  return key ? `${term} ${words[key]}` : term;
}

export function buildMarketQueries(
  product: Pick<ProductDNA, "category" | "name" | "attributes">,
  country: Country,
): string[] {
  const language = COUNTRY_LANGUAGE[country];
  const terms = coreTerms(product, country);
  const phrases = LOCAL_PHRASES[language];
  const queries = new Set<string>();

  queries.add(`${terms[0]} ${phrases[0]}`);
  if (terms[1]) queries.add(`${terms[1]} ${phrases[2]}`);
  queries.add(`${terms[0]} ${phrases[1]}`);
  queries.add(`${terms[0]} ${phrases[3]}`);

  return Array.from(queries).slice(0, 4);
}

export function buildComplianceQueries(
  product: Pick<ProductDNA, "attributes" | "category">,
  country: Country,
): string[] {
  const material = product.attributes.material?.toLowerCase() ?? "";
  const englishBase = material.includes("wood")
    ? "wooden desk organizer import requirements"
    : material.includes("metal")
      ? "metal desk organizer import requirements"
      : "plastic desk organizer import requirements";
  if (country === "US") {
    return [
      `${englishBase} United States CBP`,
      "19 CFR 134 country of origin marking imports",
      "Lacey Act wood products import declaration",
    ];
  }
  if (country === "UK") {
    return [
      `${englishBase} United Kingdom`,
      "UK general product safety regulations importer",
      "UK timber regulation due diligence",
    ];
  }
  if (country === "DE") {
    return [
      "EU General Product Safety Regulation 2023/988 consumer products",
      "EU deforestation regulation wood products importer",
      "Germany VerpackG packaging registration",
    ];
  }
  return [
    "Japan customs tariff desk organizer import",
    "JETRO import procedures consumer products",
    "Japan Household Goods Quality Labeling Act",
  ];
}