import { describe, expect, it } from "vitest";
import { competitionMetric, demandMetric, median, productMarketFitMetric } from "@/lib/market/metrics";
import { buildPricingScenario } from "@/lib/market/pricing";
import { makeFx, makeProduct } from "./fixtures";
import type { Competitor } from "@/types/domain";

function competitor(index: number, price = 40): Competitor {
  return {
    name: `Wooden desk organizer ${index}`,
    productType: "Desk organizer",
    price,
    currency: "USD",
    brand: "Test",
    keySellingPoints: ["walnut", "drawer", "storage"],
    url: `https://example.com/${index}`,
    rating: 4.5,
    reviewCount: 100 * index,
    sourceEvidenceId: `ev_${index}`,
    dataOrigin: "RETAIL_PROBE",
  };
}

describe("market metrics", () => {
  it("computes a median without mutating input", () => {
    const values = [3, 1, 2];
    expect(median(values)).toBe(2);
    expect(values).toEqual([3, 1, 2]);
    expect(median([])).toBeNull();
  });

  it("returns null demand instead of a default 50 when evidence is thin", () => {
    const result = demandMetric([competitor(1)], ["ev_1"]);
    expect(result.metric.score).toBeNull();
    expect(result.signals.level).toBe("NOT_ENOUGH_DATA");
  });

  it("scores demand from at least two listings with ratings", () => {
    const result = demandMetric([competitor(1), competitor(2), competitor(3)], ["ev_1"]);
    expect(result.metric.score).not.toBeNull();
    expect(result.metric.score).toBeGreaterThan(0);
    expect(result.signals.level).not.toBe("NOT_ENOUGH_DATA");
  });

  it("returns null competitive room with fewer than two comparables", () => {
    expect(competitionMetric([competitor(1)], ["ev_1"]).metric.score).toBeNull();
    expect(competitionMetric([competitor(1), competitor(2)], ["ev_1"]).metric.score).not.toBeNull();
  });

  it("computes a keyword-overlap fit and flags it as a hypothesis", () => {
    const product = makeProduct();
    const fit = productMarketFitMetric(product, [competitor(1), competitor(2)], ["ev_1"]);
    expect(fit.score).not.toBeNull();
    expect(fit.confidence).toBe("LOW");
    expect(fit.note).toMatch(/假设|启发式/);
  });
});

describe("pricing scenario", () => {
  it("builds a transparent landed-cost scenario and never calls it a quote", () => {
    const product = makeProduct();
    const pricing = buildPricingScenario({
      product,
      country: "US",
      competitors: [competitor(1, 39), competitor(2, 45), competitor(3, 52)],
      fx: makeFx(),
      benchmarkEvidenceIds: ["ev_1"],
    });
    expect(pricing.landedCost).toBeGreaterThan(0);
    expect(pricing.benchmarkRetail).toBe(45);
    expect(pricing.suggestedRetail).not.toBeNull();
    expect(pricing.grossMarginPct).not.toBeNull();
    expect(pricing.grossMarginPct!).toBeGreaterThan(0);
    expect(pricing.assumptions.join(" ")).toMatch(/情景|假设/);
  });

  it("keeps missing weight explicit instead of inventing a precise shipping cost", () => {
    const product = makeProduct({ attributes: { ...makeProduct().attributes, weight: null } });
    const pricing = buildPricingScenario({
      product,
      country: "US",
      competitors: [competitor(1, 39)],
      fx: makeFx(),
      benchmarkEvidenceIds: [],
    });
    expect(pricing.internationalShipping).toBe(55);
    expect(pricing.assumptions.join(" ")).toMatch(/默认|重量/);
  });

  it("applies explicit What-if overrides", () => {
    const product = makeProduct();
    const pricing = buildPricingScenario({
      product,
      country: "US",
      competitors: [competitor(1, 39), competitor(2, 45)],
      fx: makeFx(),
      benchmarkEvidenceIds: [],
      overrides: { targetPrice: 59.9, dutyRatePct: 10, platformFeePct: 12, shippingCost: 40 },
    });
    expect(pricing.suggestedRetail).toBe(59.9);
    expect(pricing.duty).toBeCloseTo((pricing.purchaseCost + 40) * 0.1, 2);
    expect(pricing.assumptions.join(" ")).toMatch(/What-if/i);
  });
});
