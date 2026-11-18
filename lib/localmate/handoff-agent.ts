import { Readable } from "node:stream";
import ExcelJS from "exceljs";
import { load } from "cheerio";
import { openOffice } from "./handoff-files";
import { listingSchema, replyFields, rfqSchema, type AgentDrafts, type DocumentDraft, type Handoff, type TemplateMapping, type UploadInfo } from "./handoff-model";
import { parseDimensions, type ReportInput, type ReportMarket } from "./report-model";
import { fileData, HandoffError } from "./handoff-store";

type SourceLine = { text: string; location: string };
type Table = { rows: SourceLine[][] };
const canonical = (value: string) => value.normalize("NFKC").toLowerCase().replace(/[\s_.-]+/g, " ").trim();
const isoCurrency = "(CNY|USD|EUR|GBP|MXN|BRL|JPY|HKD|CAD|SGD|CHF|AUD)";
const decimalAmount = "(\\d{1,9}(?:\\.\\d{1,2})?)(?!\\d|[.,]\\d)";
const expiresLabel = "(?:valid (?:through|until|to)|expiry date|expiration date|expires(?: on)?|报价有效至|价格有效至|有效期至|有效至)";
const labels = {
  price: {
    amount: ["unit price", "selling price per unit", "对买家商品单价", "商品单价", "销售单价", "单价"],
    currency: ["currency", "币种"], expires: ["valid through", "valid through (yyyy-mm-dd)", "valid until", "expires", "价格有效至", "有效至"],
    seller: ["seller", "卖方", "卖方名称"], buyer: ["buyer", "买方", "买方名称"],
  },
  reply: {
    amount: ["total shipment freight", "total freight", "freight total", "整票运费", "运费合计", "运费总额"],
    currency: ["currency", "币种"], expires: ["valid through", "valid through (yyyy-mm-dd)", "valid until", "expires", "报价有效至", "有效至"],
    forwarder: ["forwarder", "freight forwarder", "货代", "货代公司"], originalRef: ["quote reference", "quotation number", "quote number", "回单号", "报价单号"],
    scope: ["included charges", "included", "费用包含项", "包含"], excludes: ["excluded charges", "excluded", "费用不包含项", "不包含"],
    transit: ["transit", "transit time", "运输时效", "时效"],
  },
};
const templateAliases: Record<string, TemplateMapping["field"]> = {
  sku: "sku", "seller sku": "sku", "item sku": "sku", "商家sku": "sku", "商品sku": "sku",
  title: "title", "item name": "title", "item name#1 value": "title", "product name": "title", "product title": "title", "商品标题": "title", "商品名称": "title",
  description: "description", "product description": "description", "product description#1 value": "description", "商品描述": "description",
  brand: "brand", "brand name": "brand", "brand#1 value": "brand", "品牌": "brand",
  gtin: "gtin", upc: "gtin", ean: "gtin", "商品条码": "gtin",
  "length cm": "lengthCm", "width cm": "widthCm", "height cm": "heightCm",
  "package length cm": "packageLengthCm", "package width cm": "packageWidthCm", "package height cm": "packageHeightCm",
  "package weight kg": "packageKg",
};

async function readWorkbook(bytes: Buffer) {
  await openOffice(bytes);
  const buffer = new ArrayBuffer(bytes.length);
  new Uint8Array(buffer).set(bytes);
  const book = new ExcelJS.Workbook();
  await book.xlsx.load(buffer);
  return book;
}

export async function readDocument(bytes: Buffer, file: UploadInfo) {
  const lines: SourceLine[] = [];
  const tables: Table[] = [];
  if (/\.xlsx?m?$/i.test(file.name)) {
    const book = await readWorkbook(bytes);
    for (const sheet of book.worksheets.filter(page => page.state === "visible").slice(0, 8)) {
      const rows: SourceLine[][] = [];
      for (let number = 1; number <= Math.min(sheet.rowCount, 160); number++) {
        const row = sheet.getRow(number);
        const cells = Array.from({ length: Math.min(row.cellCount, 100) }, (_, index) => {
          const cell = row.getCell(index + 1);
          const isDate = cell.value instanceof Date;
          return { text: isDate ? (cell.value as Date).toISOString().slice(0, 10) : cell.text,
            location: `${sheet.name}!${cell.address}` };
        });
        rows.push(cells);
        lines.push({ text: cells.filter(cell => cell.text).map(cell => cell.text).join(": "), location: `${sheet.name} 第 ${number} 行` });
      }
      tables.push({ rows });
    }
    return { lines, tables };
  }
  let pages: { text: string; num?: number }[];
  if (file.mime === "application/pdf") {
    const { PDFParse } = await import("pdf-parse");
    const pdf = new PDFParse({ data: new Uint8Array(bytes) });
    try { pages = (await pdf.getText({ partial: [1, 2, 3, 4, 5, 6] })).pages; }
    finally { await pdf.destroy(); }
  } else if (/\.docx$/i.test(file.name)) {
    const zip = await openOffice(bytes);
    const xml = await zip.file("word/document.xml")?.async("string") ?? "";
    const $ = load(xml, { xml: true });
    pages = [{ text: $("w\\:p").toArray().map(node => $(node).find("w\\:t").text()).join("\n") }];
  } else {
    const raw = bytes.toString("utf8", 0, 64_000);
    if (/\.csv$/i.test(file.name)) {
      const book = new ExcelJS.Workbook();
      const sheet = await book.csv.read(Readable.from([raw]), { map: cell => cell });
      const rows: SourceLine[][] = [];
      sheet.eachRow((row, number) => {
        if (number > 160) return;
        rows.push(Array.from({ length: Math.min(row.cellCount, 100) }, (_, index) => {
          const cell = row.getCell(index + 1);
          return { text: cell.text, location: `CSV ${cell.address}` };
        }));
      });
      tables.push({ rows });
    }
    pages = [{ text: raw }];
  }
  for (const page of pages) {
    page.text.slice(0, 30_000).split(/\r?\n/).slice(0, 300).forEach((line, index) => {
      if (!line.trim()) return;
      lines.push({ text: line.trim().slice(0, 900), location: page.num ? `第 ${page.num} 页` : `第 ${index + 1} 行` });
    });
  }
  return { lines, tables };
}

async function templateDraft(bytes: Buffer, listing: AgentDrafts["listing"], state: Handoff, input: ReportInput): Promise<DocumentDraft> {
  const book = await readWorkbook(bytes);
  const drafts: { mappings: TemplateMapping[]; evidence: Record<string, string> }[] = [];
  const packageFields = Boolean(parseDimensions(input.packagingDimensions)?.sides.length === 3);
  const productFields = Boolean(parseDimensions(input.dimensions)?.sides.length === 3);
  const available = { title: listing?.title, description: listing?.description, sku: listing?.sku, gtin: listing?.gtin, brand: listing?.brand,
    lengthCm: productFields, widthCm: productFields, heightCm: productFields, packageLengthCm: packageFields, packageWidthCm: packageFields,
    packageHeightCm: packageFields, packageKg: input.weightKg, price: state.price?.amount, currency: state.price?.currency, custom: false };
  for (const sheet of book.worksheets.filter(page => page.state === "visible").slice(0, 8)) {
    for (let number = 1; number <= Math.min(sheet.rowCount, 12); number++) {
      const row = sheet.getRow(number);
      const headers = new Map<TemplateMapping["field"], number[]>();
      for (let column = 1; column <= Math.min(row.cellCount, 250); column++) {
        const name = canonical(row.getCell(column).text);
        const field = Object.hasOwn(templateAliases, name) ? templateAliases[name] : undefined;
        if (field) headers.set(field, [...(headers.get(field) ?? []), column]);
      }
      if (!headers.has("sku") || !headers.has("title")) continue;
      const next = sheet.getRow(number + 1);
      const mappings: TemplateMapping[] = [];
      const evidence: Record<string, string> = {};
      for (const [field, columns] of headers) {
        if (!available[field] || columns.length !== 1) continue;
        const target = next.getCell(columns[0]);
        if (target.text || target.formula || target.isMerged) continue;
        mappings.push({ sheet: sheet.name, cell: target.address, field, custom: "" });
        evidence[target.address] = `${row.getCell(columns[0]).address} · ${row.getCell(columns[0]).text}`;
      }
      if (mappings.some(mapping => mapping.field === "sku") && mappings.some(mapping => mapping.field === "title")) drafts.push({ mappings, evidence });
    }
  }
  return drafts.length === 1
    ? { values: {}, ...drafts[0] }
    : { values: {}, evidence: {}, issue: "模板没有唯一且可填写的 SKU／商品标题数据行。请选择实际数据行和字段。" };
}

function parseFields(kind: "price" | "reply", lines: SourceLine[], tables: Table[], sku?: string): DocumentDraft {
  const fields: Record<string, string[]> = labels[kind];
  const matches = new Map<string, Map<string, string>>();
  const capture = (key: string, value: string | undefined, line: SourceLine) => {
    if (!value?.trim()) return;
    const found = matches.get(key) ?? new Map<string, string>();
    found.set(value.trim(), `${line.location} · ${line.text}`.slice(0, 500));
    matches.set(key, found);
  };
  for (const table of tables) {
    for (let index = 0; index < table.rows.length; index++) {
      const row = table.rows[index];
      const headers = row.map(cell => canonical(cell.text));
      const matching = Object.entries(fields).flatMap(([key, variants]) => {
        const column = headers.findIndex(header => variants.includes(header));
        return column < 0 || headers.lastIndexOf(headers[column]) !== column ? [] : [{ key, column }];
      });
      if (!matching.some(field => field.key === "amount") || !matching.some(field => field.key === "currency")) continue;
      const data = table.rows.slice(index + 1).filter(cells => cells.some(cell => cell?.text));
      const skuColumn = headers.findIndex(header => ["sku", "seller sku", "item sku", "商家sku"].includes(header));
      const candidates = kind === "price" && skuColumn >= 0
        ? data.filter(cells => Boolean(sku) && canonical(cells[skuColumn]?.text ?? "") === canonical(sku!))
        : data;
      if (candidates.length !== 1) continue;
      for (const { key, column } of matching) {
        const cell = candidates[0][column];
        if (cell) capture(key, cell.text, cell);
      }
    }
  }
  const skuTag = /\bsku\s*[:=]?\s*([\w-]+)\b/i;
  const skuLines = lines.filter(line => skuTag.test(line.text));
  const chosenSkuLines = sku && skuLines.length > 1
    ? skuLines.filter(line => canonical(line.text.match(skuTag)?.[1] ?? "") === canonical(sku)) : skuLines;
  const expiry = new RegExp(`${expiresLabel}\\s*[:：]?\\s*(20\\d\\d-\\d\\d-\\d\\d)\\b`, "i");
  for (const [index, line] of lines.entries()) {
    if (kind === "price" && skuLines.length > 1 && !chosenSkuLines.includes(line) && (skuLines.includes(line) || /(?:unit price|单价)/i.test(line.text))) continue;
    const pair = line.text.match(/^([^:：]{1,80})\s*[:：]\s*(.+)$/);
    if (pair) for (const [key, variants] of Object.entries(fields)) {
      if (variants.includes(canonical(pair[1]))) capture(key, pair[2], line);
    }
    const amountLabel = kind === "reply"
      ? "(?:total (?:shipment )?freight|freight total|freight (?:quote|quotation)[^\\n]{0,60}?[,:]?\\s+total|整票运费|运费合计|运费总额)"
      : "(?:unit price|selling price per unit|商品单价|销售单价|单价)";
    const amount = line.text.match(new RegExp(`${amountLabel}\\s*[:：=]?\\s*${isoCurrency}\\s*${decimalAmount}`, "i"))
      ?? (kind === "price" && (skuLines.length < 2 || chosenSkuLines.includes(line))
        ? line.text.match(new RegExp(`\\b${isoCurrency}\\s*${decimalAmount}\\s*[/／]\\s*(?:pc|unit|件)\\b`, "i")) : null);
    if (amount) {
      capture("currency", amount[1].toUpperCase(), line);
      capture("amount", amount[2], line);
    }
    const validThrough = line.text.match(expiry)?.[1];
    if (validThrough) capture("expires", validThrough, line);
    else {
      const next = lines[index + 1];
      if (next && next.location === line.location && line.location.endsWith("页")) {
        const joined = { location: line.location, text: `${line.text} ${next.text}` };
        capture("expires", joined.text.match(expiry)?.[1], joined);
      }
    }
    if (kind === "reply") {
      capture("originalRef", line.text.match(/\b(?:freight quote|quote (?:ref(?:erence)?|number))\s*[:#]?\s*([A-Z]+-\d[\w-]*)\b/i)?.[1], line);
      capture("transit", line.text.match(/\btransit(?: time)?\s*[:：]?\s*(\d+(?:\s*[-–]\s*\d+)?\s*(?:business days?|days?|weeks?))/i)?.[1], line);
    }
  }
  const values: Record<string, string> = {};
  const evidence: Record<string, string> = {};
  for (const [key, alternatives] of matches) {
    // A labeled combined currency/amount cell is handled by the anchored money pattern above.
    const allowed = [...alternatives].filter(([value]) => {
      if (key === "amount") return new RegExp(`^${decimalAmount}$`).test(value);
      if (key === "currency") return new RegExp(`^${isoCurrency}$`).test(value);
      if (key === "expires") return replyFields.shape.expires.safeParse(value).success;
      return value.length <= (key === "scope" || key === "excludes" ? 500 : 100);
    });
    if (allowed.length !== 1) continue;
    const [[value, anchor]] = allowed;
    values[key] = value;
    evidence[key] = anchor;
  }
  if (kind === "price" && !sku && skuLines.length > 1) {
    delete values.amount;
    delete evidence.amount;
  }
  if (kind === "reply" && values.amount && values.currency) values.proof = evidence.amount;
  if (kind === "price" && values.amount && values.currency) values.reference = evidence.amount.split(" · ")[0].slice(0, 200);
  return { values, evidence };
}

export function draftShipment(text: string) {
  const inputs = Object.fromEntries(text.split(/[\r\n；;]+/).flatMap(line => {
    const match = line.match(/^\s*([^:：]{1,35})\s*[:：]\s*(.+?)\s*$/);
    return match ? [[canonical(match[1]), match[2]]] : [];
  }));
  const find = (...keys: string[]) => keys.map(key => inputs[key]).find(Boolean);
  const mode = find("运输方式", "运输", "mode");
  const terms = find("贸易条款", "贸易", "incoterm");
  const packageType = find("包装", "出货包装", "package");
  const dimensions = find("外箱尺寸", "箱规");
  const carton = dimensions || /整箱|外箱/.test(packageType ?? "") ? {
    dimensions, count: Number(find("箱数", "外箱数")), grossKg: Number(find("每箱毛重", "每箱毛重 kg")?.replace(/\s*(kg|千克)$/i, "")),
  } : undefined;
  const modes: Record<string, string> = { 快递: "Courier", 空运: "Air", 海运: "Sea", 铁路: "Rail", 陆运: "Road", 公路: "Road" };
  const candidate = {
    origin: find("起运地", "发货地", "origin"), destination: find("目的地", "收货地", "destination"),
    units: Number(find("件数", "商品总件数", "units")?.replace(/\s*件$/, "")),
    mode: mode ? (modes[mode] ?? ["Courier", "Air", "Sea", "Rail", "Road"].find(item => item.toLowerCase() === mode.toLowerCase())) : undefined,
    ready: find("备货日期", "备货", "ready"), contact: find("货代邮箱", "货代收件邮箱", "email"),
    terms: terms?.toUpperCase(), notes: find("备注", "notes"),
    carton: carton ?? (/单品|独立包装/i.test(packageType ?? "") ? null : undefined),
  };
  return Object.fromEntries(Object.entries(candidate).filter(([key, value]) => {
    if (value === undefined) return false;
    return rfqSchema.shape[key as keyof typeof rfqSchema.shape].safeParse(value).success;
  }));
}

const specLabels = {
  US: ["Dimensions", "Packaged dimensions", "Packaged weight"], GB: ["Dimensions", "Packaged dimensions", "Packaged weight"],
  DE: ["Produktmaße", "Verpackungsmaße", "Gewicht mit Verpackung"], JP: ["商品サイズ", "梱包サイズ", "梱包重量"],
  BR: ["Dimensões do produto", "Dimensões da embalagem", "Peso com embalagem"], MX: ["Dimensiones del producto", "Dimensiones del paquete", "Peso con empaque"],
};

export function listingDraft(input: ReportInput, market: ReportMarket, lines: string[]): AgentDrafts["listing"] {
  const title = lines.find(line => line.startsWith("标题："))?.slice(3).trim();
  const lead = lines.find(line => line.startsWith("首屏文案："))?.slice(5).trim();
  if (!title || !lead || /^(我|帮我|请帮|比较|对比)/.test(input.name)) return undefined;
  const spec = [input.dimensions, input.packagingDimensions, `${input.weightKg} kg`];
  const description = [lead, ...specLabels[market].map((label, index) => `${label}: ${spec[index]}`)].join("\n");
  const draft = listingSchema.partial().safeParse({ title, description });
  return draft.success ? draft.data : undefined;
}

export async function prepareDocuments(scope: string, state: Handoff, input: ReportInput, market: ReportMarket, lines: string[], only?: string, shipment?: string) {
  const previous = state.agent;
  const listing = previous?.listing ?? listingDraft(input, market, lines);
  const agent: AgentDrafts = { ...previous, listing, documents: { ...previous?.documents } };
  if (shipment) agent.shipment = draftShipment(shipment);
  const selected = state.files.filter(file => {
    if (only && file.id !== only) return false;
    if (file.kind === "reply") return file.rfqId === state.rfq?.id && !state.replies.some(reply => reply.file === file.id);
    if (file.kind === "price") return file.id !== state.price?.file;
    return file.kind === "template" && file.id !== state.template?.file;
  }).slice(-8);
  if (only && !state.files.some(file => file.id === only)) throw new HandoffError("找不到这份原件。", 404);
  for (const file of selected) {
    try {
      const bytes = fileData(scope, file);
      if (file.kind === "template") agent.documents[file.id] = await templateDraft(bytes, state.listing ?? listing, state, input);
      else if (file.kind === "price" || file.kind === "reply") {
        const document = await readDocument(bytes, file);
        agent.documents[file.id] = parseFields(file.kind, document.lines, document.tables, state.listing?.sku);
        if (!Object.keys(agent.documents[file.id].values).length) agent.documents[file.id].issue = "没有找到可唯一确认的字段。请核对原件或指定对应商品行。";
      }
    } catch (error) {
      console.warn("读取交付原件失败", file.kind, error instanceof Error ? error.name : "Unknown");
      agent.documents[file.id] = { values: {}, evidence: {}, issue: "未能读取原件内容。请核对文件，扫描件可换成可选中文字的 PDF。" };
    }
  }
  return agent;
}
