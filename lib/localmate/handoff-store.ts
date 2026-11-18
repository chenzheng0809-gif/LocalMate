import { createHash, randomUUID } from "node:crypto";
import { getDb } from "@/lib/db/client";
import { listingOptions, type FileKind, type Handoff, type ListingOption, type UploadInfo } from "./handoff-model";

export class HandoffError extends Error {
  constructor(message: string, readonly status = 422) { super(message); }
}
export const today = () => new Date().toISOString().slice(0, 10);

export function getHandoff(scope: string, category = ""): Handoff {
  const row = getDb().prepare("SELECT snapshot FROM localmate_handoffs WHERE scope = ?").get(scope);
  return row ? JSON.parse(String(row.snapshot)) : { version: 0, category, replies: [], files: [], requirements: [] };
}

function listingVariantRow(scope: string) {
  return getDb().prepare("SELECT variants FROM localmate_listing_variants WHERE scope = ?").get(scope);
}

function parseListingVariants(snapshot: unknown) {
  if (typeof snapshot !== "string") return undefined;
  const result = listingOptions.safeParse(JSON.parse(snapshot));
  return result.success ? result.data : undefined;
}

export function getListingVariants(scope: string) {
  return parseListingVariants(listingVariantRow(scope)?.variants);
}

export function saveListingVariants(scope: string, variants: ListingOption[], automatic: boolean) {
  const snapshot = JSON.stringify(listingOptions.parse(variants));
  const db = getDb();
  if (automatic) {
    const previous = listingVariantRow(scope)?.variants;
    const existing = parseListingVariants(previous);
    if (existing) return existing;
    db.prepare(`INSERT INTO localmate_listing_variants VALUES (?, ?)
      ON CONFLICT(scope) DO UPDATE SET variants = excluded.variants
      WHERE localmate_listing_variants.variants IS ?`).run(scope, snapshot, previous ?? null);
  } else {
    db.prepare(`INSERT INTO localmate_listing_variants VALUES (?, ?)
      ON CONFLICT(scope) DO UPDATE SET variants = excluded.variants`).run(scope, snapshot);
  }
  return getListingVariants(scope);
}

export function saveHandoff(scope: string, next: Handoff, data?: { id: string; bytes: Buffer }) {
  const db = getDb();
  const version = next.version;
  const updated = { ...next, version: version + 1 };
  db.exec("BEGIN IMMEDIATE");
  try {
    const row = db.prepare("SELECT version FROM localmate_handoffs WHERE scope = ?").get(scope);
    if (Number(row?.version ?? 0) !== version) throw new HandoffError("交付数据已更新，请刷新后重试。", 409);
    if (data) db.prepare("INSERT INTO localmate_handoff_files VALUES (?, ?, ?)").run(scope, data.id, data.bytes);
    db.prepare("INSERT INTO localmate_handoffs VALUES (?, ?, ?) ON CONFLICT(scope) DO UPDATE SET version = excluded.version, snapshot = excluded.snapshot")
      .run(scope, updated.version, JSON.stringify(updated));
    db.exec("COMMIT");
    return updated;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

export function findFile(state: Handoff, id: string, kind?: FileKind) {
  const info = state.files.find(file => file.id === id && (!kind || file.kind === kind));
  if (!info) throw new HandoffError("找不到这个原始文件。", 404);
  return info;
}
export function fileData(scope: string, info: UploadInfo) {
  const row = getDb().prepare("SELECT data FROM localmate_handoff_files WHERE scope = ? AND id = ?").get(scope, info.id);
  if (!(row?.data instanceof Uint8Array)) throw new HandoffError("原始文件读取失败。", 404);
  return Buffer.from(row.data);
}

export function attachment(state: Handoff, kind: FileKind, rfqId: string, file: File, bytes: Buffer): UploadInfo {
  const name = file.name.replace(/[\/\\\u0000-\u001f\u007f<>:"|?*]/g, "_").slice(-150);
  const ext = name.toLowerCase().split(".").at(-1);
  const mime = ext === "pdf" && bytes.subarray(0, 5).toString() === "%PDF-" ? "application/pdf"
    : ext === "txt" && !bytes.includes(0) ? "text/plain; charset=utf-8"
    : ext === "csv" && !bytes.includes(0) ? "text/csv; charset=utf-8"
    : (ext === "xlsx" || ext === "xlsm" || ext === "docx") && bytes.subarray(0, 4).equals(Buffer.from([80, 75, 3, 4]))
      ? ext === "xlsm" ? "application/vnd.ms-excel.sheet.macroEnabled.12" : ext === "xlsx"
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      : null;
  if (!mime || (kind === "template" && ext !== "xlsx" && ext !== "xlsm")) throw new HandoffError("请选择有效的 PDF、Excel、Word、CSV 或文本文件。上架模板须为 .xlsx 或 .xlsm。");
  if (kind === "reply" && (!state.rfq || state.rfq.id !== rfqId)) throw new HandoffError("请为当前询价上传原始回单。", 409);
  if (state.files.length >= 50 || state.files.reduce((total, item) => total + item.size, bytes.length) > 50_000_000) throw new HandoffError("该市场的附件额度为 50 个文件及 50 MB。", 413);
  return { id: randomUUID(), kind, name, mime, size: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"),
    at: new Date().toISOString(), ...(kind === "reply" ? { rfqId } : {}) };
}
