import { describe, expect, it } from "vitest";
import { isComparableResult } from "@/lib/market/service";
import type { SearchResult } from "@/lib/search/types";
import { makeProduct } from "./fixtures";

function result(overrides: Partial<SearchResult>): SearchResult {
  return {
    title: "Wooden desk organizer",
    url: "https://www.ikea.com/us/en/p/test",
    snippet: "A desk organizer for the home office.",
    domain: "ikea.com",
    provider: "test",
    retrievedAt: new Date().toISOString(),
    origin: "IMPORTED_LOCAL_RESEARCH",
    verificationStatus: "IMPORTED_SNAPSHOT",
    observedPrice: 24.99,
    currency: "USD",
    ...overrides,
  };
}

describe("comparator eligibility", () => {
  const product = makeProduct();

  it("rejects accessory-tier prices even when the listing is in-category", () => {
    expect(isComparableResult(product, "US", result({ observedPrice: 0.29 }))).toBe(false);
    expect(isComparableResult(product, "JP", result({ observedPrice: 399, currency: "JPY", title: "BAXNA organizer" }))).toBe(false);
  });

  it("rejects kitchen or off-category listings for a desk organizer", () => {
    expect(isComparableResult(product, "US", result({ title: "Kitchen countertop organizer" }))).toBe(false);
    expect(isComparableResult(product, "US", result({ title: "Bathroom shelf", snippet: "bathroom storage" }))).toBe(false);
  });

  it("keeps a genuine desk organizer in the right price band and currency", () => {
    expect(isComparableResult(product, "US", result({}))).toBe(true);
    expect(isComparableResult(product, "US", result({ currency: "EUR" }))).toBe(false);
  });
});
