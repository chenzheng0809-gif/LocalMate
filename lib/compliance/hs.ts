import { createFetchClient, getFetchClient } from "@/lib/search/fetch-client";
import { nowIso, uid } from "@/lib/db/client";
import type {
  ComplianceData,
  Country,
  HSCandidate,
  ProductDNA,
  Evidence,
} from "@/types/domain";
import { clamp } from "@/lib/utils/money";

function digits(code: string): string {
  return code.replace(/\D/g, "");
}

function normalizeDescription(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export interface HsVerificationResult {
  candidates: HSCandidate[];
  evidence: Evidence[];
  sources: ComplianceData["officialSources"];
  trace: { step: string; status: "OK" | "DEGRADED" | "SKIPPED" | "FAILED"; detail: string }[];
}

export function buildHsCandidates(product: ProductDNA): HSCandidate[] {
  const material = `${product.attributes.material ?? ""}`.toLowerCase();
  const name = product.name.toLowerCase();
  const candidates: Array<{ code: string; description: string; rationale: string; confidence: HSCandidate["confidence"] }> = [];

  if (/bamboo|竹/.test(material)) {
    candidates.push({
      code: "4420.90",
      description: "Articles of wood; other articles (including bamboo-derived articles, subject to scope)",
      rationale: "许多税则把竹视为木材衍生材料；4420 目是合理的起点。",
      confidence: "MEDIUM",
    });
    candidates.push({
      code: "4602.11",
      description: "Basketwork, wickerwork and other articles of bamboo",
      rationale: "如果该商品是竹编结构而非木制品，可考虑此替代项。",
      confidence: "LOW",
    });
  } else if (/wood|walnut|oak|木|holz/.test(material)) {
    candidates.push({
      code: "4420.90",
      description: "Other articles of wood",
      rationale: "木制桌面收纳盒通常按 4420 目审查；最终子目取决于商品结构。",
      confidence: "MEDIUM",
    });
    if (/shelf|rack|stand|regal|棚|ラック/.test(name) || product.category === "SHELF_RACK") {
      candidates.push({
        code: "9403.60",
        description: "Other wooden furniture",
        rationale: "如果海关将其视为家具而非小件木制品，可考虑此替代项。",
        confidence: "LOW",
      });
    }
  } else if (/metal|steel|iron|金属|metall|stahl/.test(material)) {
    candidates.push({
      code: "7326.90",
      description: "Other articles of iron or steel",
      rationale: "不属于特定列名商品的金属收纳件，可能归入钢铁残余目。",
      confidence: "MEDIUM",
    });
    candidates.push({
      code: "9403.20",
      description: "Other metal furniture",
      rationale: "如果该商品被归类为家具而非家居用品，可考虑此替代项。",
      confidence: "LOW",
    });
  } else if (/fabric|canvas|textile|布|stoff/.test(material)) {
    candidates.push({
      code: "6307.90",
      description: "Other made-up textile articles",
      rationale: "纺织收纳用品常按制成品残余目审查。",
      confidence: "LOW",
    });
  } else {
    candidates.push({
      code: "3924.90",
      description: "Other household articles of plastics",
      rationale: "非电动塑料家居收纳用品通常按 3924 目审查。",
      confidence: material ? "MEDIUM" : "LOW",
    });
    candidates.push({
      code: "4420.90",
      description: "Other articles of wood",
      rationale: "如果材料实际为木材或木材衍生复合材料，可考虑此替代项。",
      confidence: "LOW",
    });
  }

  if (product.category === "DESK_ORGANIZER" && !candidates.some((candidate) => candidate.code === "3926.10") && /plastic|resin|acrylic|塑料|树脂/.test(material)) {
    candidates.push({
      code: "3926.10",
      description: "Office or school supplies of plastics",
      rationale: "塑料桌面收纳盒若定位为办公/学习用品，可考虑此替代项。",
      confidence: "LOW",
    });
  }

  const unique = new Map<string, (typeof candidates)[number]>();
  for (const candidate of candidates) if (!unique.has(candidate.code)) unique.set(candidate.code, candidate);
  return Array.from(unique.values()).slice(0, 3).map((candidate) => ({
    ...candidate,
    verified: false,
    verificationNote: "尚未对照官方税则来源核实。",
    evidenceIds: [],
  }));
}

async function verifyUsCandidate(code: string, fallbackDescription: string, productId: string, country: Country): Promise<{ candidate: HSCandidate; evidence: Evidence; sourceUrl: string } | null> {
  const query = encodeURIComponent(code);
  const url = `https://hts.usitc.gov/reststop/search?keyword=${query}`;
  const result = await getFetchClient().fetchJson<Array<Record<string, unknown>>>(url);
  if (!result.ok || !Array.isArray(result.data)) return null;
  const target = digits(code);
  const rows = result.data.filter((row) => typeof row.htsno === "string");
  const exact = rows.find((row) => digits(String(row.htsno)) === target && row.general);
  const child = rows.find((row) => digits(String(row.htsno)).startsWith(target) && row.general);
  const heading = rows.find((row) => digits(String(row.htsno)) === target);
  const row = exact ?? child ?? heading;
  if (!row) return null;
  const htsno = String(row.htsno);
  const officialLineDescription = normalizeDescription(String(row.description ?? ""));
  const general = row.general ? String(row.general) : "see HTSUS";
  const verified = Boolean(exact);
  const evidence: Evidence = {
    id: uid("ev"),
    productId,
    country,
    kind: "COMPLIANCE",
    sourceUrl: url,
    sourceTitle: "USITC HTSUS search",
    sourceDomain: "hts.usitc.gov",
    retrievedAt: nowIso(),
    relevantExcerpt: `${htsno} — ${officialLineDescription}. General duty: ${general}. (Official USITC HTS search response; this is an example line under the candidate heading, not a binding classification.)`,
    evidenceType: "OFFICIAL_TARIFF",
    claimSupported: `Official USITC data lists ${htsno} under the candidate HS ${code} family.`,
    verificationStatus: verified ? "VERIFIED" : "PARTIALLY_VERIFIED",
    origin: "OFFICIAL_SOURCE",
    metadata: { htsno, general, matchedCode: code },
    createdAt: nowIso(),
  };
  return {
    candidate: {
      code,
      description: fallbackDescription,
      rationale: `USITC 官方查询返回 ${htsno} 行，这是 ${code} 家族下的示例。${verified ? "精确编码已确认；产品特定的统计后缀仍需报关行确认。" : "只匹配到编码家族；产品特定子目仍未解决。"}`,
      confidence: verified ? "HIGH" : "MEDIUM",
      verified,
      verificationNote: verified ? `USITC HTSUS 对 ${htsno} 的响应；不是有约束力的裁定。` : `官方响应只包含示例行 ${htsno}；不能证明该行适用于此产品。`,
      evidenceIds: [evidence.id],
      countrySpecificNote: "美国 HTSUS；税率因原产地和贸易计划而异。",
    },
    evidence,
    sourceUrl: url,
  };
}

async function verifyUkCandidate(code: string, fallbackDescription: string, productId: string, country: Country): Promise<{ candidate: HSCandidate; evidence: Evidence; sourceUrl: string } | null> {
  const heading = digits(code).slice(0, 4);
  const apiUrl = `https://www.trade-tariff.service.gov.uk/api/v2/headings/${heading}`;
  const result = await getFetchClient().fetchJson<{ data?: unknown; included?: Array<Record<string, unknown>> }>(apiUrl);
  if (!result.ok || !result.data) return null;
  const included = result.data.included ?? [];
  const target = digits(code);
  const commodities = included
    .filter((item) => item.type === "commodity")
    .map((item) => ({ item, attrs: (item.attributes ?? {}) as Record<string, unknown> }));
  const match =
    commodities.find(({ attrs }) => digits(String(attrs.goods_nomenclature_item_id ?? "")).startsWith(target) && String(attrs.description ?? "").length > 0) ??
    commodities.find(({ attrs }) => digits(String(attrs.goods_nomenclature_item_id ?? "")).startsWith(heading));
  if (!match) return null;
  const attrs = match.attrs;
  const itemId = String(attrs.goods_nomenclature_item_id ?? code);
  const officialLineDescription = normalizeDescription(String(attrs.formatted_description ?? attrs.description ?? ""));
  const display = itemId.replace(/^(\d{4})(\d{2})(\d{2})(\d{2})$/, "$1.$2.$3.$4");
  const exact = digits(itemId).length === target.length && digits(itemId) === target;
  const evidence: Evidence = {
    id: uid("ev"),
    productId,
    country,
    kind: "COMPLIANCE",
    sourceUrl: `https://www.trade-tariff.service.gov.uk/headings/${heading}`,
    sourceTitle: "UK Trade Tariff heading",
    sourceDomain: "trade-tariff.service.gov.uk",
    retrievedAt: nowIso(),
    relevantExcerpt: `${display} — ${officialLineDescription}. Official UK Trade Tariff heading data; this is an example commodity under the candidate heading, not a binding classification.`,
    evidenceType: "OFFICIAL_TARIFF",
    claimSupported: `Official UK Trade Tariff data lists ${display} under the candidate HS ${code} family.`,
    verificationStatus: exact ? "VERIFIED" : "PARTIALLY_VERIFIED",
    origin: "OFFICIAL_SOURCE",
    metadata: { itemId, heading, matchedCode: code },
    createdAt: nowIso(),
  };
  return {
    candidate: {
      code,
      description: fallbackDescription,
      rationale: `英国贸易关税目 ${heading} 包含示例商品 ${display}。${exact ? "精确编码已确认；完整商品编码和措施仍需报关行确认。" : "只匹配到目级家族；产品特定商品编码仍未解决。"}`,
      confidence: exact ? "HIGH" : "MEDIUM",
      verified: exact,
      verificationNote: exact ? "英国贸易关税目 API 匹配；不是有约束力的归类。" : `API 响应只包含示例商品 ${display}；不能证明该行适用于此产品。`,
      evidenceIds: [evidence.id],
      countrySpecificNote: "英国全球关税；原产地和贸易优惠会影响最终税率。",
    },
    evidence,
    sourceUrl: `https://www.trade-tariff.service.gov.uk/headings/${heading}`,
  };
}

async function verifyJpCandidates(
  candidates: HSCandidate[],
  productId: string,
  country: Country,
): Promise<Array<{ candidate: HSCandidate; evidence: Evidence; sourceUrl: string }>> {
  const client = createFetchClient({
    timeoutMs: 60_000,
    maxBytes: 3_500_000,
    maxChars: 500_000,
    userAgent: "ProductPassportBot/1.0 (+research; official tariff lookup)",
    cacheTtlMs: 24 * 60 * 60 * 1000,
  });
  const groups = new Map<string, HSCandidate[]>();
  for (const candidate of candidates) {
    const chapter = digits(candidate.code).slice(0, 2);
    groups.set(chapter, [...(groups.get(chapter) ?? []), candidate]);
  }
  const out: Array<{ candidate: HSCandidate; evidence: Evidence; sourceUrl: string }> = [];
  for (const [chapter, group] of groups) {
    const url = `https://www.customs.go.jp/english/tariff/2026_10_31/data/e_${chapter}.htm`;
    const page = await client.fetchPage(url, { cache: true });
    if (!page.ok) continue;
    for (const candidate of group) {
      const codePattern = candidate.code.replace(".", ".");
      const index = page.text.indexOf(codePattern);
      if (index < 0) continue;
      const excerpt = page.text.slice(Math.max(0, index - 120), index + 420).replace(/\s+/g, " ").trim();
      const evidence: Evidence = {
        id: uid("ev"),
        productId,
        country,
        kind: "COMPLIANCE",
        sourceUrl: url,
        sourceTitle: `Japan Customs tariff, chapter ${chapter}`,
        sourceDomain: "customs.go.jp",
        retrievedAt: nowIso(),
        relevantExcerpt: excerpt,
        evidenceType: "OFFICIAL_TARIFF",
        claimSupported: `Official Japan Customs tariff page contains candidate code ${candidate.code}.`,
        verificationStatus: "VERIFIED",
        origin: "OFFICIAL_SOURCE",
        metadata: { code: candidate.code, chapter },
        createdAt: nowIso(),
      };
      out.push({
        candidate: {
          ...candidate,
          verified: true,
          confidence: "MEDIUM",
          verificationNote: "日本海关税则页面包含候选编码；统计后缀和原产地税率仍需报关行确认。",
          evidenceIds: [evidence.id],
          countrySpecificNote: "日本税则；WTO/最惠国税率与 EPA 税率可能不同。",
        },
        evidence,
        sourceUrl: url,
      });
    }
  }
  return out;
}

export async function verifyHsCandidates(
  product: ProductDNA,
  country: Country,
): Promise<HsVerificationResult> {
  const candidates = buildHsCandidates(product);
  const evidence: Evidence[] = [];
  const sources: ComplianceData["officialSources"] = [];
  const trace: HsVerificationResult["trace"] = [];
  const updated: HSCandidate[] = [];

  for (const candidate of candidates) {
    try {
      let result: { candidate: HSCandidate; evidence: Evidence; sourceUrl: string } | null = null;
      if (country === "US") result = await verifyUsCandidate(candidate.code, candidate.description, product.id, country);
      else if (country === "UK") result = await verifyUkCandidate(candidate.code, candidate.description, product.id, country);
      else if (country === "JP") {
        // grouped below to avoid refetching the chapter page per candidate
        continue;
      } else {
        updated.push({
          ...candidate,
          verificationNote:
            "无法自动完成 EU TARIC 查询。该编码只是研究线索；请与欧盟报关行确认。",
          confidence: "LOW",
        });
        continue;
      }
      if (result) {
        updated.push(result.candidate);
        evidence.push(result.evidence);
        sources.push({
          title: `${country === "US" ? "USITC HTSUS" : "UK Trade Tariff"} lookup — HS ${result.candidate.code}`,
          url: result.sourceUrl,
          domain: new URL(result.sourceUrl).hostname.replace(/^www\./, ""),
          retrievedAt: result.evidence.retrievedAt,
          status: "FETCHED",
          evidenceId: result.evidence.id,
        });
      } else {
        updated.push({
          ...candidate,
          verificationNote: "官方税则查询没有返回可用匹配；保留为未验证候选。",
          confidence: "LOW",
        });
      }
    } catch (error) {
      updated.push({
        ...candidate,
        verificationNote: `官方税则查询失败：${error instanceof Error ? error.message.slice(0, 180) : "未知错误"}。`,
        confidence: "LOW",
      });
    }
  }

  if (country === "JP") {
    try {
      const jp = await verifyJpCandidates(candidates, product.id, country);
      const byCode = new Map(jp.map((item) => [item.candidate.code, item]));
      for (const candidate of candidates) {
        const match = byCode.get(candidate.code);
        if (match) {
          updated.push(match.candidate);
          evidence.push(match.evidence);
          sources.push({
            title: `Japan Customs tariff — HS ${match.candidate.code}`,
            url: match.sourceUrl,
            domain: "customs.go.jp",
            retrievedAt: match.evidence.retrievedAt,
            status: "FETCHED",
            evidenceId: match.evidence.id,
          });
        } else {
          updated.push({
            ...candidate,
            verificationNote: "日本海关税则页面没有返回该编码的可用匹配。",
            confidence: "LOW",
          });
        }
      }
    } catch (error) {
      for (const candidate of candidates) {
        updated.push({
          ...candidate,
          verificationNote: `日本海关查询失败：${error instanceof Error ? error.message.slice(0, 180) : "未知错误"}。`,
          confidence: "LOW",
        });
      }
    }
  }

  const anyVerified = updated.some((candidate) => candidate.verified);
  trace.push({
    step: "hs-candidates",
    status: anyVerified ? "OK" : "DEGRADED",
    detail: `${updated.length} 个候选；其中 ${updated.filter((candidate) => candidate.verified).length} 个已对照官方税则来源验证。`,
  });
  return { candidates: updated, evidence, sources, trace };
}

export function primaryHsConfidence(candidates: HSCandidate[]): number {
  const verified = candidates.filter((candidate) => candidate.verified).length;
  return clamp(verified > 0 ? 80 + verified * 5 : 30, 0, 100);
}
