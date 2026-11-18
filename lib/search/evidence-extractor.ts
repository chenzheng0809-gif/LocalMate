import type {
  Country,
  Evidence,
  EvidenceOrigin,
  EvidenceType,
  VerificationStatus,
} from "@/types/domain";
import type { SearchResult } from "@/lib/search/types";
import { nowIso, uid } from "@/lib/db/client";
import { truncate } from "@/lib/utils/text";

export function evidenceFromSearchResult(input: {
  productId: string;
  country: Country;
  result: SearchResult;
  claimSupported: string;
  kind?: Evidence["kind"];
  evidenceType?: EvidenceType;
}): Evidence {
  const { result } = input;
  return {
    id: uid("ev"),
    productId: input.productId,
    country: input.country,
    kind: input.kind ?? "MARKET",
    sourceUrl: result.url,
    sourceTitle: result.title,
    sourceDomain: result.domain,
    retrievedAt: result.retrievedAt,
    relevantExcerpt: truncate(result.snippet, 700),
    evidenceType: input.evidenceType ?? "MARKET_REPORT",
    claimSupported: input.claimSupported,
    verificationStatus: result.verificationStatus,
    origin: result.origin,
    metadata: {
      provider: result.provider,
      observedPrice: result.observedPrice ?? null,
      currency: result.currency ?? null,
      rating: result.rating ?? null,
      reviewCount: result.reviewCount ?? null,
      imageUrl: result.imageUrl ?? null,
      brand: result.brand ?? null,
      sourceTitle: result.title,
    },
    createdAt: nowIso(),
  };
}

export function evidenceFromOfficialPage(input: {
  productId: string;
  country: Country;
  url: string;
  title: string;
  domain: string;
  retrievedAt: string;
  excerpt: string;
  claimSupported: string;
  evidenceType?: EvidenceType;
  verificationStatus?: VerificationStatus;
  origin?: EvidenceOrigin;
}): Evidence {
  return {
    id: uid("ev"),
    productId: input.productId,
    country: input.country,
    kind: "COMPLIANCE",
    sourceUrl: input.url,
    sourceTitle: input.title,
    sourceDomain: input.domain,
    retrievedAt: input.retrievedAt,
    relevantExcerpt: truncate(input.excerpt, 1200),
    evidenceType: input.evidenceType ?? "OFFICIAL_GUIDANCE",
    claimSupported: input.claimSupported,
    verificationStatus: input.verificationStatus ?? "PARTIALLY_VERIFIED",
    origin: input.origin ?? "OFFICIAL_SOURCE",
    metadata: {},
    createdAt: nowIso(),
  };
}

export function evidenceFromUserInput(input: {
  productId: string;
  claimSupported: string;
  excerpt: string;
}): Evidence {
  return {
    id: uid("ev"),
    productId: input.productId,
    country: null,
    kind: "MARKET",
    sourceUrl: null,
    sourceTitle: "User-confirmed product brief",
    sourceDomain: "user-input",
    retrievedAt: nowIso(),
    relevantExcerpt: input.excerpt,
    evidenceType: "USER_INPUT",
    claimSupported: input.claimSupported,
    verificationStatus: "VERIFIED",
    origin: "USER_INPUT",
    metadata: {},
    createdAt: nowIso(),
  };
}
