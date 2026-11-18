import { existsSync } from "node:fs";
import { createHash } from "node:crypto";
import ExcelJS from "exceljs";
import JSZip from "jszip";
import PDFDocument from "pdfkit";
import { load } from "cheerio";
import { decimal, minorUnits, type Handoff, type UploadInfo } from "./handoff-model";
import { fileData, findFile, HandoffError, today } from "./handoff-store";
import type { CostCheck } from "./mission-model";
import { handoffChannel } from "./handoff-channels";
import { parseDimensions, type ReportInput, type ReportMarket } from "./report-model";

export const excelMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const money = (value: bigint, currency: string) => currency === "JPY" ? (value / 100n).toString() : decimal(value);
export const dhlGuide = "https://www.dhl.com/us-en/home/ship/shipping-faq.html";

type Cell = string | number;
type Sheet = { name: string; headers: string[]; rows: Cell[][] };

async function workbook(sheets: Sheet[]) {
  const book = new ExcelJS.Workbook();
  for (const { name, headers, rows } of sheets) {
    const sheet = book.addWorksheet(name, { views: [{ state: "frozen", ySplit: 1 }] });
    sheet.addRow(headers);
    sheet.addRows(rows.map(row => row.map(value => typeof value === "string" && /^https:\/\/[^\s]+$/.test(value)
      ? { text: value, hyperlink: value } : value)));
    sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F414E" } };
    sheet.getRow(1).height = 24;
    headers.forEach((header, index) => {
      const longest = Math.max(header.length, ...rows.map(row => (String(row[index] ?? "").length)));
      sheet.getColumn(index + 1).width = Math.min(62, Math.max(14, longest + 3));
      sheet.getColumn(index + 1).alignment = { vertical: "middle", wrapText: true };
    });
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
    rows.forEach((row, index) => {
      const lineCount = Math.max(...row.map((cell, col) => Math.max(String(cell).split("\n").length,
        Math.ceil(String(cell).replace(/[^\x00-\x7f]/g, "xx").length / ((sheet.getColumn(col + 1).width ?? 14) - 1)))));
      sheet.getRow(index + 2).height = Math.min(168, Math.max(21, lineCount * 16));
    });
  }
  return Buffer.from(await book.xlsx.writeBuffer());
}

export function channelFile(state: Handoff, input: ReportInput, market: ReportMarket) {
  const channel = handoffChannel(market, input.mexicoMarketplace);
  return workbook([{ name: "渠道跟进", headers: ["目标市场", "站点", "商品", "类目", "申请入口", "注册资料", "来源", "官方客服", "客服说明", "来源日期", "跟进状态", "跟进记录", "状态更新时间"],
    rows: [[market, channel.name, input.name, state.channel?.category ?? state.category, channel.apply, channel.requirements,
      channel.guide, channel.contact, channel.contactNote, channel.sourceDate, state.channel?.status ?? "未申请", state.channel?.reference ?? "", state.channel?.at ?? ""],
    [market, channel.globalName, input.name, state.channel?.category ?? state.category, channel.coverage, "核对该站点所用的区域或当地账户", channel.coverage, "", "", channel.sourceDate, "未申请", "", ""]] }]);
}

export function costFile(cost: CostCheck) {
  const { inputMinor, valuation } = cost;
  const amount = (minor: number | null) => minor === null ? "" : minor / 100;
  return workbook([{ name: "单件测算", headers: ["项目", "金额或数值", "口径"], rows: [
    ["录入时间", cost.createdAt, `V${cost.version}`],
    ["报价和假设来源", cost.source, "项目保存记录"],
    ["成交价", amount(inputMinor.price), cost.currency],
    ["采购", amount(inputMinor.procurement), cost.currency],
    ["物流", amount(inputMinor.logistics), cost.currency],
    ["渠道费用", amount(inputMinor.channelFees), cost.currency],
    ["卖家承担税费", amount(inputMinor.taxes), cost.currency],
    ["获客", amount(inputMinor.acquisition), cost.currency],
    ["单件贡献", amount(cost.contributionMinor), cost.currency],
    ["低价单件贡献", amount(valuation.lowContributionMinor), cost.currency],
    ["高价单件贡献", amount(valuation.highContributionMinor), cost.currency],
    ["汇率", valuation.fxToCny ?? "", [valuation.fxAt, valuation.fxSource].filter(Boolean).join(" · ")],
    ...(valuation.fixedCostMinor === undefined ? [] : [
      ["固定成本", amount(valuation.fixedCostMinor), cost.currency],
      ["盈亏平衡", valuation.breakEvenUnits ?? "无正贡献，无法盈亏平衡", "件"],
    ]),
  ] }]);
}

export async function deliveryZip(files: Record<string, string | Buffer>) {
  const zip = new JSZip();
  for (const [name, data] of Object.entries(files)) zip.file(name, data);
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

export function inquiryFile(state: Handoff, input: ReportInput, market: ReportMarket) {
  const rfq = state.rfq;
  if (!rfq) throw new HandoffError("请先保存询价资料。", 409);
  const pack = rfq.carton;
  const sides = parseDimensions(pack?.dimensions ?? input.packagingDimensions);
  if (!sides || sides.sides.length !== 3) throw new HandoffError("当前包装缺少完整三边尺寸，请更新商品规格或填写实际外箱。");
  return workbook([
    { name: "Shipment", headers: ["RFQ ID", "Product", "Category", "Market", "Origin", "Destination", "Ready date", "Shipping mode", "Incoterm", "Units", "Package type", "Packages", "Length", "Width", "Height", "Unit", "Gross kg per package", "Notes"],
      rows: [[rfq.id, input.name, rfq.category ?? "", market, rfq.origin, rfq.destination, rfq.ready, rfq.mode,
        rfq.terms, rfq.units, pack ? "Shipping carton" : "Individual product package", pack?.count ?? rfq.units, ...sides.sides, sides.unit, pack?.grossKg ?? input.weightKg, rfq.notes]] },
    { name: "Forwarder reply", headers: ["RFQ ID", "Forwarder", "Quote reference", "Currency", "Total shipment freight", "Included charges", "Excluded charges", "Transit", "Valid through (YYYY-MM-DD)", "Conditions"],
      rows: [[rfq.id, "", "", "", "", "", "", "", "", ""]] },
  ]);
}

export function replyComparison(state: Handoff) {
  return workbook([{ name: "货代报价与原件", headers: ["询价编号", "货代", "回单编号", "币种", "整票金额", "包含", "不包含", "时效", "有效至", "跟进", "原件", "原件 SHA-256", "原文依据", "确认时间"],
    rows: state.files.filter(file => file.kind === "reply").map(file => {
      const reply = state.replies.find(item => item.file === file.id);
      const effective = state.rfq?.id === file.rfqId;
      return [file.rfqId ?? "", reply?.forwarder ?? "", reply?.originalRef ?? "", reply?.currency ?? "", reply?.amount ?? "", reply?.scope ?? "",
        reply?.excludes ?? "", reply?.transit ?? "", reply?.expires ?? "", !effective ? "历史询价" : !reply ? "待确认" : reply.expires < today() ? "已过期" :
          state.selected === file.id ? "已采用" : "已确认待选用",
        `原始回单/${file.id}/${file.name}`, file.sha256, reply?.proof ?? "", reply?.at ?? ""];
    }) }]);
}

export function missingFile(state: Handoff, market: ReportMarket, sources: { title: string; url: string; note?: string }[], input?: ReportInput) {
  const channel = handoffChannel(market, input?.mexicoMarketplace);
  return workbook([
    { name: "材料与补件", headers: ["材料名称", "状态", "适用类目", "规则出处", "条款或页面定位", "提交入口", "已收到的原件", "核对日期"],
      rows: state.requirements.map(requirement => {
        const file = state.files.find(item => item.id === requirement.file);
        const category = state.channel?.category ?? state.category;
        return [requirement.name, requirement.category !== undefined && requirement.category !== category ? "历史类目" : file ? "已收到 · 等待渠道审核" : "缺件", requirement.category ?? category,
          requirement.rule, requirement.locator, requirement.submit, file ? `材料原件/${file.id}/${file.name}` : "", requirement.at.slice(0, 10)];
      }) },
    { name: "待确认适用范围", headers: ["目标站点", "状态", "官方参考", "来源链接", "读取情况", "站点提交入口"],
      rows: sources.map(item => [channel.name, "需按站点类目确认适用性", item.title, item.url, item.note ?? "", channel.submit]) },
    { name: "已收资料", headers: ["文件名称", "文件位置", "SHA-256", "上传时间"],
      rows: state.files.filter(file => file.kind === "material").map(file => [file.name, `材料原件/${file.id}/${file.name}`, file.sha256, file.at]) },
  ]);
}

export function quoteInputs(state: Handoff) {
  const { rfq, price, selected } = state;
  const reply = state.replies.find(item => item.file === selected && item.rfqId === rfq?.id);
  if (!rfq || !price || !reply) throw new HandoffError("请确认商家价目表并选用当前询价的货代回单。", 409);
  if (price.expires < today() || reply.expires < today()) throw new HandoffError("商家价格或货代报价已过期，请更新原件并重新确认。", 409);
  if (price.currency !== reply.currency) throw new HandoffError("商品与运费币种不同，请取得同币种的确认原件后生成报价。", 409);
  const priceFile = findFile(state, price.file, "price");
  const replyFile = findFile(state, reply.file, "reply");
  const fingerprint = createHash("sha256").update(JSON.stringify([rfq.id, price, reply, priceFile.sha256, replyFile.sha256])).digest("hex");
  return { rfq, price, reply, priceFile, replyFile, fingerprint };
}

export function quotePdf(state: Handoff) {
  const record = state.quote;
  const { rfq, price, reply, fingerprint } = quoteInputs(state);
  if (!record || record.fingerprint !== fingerprint) throw new HandoffError("请按当前价格和回单重新确认买家报价。", 409);
  const font = process.env.LOCALMATE_QUOTE_FONT || "/System/Library/Fonts/Supplemental/Arial Unicode.ttf";
  const currency = price.currency;
  const unitPrice = minorUnits(price.amount);
  const goods = unitPrice * BigInt(rfq.units);
  const shipping = minorUnits(reply.amount);
  const amount = (value: bigint) => `${currency} ${money(value, currency)}`;
  const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: "Buyer quotation" } });
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", chunk => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    if (existsSync(font)) doc.font(font);
    else if (/[^\x00-\x7f]/.test([record.seller, record.buyer, record.product, record.notes, rfq.origin, rfq.destination, reply.scope, reply.excludes, reply.transit].join(""))) {
      doc.end();
      reject(new HandoffError("此服务缺少多语言 PDF 字体，请设置 LOCALMATE_QUOTE_FONT，或填写买家适用的英文报价文本。", 409));
      return;
    }
    doc.fontSize(23).fillColor("#20424d").text("BUYER QUOTATION").moveDown(.55);
    doc.fontSize(10).fillColor("#1a2226").text(`Reference  ${record.id}`).text(`Issue date  ${record.at.slice(0, 10)}`)
      .text(`Valid through  ${[price.expires, reply.expires].sort()[0]}`).moveDown(1);
    doc.text(`Seller  ${record.seller}`).text(`Buyer  ${record.buyer}`).text(`Product  ${record.product}`).moveDown(1);
    doc.text(`Quantity  ${rfq.units}`).text(`Unit price  ${amount(unitPrice)}`).text(`Goods subtotal  ${amount(goods)}`)
      .text(`Freight  ${amount(shipping)}`).moveDown(.7);
    doc.fontSize(16).fillColor("#20424d").text(`TOTAL  ${amount(goods + shipping)}`).moveDown(.65);
    doc.fontSize(10).fillColor("#1a2226").text(`Shipment  ${rfq.origin} to ${rfq.destination}`)
      .text(`Service  ${rfq.mode} / ${rfq.terms}`).text(`Transit  ${reply.transit}`)
      .text(`Included  ${reply.scope}`).text(`Excluded  ${reply.excludes}`);
    if (record.notes) doc.moveDown(.5).text(record.notes);
    doc.end();
  });
}

export function quoteSources(state: Handoff) {
  const { rfq, price, reply, priceFile, replyFile, fingerprint } = quoteInputs(state);
  if (!state.quote || state.quote.fingerprint !== fingerprint) throw new HandoffError("请重新确认买家报价。", 409);
  return workbook([{ name: "报价追溯", headers: ["报价编号", "询价编号", "金额项目", "币种", "确认金额", "数量口径", "价目行或回单号", "原始文件", "SHA-256", "原文或定位", "确认时间"],
    rows: [[state.quote.id, rfq.id, "商品单价", price.currency, price.amount, rfq.units, price.reference, priceFile.name, priceFile.sha256, price.reference, price.at],
    [state.quote.id, rfq.id, "整票运费", reply.currency, reply.amount, "1 票", reply.originalRef, replyFile.name, replyFile.sha256, reply.proof, reply.at]] }]);
}

export async function withOriginals(scope: string, sheet: Buffer, name: string, directory: string, files: UploadInfo[]) {
  const zip = new JSZip();
  zip.file(name, sheet);
  for (const info of files) zip.file(`${directory}/${info.id}/${info.name}`, fileData(scope, info));
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}

function dimensionCm(value: string) {
  const dimensions = parseDimensions(value);
  if (!dimensions || dimensions.sides.length !== 3) return [];
  const multiplier = { cm: 1, m: 100, mm: .1 }[dimensions.unit];
  return dimensions.sides.map(side => Number((side * multiplier).toFixed(9)));
}

export async function openOffice(bytes: Buffer) {
  // Office files use the ZIP central directory. Reject oversized expansion before inflating.
  let end = bytes.length - 22;
  for (; end >= Math.max(0, bytes.length - 65557); end--) {
    if (bytes.readUInt32LE(end) === 0x06054b50 && end + 22 + bytes.readUInt16LE(end + 20) === bytes.length) break;
  }
  if (end < Math.max(0, bytes.length - 65557)) throw new HandoffError("无法读取 Office 压缩包。");
  let offset = bytes.readUInt32LE(end + 16);
  let total = 0;
  const entries = bytes.readUInt16LE(end + 10);
  if (!entries || entries > 3000 || bytes.readUInt16LE(end + 4) || bytes.readUInt16LE(end + 6)) throw new HandoffError("Office 文件的条目超限。");
  for (let i = 0; i < entries; i++) {
    if (offset + 46 > end || bytes.readUInt32LE(offset) !== 0x02014b50) throw new HandoffError("Office 文件目录无效。");
    total += bytes.readUInt32LE(offset + 24);
    if (total > 80_000_000) throw new HandoffError("Office 文件解压大小超限。");
    offset += 46 + bytes.readUInt16LE(offset + 28) + bytes.readUInt16LE(offset + 30) + bytes.readUInt16LE(offset + 32);
  }
  return JSZip.loadAsync(bytes, { checkCRC32: true }).catch(() => { throw new HandoffError("无法读取 Office 文件。"); });
}

export async function filledTemplate(bytes: Buffer, state: Handoff, input: ReportInput) {
  const template = state.template;
  if (!template || !state.listing) throw new HandoffError("请先确认本地商品文案，再配置模板字段。", 409);
  const zip = await openOffice(bytes);
  const book = await zip.file("xl/workbook.xml")?.async("string");
  const rels = await zip.file("xl/_rels/workbook.xml.rels")?.async("string");
  if (!book || !rels) throw new HandoffError("没有找到原工作簿的工作表。");
  const b = load(book, { xml: true });
  const r = load(rels, { xml: true });
  const [lengthCm, widthCm, heightCm] = dimensionCm(input.dimensions);
  const [packageLengthCm, packageWidthCm, packageHeightCm] = dimensionCm(input.packagingDimensions);
  const fields = { ...state.listing, lengthCm, widthCm, heightCm, packageLengthCm, packageWidthCm, packageHeightCm, packageKg: input.weightKg,
    price: state.price && state.price.expires >= today() ? Number(state.price.amount) : undefined,
    currency: state.price && state.price.expires >= today() ? state.price.currency : undefined };
  const sheets = new Map<string, ReturnType<typeof load>>();
  for (const mapping of template.mappings) {
    const { sheet, field, cell } = mapping;
    const value = field === "custom" ? mapping.custom?.trim() : fields[field];
    if (value === undefined || value === "") throw new HandoffError(`当前没有已确认的「${field}」资料。`);
    const sheetNode = b("sheet").filter((_, item) => b(item).attr("name") === sheet);
    const relId = sheetNode.attr("r:id");
    const target = r("Relationship").filter((_, item) => r(item).attr("Id") === relId && r(item).attr("Type")?.endsWith("/worksheet") === true).attr("Target");
    const path = target?.startsWith("/") ? target.slice(1) : `xl/${target ?? ""}`;
    if (!/^xl\/worksheets\/[\w.-]+\.xml$/.test(path) || sheetNode.attr("state")?.toLowerCase().includes("hidden")) throw new HandoffError(`找不到可填写的工作表 ${sheet}。`);
    if (!sheets.has(path)) {
      const xml = await zip.file(path)?.async("string");
      if (!xml) throw new HandoffError(`无法读取 ${sheet}。`);
      sheets.set(path, load(xml, { xml: true }, false));
    }
    const $ = sheets.get(path)!;
    const rowNumber = Number(cell.replace(/^[A-Z]+/, ""));
    const columnIndex = (ref: string) => ref.match(/^[A-Z]+/)?.[0].split("").reduce((n, letter) => (n * 26 + letter.charCodeAt(0) - 64), 0) ?? 0;
    if (rowNumber < 2 || rowNumber > 1048576 || columnIndex(cell) > 16384) throw new HandoffError("请填写有效的 Excel 商品数据行坐标。");
    const data = $("worksheet > sheetData");
    if (data.length !== 1) throw new HandoffError("原模板工作表缺少数据区。");
    let row = data.children("row").filter((_, item) => Number($(item).attr("r")) === rowNumber);
    if (!row.length) {
      const later = data.children("row").filter((_, item) => Number($(item).attr("r")) > rowNumber).first();
      row = $("<row/>").attr("r", String(rowNumber)) as typeof row;
      if (later.length) later.before(row);
      else data.append(row);
    }
    let node = row.children("c").filter((_, item) => $(item).attr("r") === cell);
    if (!node.length) {
      const after = row.children("c").filter((_, item) => columnIndex($(item).attr("r") ?? "") > columnIndex(cell)).first();
      node = $("<c/>").attr("r", cell) as typeof node;
      if (after.length) after.before(node);
      else row.append(node);
    }
    const dimension = $("worksheet > dimension");
    const [first, last = first] = (dimension.attr("ref") ?? "").split(":");
    if (first && last) {
      const column = (reference: string) => reference.match(/^[A-Z]+/)?.[0] ?? "A";
      const rowIndex = (reference: string) => Number(reference.replace(/^[A-Z]+/, ""));
      const left = column(columnIndex(cell) < columnIndex(first) ? cell : first);
      const right = column(columnIndex(cell) > columnIndex(last) ? cell : last);
      dimension.attr("ref", `${left}${Math.min(rowIndex(first), rowNumber)}:${right}${Math.max(rowIndex(last), rowNumber)}`);
    }
    if (node.children("f").length) throw new HandoffError(`不能覆盖 ${sheet}! ${cell} 的公式。`);
    node.children("v,is").remove();
    if (typeof value === "number") node.removeAttr("t").append($("<v/>").text(String(value)));
    else node.attr("t", "inlineStr").append($("<is/>").append($("<t/>").attr("xml:space", "preserve").text(value)));
  }
  sheets.forEach(($, path) => zip.file(path, $.xml()));
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
}
