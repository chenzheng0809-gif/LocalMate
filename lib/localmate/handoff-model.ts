import { z } from "zod";
import { reportDimensions } from "./report-model";

const text = (max: number) => z.string().trim().min(1).max(max);
const optional = (max: number) => z.string().trim().max(max).default("");
const id = z.string().uuid();
const date = z.string().date();
const cash = z.string().trim().regex(/^\d{1,9}(?:\.\d{1,2})?$/, "金额请填写原单上的数字，最多两位小数。");
const currency = z.enum(["CNY", "USD", "EUR", "GBP", "MXN", "BRL", "JPY", "HKD", "CAD", "SGD", "CHF", "AUD"]);
const positiveInt = z.number().int().positive().max(10_000_000);
const source = z.string().url().max(600).refine(value => value.startsWith("https://"), "请填写 HTTPS 规则出处。");
export const channels = ["未申请", "已申请", "沟通中", "已通过", "申请未通过"] as const;
export const fileKinds = ["price", "reply", "template", "material"] as const;
export type FileKind = typeof fileKinds[number];

export const copyFields = ["title", "description", "sku", "brand", "gtin", "lengthCm", "widthCm", "heightCm", "packageLengthCm", "packageWidthCm", "packageHeightCm", "packageKg", "price", "currency"] as const;
export const templateMapping = z.object({
  sheet: text(31), field: z.enum([...copyFields, "custom"]), cell: z.string().trim().toUpperCase().regex(/^[A-Z]{1,3}[1-9]\d{0,6}$/),
  custom: optional(1000),
});
const cargo = z.object({
  dimensions: text(100).refine(reportDimensions, "请填写实际运输外箱的长、宽、高。"),
  count: positiveInt,
  grossKg: z.number().positive().max(100_000),
});
export const rfqSchema = z.object({
  contact: z.string().trim().email().max(254).optional().or(z.literal("")),
  origin: text(180), destination: text(180), units: positiveInt, mode: z.enum(["Courier", "Air", "Sea", "Rail", "Road"]),
  ready: date, terms: z.enum(["EXW", "FCA", "FOB", "CFR", "CIF", "CPT", "CIP", "DAP", "DPU", "DDP"]),
  notes: optional(500), carton: cargo.nullable(),
});
export const listingOption = z.object({
  title: text(200), slogan: text(120), description: text(2000),
  reason: text(150).refine(value => /[\u3400-\u9fff]/.test(value), "reason must explain the focus in Simplified Chinese"),
});
export const listingOptions = z.tuple([listingOption, listingOption, listingOption]);
export type ListingOption = z.infer<typeof listingOption>;
export const listingSchema = z.object({
  title: text(200), description: text(2500), sku: text(100), brand: optional(100),
  gtin: z.string().trim().regex(/^(?:\d{8}|\d{12,14})?$/).default(""),
});
export const replyFields = z.object({
  forwarder: text(100), originalRef: text(140), currency, amount: cash, scope: text(500),
  excludes: text(500), transit: text(100), expires: date, proof: text(1000),
});
export const commandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("channel"), category: text(150), status: z.enum(channels), reference: optional(500) }),
  z.object({ type: z.literal("listing"), listing: listingSchema }),
  z.object({ type: z.literal("draft-copy"), facts: z.string().trim().max(2000).default(""), automatic: z.boolean().optional() }),
  z.object({ type: z.literal("extract"), file: id }),
  z.object({ type: z.literal("scan-rules") }),
  z.object({ type: z.literal("prepare"), file: id.optional(), shipment: optional(2500) }),
  z.object({ type: z.literal("rfq"), rfq: rfqSchema }),
  z.object({ type: z.enum(["send", "sent"]), rfqId: id }),
  z.object({ type: z.literal("price"), file: id, currency, amount: cash, reference: text(200), expires: date }),
  z.object({ type: z.literal("reply"), file: id, rfqId: id, reply: replyFields }),
  z.object({ type: z.literal("select"), file: id, rfqId: id }),
  z.object({ type: z.literal("quote"), rfqId: id, seller: text(100), buyer: text(100), product: text(170), notes: optional(500) }),
  z.object({ type: z.literal("requirement"), name: text(140), rule: source, submit: source, locator: text(500), file: id.nullable() }),
  z.object({ type: z.literal("template"), file: id, mappings: z.array(templateMapping).min(1).max(80) }),
]);
export type Command = z.infer<typeof commandSchema>;
export type UploadInfo = { id: string; kind: FileKind; name: string; mime: string; size: number; sha256: string; at: string; rfqId?: string };
type Payload<K extends Command["type"]> = Omit<Extract<Command, { type: K }>, "type">;
export type Rfq = z.infer<typeof rfqSchema> & {
  id: string; at: string; category?: string; mail?: { status: "sending" | "accepted" | "recorded" | "unknown"; at: string; id?: string };
};
export type Reply = z.infer<typeof replyFields> & { file: string; rfqId: string; at: string };
export type RuleCandidate = { name: string; rule: string; locator: string; submit: string };
export type ShipmentDraft = Partial<z.infer<typeof rfqSchema>>;
export type TemplateMapping = z.infer<typeof templateMapping>;
export type DocumentDraft = {
  values: Record<string, string>;
  evidence: Record<string, string>;
  mappings?: TemplateMapping[];
  issue?: string;
};
export type AgentDrafts = {
  listing?: Partial<z.infer<typeof listingSchema>>;
  shipment?: ShipmentDraft;
  rules?: RuleCandidate[];
  ruleCategory?: string;
  ruleIssue?: string;
  documents: Record<string, DocumentDraft>;
};
export type Handoff = {
  version: number;
  agent?: AgentDrafts;
  category: string;
  channel?: Payload<"channel"> & { at: string };
  listing?: z.infer<typeof listingSchema> & { at: string };
  rfq?: Rfq;
  price?: Payload<"price"> & { at: string };
  replies: Reply[];
  selected?: string;
  quote?: Payload<"quote"> & { id: string; at: string; fingerprint: string };
  requirements: Array<Payload<"requirement"> & { at: string; category?: string }>;
  template?: Payload<"template">;
  files: UploadInfo[];
};

export function minorUnits(amount: string) {
  const [whole, fraction = ""] = amount.split(".");
  return BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
}
export function decimal(amount: bigint) {
  return `${amount / 100n}.${String(amount % 100n).padStart(2, "0")}`;
}
