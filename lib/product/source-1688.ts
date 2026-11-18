import * as cheerio from "cheerio";
import { domainFromUrl } from "@/lib/search/source-validator";

/**
 * Parser for the server-rendered 1688 offer page.
 *
 * 1688 does not expose schema.org product JSON. The page embeds a large
 * `window.context` payload with a `result.data` tree; parts of it use
 * unquoted numeric object keys, so it is not strict JSON until sanitized.
 * Everything below is extraction only: absent fields stay null.
 */

export interface SupplierAttributes {
  [name: string]: string;
}

export interface SupplierSnapshot {
  title: string;
  description: string | null;
  priceCNY: number | null;
  priceMaxCNY: number | null;
  moq: number | null;
  supplier: string | null;
  material: string | null;
  color: string | null;
  packagingDimensions: string | null;
  /** Product (not packaging) size, only when the page states it. */
  productDimensions: string | null;
  weightKg: number | null;
  images: string[];
  detailImages: string[];
  detailUrl: string | null;
  attributes: SupplierAttributes;
  categoryHint: string | null;
  soldCount: number | null;
}

function balancedJson(text: string, start: number): string | null {
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') {
      inString = true;
      continue;
    }
    if (character === "{") depth += 1;
    else if (character === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return null;
}

function parseContext(html: string): Record<string, unknown> | null {
  const marker = html.indexOf('{"result"');
  if (marker === -1) return null;
  const raw = balancedJson(html, marker);
  if (!raw) return null;
  // 1688 serializes skuWeight as {5734229396723:0.8}; quote numeric keys.
  const sanitized = raw.replace(/([{,]\s*)(\d+)\s*:/g, '$1"$2":');
  try {
    return JSON.parse(sanitized) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function objectAt(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function arrayAt(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringAt(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function numberAt(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    const parsed = stringAt(value);
    if (parsed) return parsed;
  }
  return null;
}

function firstNumber(...values: unknown[]): number | null {
  for (const value of values) {
    const parsed = numberAt(value);
    if (parsed !== null) return parsed;
  }
  return null;
}

function dedupeUrls(values: unknown[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];
  for (const value of values) {
    const url = stringAt(value);
    if (!url || !/^https?:\/\//i.test(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    output.push(url);
  }
  return output;
}

function normalizeCdnImage(url: string): string {
  if (/^https?:\/\//i.test(url)) return url;
  if (url.startsWith("//")) return `https:${url}`;
  if (url.startsWith("img/")) return `https://cbu01.alicdn.com/${url}`;
  return url;
}

function readAttributes(data: Record<string, unknown>): SupplierAttributes {
  const block = objectAt(data.productAttributes);
  const fields = objectAt(block?.fields);
  const rows = arrayAt(fields?.data);
  const attributes: SupplierAttributes = {};
  for (const row of rows) {
    const item = objectAt(row);
    const name = firstString(item?.name);
    const value = firstString(item?.value);
    if (name && value) attributes[name] = value;
  }
  return attributes;
}

/** Attribute keys that describe the shipped carton rather than the product itself. */
const PACKAGING_DIMENSION_KEYS = [
  "包装尺寸",
  "外箱尺寸",
  "装箱尺寸",
  "包装箱尺寸",
  "包装规格",
  "物流尺寸",
  "外包装尺寸",
];

/** Attribute keys that describe the product's own size. */
const PRODUCT_DIMENSION_KEYS = [
  "产品尺寸",
  "商品尺寸",
  "尺寸",
  "规格尺寸",
  "外形尺寸",
  "产品规格",
  "长宽高",
];

/**
 * A dimension value only counts when it actually carries at least two numbers
 * joined by a separator. Supplier pages also use "尺寸" for counts, colors or
 * free text, and those must not become a measurement.
 */
function looksLikeDimension(value: string | null): value is string {
  if (!value) return false;
  const normalized = value.trim();
  if (normalized.length > 60) return false;
  if (!/\d/.test(normalized)) return false;
  const numbers = normalized.match(/\d+(?:\.\d+)?/g) ?? [];
  if (numbers.length < 2) return false;
  return /[×xX*＊]|、|,|，|\s[-~]\s/.test(normalized) && !/^[\d\s.,，×xX*＊]+$/.test(normalized);
}

function readDimensionAttribute(
  attributes: SupplierAttributes,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = attributes[key];
    if (looksLikeDimension(value)) return value.trim();
  }
  return null;
}

/**
 * Piece-weight scale on 1688 is a shipping measurement. It is frequently
 * present but filled with zeros when the supplier never measured the carton,
 * so a zero-valued reading is treated as "not stated" instead of a real size.
 */
function readPieceWeightScale(pack: Record<string, unknown> | null): {
  dimensions: string | null;
  weightKg: number | null;
} {
  if (!pack) return { dimensions: null, weightKg: null };
  const length = numberAt(pack.length);
  const width = numberAt(pack.width);
  const height = numberAt(pack.height);
  const weightGrams = numberAt(pack.weight);
  const hasLength = length !== null && length > 0;
  const hasWidth = width !== null && width > 0;
  const hasHeight = height !== null && height > 0;
  const dimensions =
    hasLength && hasWidth
      ? `${length} × ${width}${hasHeight ? ` × ${height}` : ""} cm`
      : null;
  return {
    dimensions,
    weightKg: weightGrams !== null && weightGrams > 0 ? Math.round((weightGrams / 1000) * 1000) / 1000 : null,
  };
}

function readImages(data: Record<string, unknown>): string[] {
  const gallery = objectAt(objectAt(data.gallery)?.fields);
  const urls: unknown[] = [
    ...arrayAt(gallery?.offerImgList),
    ...arrayAt(gallery?.mainImage),
    ...arrayAt(data.images).map((item) => {
      const image = objectAt(item);
      return firstString(image?.fullPathImageURI, image?.imageURI, image?.size310x310ImageURI);
    }),
  ];
  return dedupeUrls(urls.map((url) => (typeof url === "string" ? normalizeCdnImage(url) : url)));
}

export function parse1688Html(html: string): SupplierSnapshot | null {
  const context = parseContext(html);
  const data = objectAt(objectAt(context?.result)?.data);
  if (!data) return null;

  const root = objectAt(objectAt(data.Root)?.fields)?.dataJson;
  const rootObject = objectAt(root);
  const tempModel = objectAt(rootObject?.tempModel);
  const shopInfo = objectAt(objectAt(objectAt(data.productTitle)?.fields)?.shopInfo);
  const gallery = objectAt(objectAt(data.gallery)?.fields);
  const priceModel = objectAt(objectAt(objectAt(objectAt(data.mainPrice)?.fields)?.finalPriceModel)?.tradeWithoutPromotion);
  const packFields = objectAt(objectAt(objectAt(data.productPackInfo)?.fields)?.pieceWeightScale);
  const packRows = arrayAt(packFields?.pieceWeightScaleInfo);
  const pack = objectAt(packRows[0]);
  const descriptionBlock = objectAt(objectAt(data.description)?.fields);

  const attributes = readAttributes(data);
  const title = firstString(
    tempModel?.offerTitle,
    gallery?.subject,
    objectAt(objectAt(data.offerTitle)?.fields)?.subject,
    cheerio.load(html)("title").first().text().replace(/\s*-\s*阿里巴巴.*$/, ""),
  );
  if (!title) return null;

  const material = firstString(attributes["材质"], attributes["具体材质"], attributes["Material"]);
  const color = firstString(attributes["颜色"], attributes["色系"], attributes["Color"]);
  const pieceWeight = readPieceWeightScale(pack);
  const packagingDimensions =
    readDimensionAttribute(attributes, PACKAGING_DIMENSION_KEYS) ?? pieceWeight.dimensions;
  const productDimensions = readDimensionAttribute(attributes, PRODUCT_DIMENSION_KEYS);
  const priceCNY = firstNumber(priceModel?.offerMinPrice, priceModel?.price, priceModel?.discountPrice);
  const priceMaxCNY = firstNumber(priceModel?.offerMaxPrice);
  const moq = firstNumber(priceModel?.offerBeginAmount, objectAt(rootObject?.orderParamModel)?.beginNum);

  const attributeSummary = Object.entries(attributes)
    .slice(0, 14)
    .map(([name, value]) => `${name}：${value}`)
    .join("；");

  return {
    title,
    description: attributeSummary ? `${title}。${attributeSummary}`.slice(0, 1600) : title,
    priceCNY,
    priceMaxCNY,
    moq,
    supplier: firstString(tempModel?.companyName, shopInfo?.companyName, shopInfo?.shopName),
    material,
    color,
    packagingDimensions,
    productDimensions,
    weightKg: pieceWeight.weightKg,
    images: readImages(data).slice(0, 12),
    detailImages: [],
    detailUrl: firstString(descriptionBlock?.detailUrl),
    attributes,
    categoryHint: firstString(attributes["产品类别"], attributes["类别"], attributes["用途"]),
    soldCount: firstNumber(tempModel?.saledCount, objectAt(objectAt(rootObject?.orderParamModel)?.orderParam)?.saledCount),
  };
}

export function extractDetailImageUrls(html: string): string[] {
  const urls = Array.from(
    html.matchAll(/https?:\/\/[^"'\\\s<>]+?\.(?:jpg|jpeg|png|webp)(?:\?[^"'\\\s<>]*)?/gi),
    (match) => match[0],
  );
  return dedupeUrls(urls).slice(0, 12);
}

export function is1688Host(url: string): boolean {
  const domain = domainFromUrl(url);
  return domain === "1688.com" || domain.endsWith(".1688.com");
}
