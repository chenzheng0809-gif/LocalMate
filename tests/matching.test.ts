import { describe, expect, it } from "vitest";
import { buildMatchAnalysis } from "@/lib/matching/engine";
import { makeCompliance, makeMarket, makeProduct } from "./fixtures";
import type { Country, MetricKey } from "@/types/domain";

const COUNTRIES: Country[] = ["US", "JP", "DE", "UK"];

function marketsWithScores(scores: Record<Country, Partial<Record<MetricKey, number | null>>>) {
  return COUNTRIES.map((country) =>
    makeMarket(country, {
      metrics: Object.fromEntries(
        (["demand", "productMarketFit", "competition", "marginPotential", "localizationEffort", "entryFriction"] as MetricKey[]).map((key) => {
          const score = scores[country]?.[key];
          return [
            key,
            {
              score: score === undefined ? 80 : score,
              confidence: "MEDIUM",
              evidenceIds: [`ev_${country}`],
              missingData: score === null ? ["Missing test input"] : [],
              note: score === null ? "INSUFFICIENT_EVIDENCE" : "Test",
            },
          ];
        }),
      ) as never,
    }),
  );
}

describe("opportunity matching", () => {
  it("keeps the compliance gate separate from the weighted score", () => {
    const product = makeProduct();
    const markets = marketsWithScores({ US: {}, JP: {}, DE: {}, UK: {} });
    const compliance = COUNTRIES.map((country) =>
      makeCompliance(country, country === "US" ? "REVIEW_REQUIRED" : "PRECHECK_COMPLETE"),
    );
    const match = buildMatchAnalysis({ product, markets, compliance });
    const us = match.countries.find((country) => country.country === "US")!;
    expect(us.complianceGate).toBe("CAUTION");
    expect(us.weightedScore).toBe(80);
    expect(match.recommendedCountry).toBeTruthy();
    expect(match.explanation).toMatch(/not launch approval|发布批准|不要.*发布/i);
  });

  it("blocks a market without letting a high commercial score rank it", () => {
    const product = makeProduct();
    const markets = marketsWithScores({ US: {}, JP: {}, DE: {}, UK: {} });
    const compliance = COUNTRIES.map((country) =>
      makeCompliance(country, country === "US" ? "RESTRICTED" : "PRECHECK_COMPLETE"),
    );
    const match = buildMatchAnalysis({ product, markets, compliance });
    const us = match.countries.find((country) => country.country === "US")!;
    expect(us.complianceGate).toBe("BLOCKED");
    expect(us.weightedScore).toBeNull();
    expect(us.rank).toBeNull();
    expect(match.rankedCountries).not.toContain("US");
  });

  it("returns COMPARISON_INCOMPLETE when fewer than 60% of weighted inputs exist", () => {
    const product = makeProduct();
    const markets = marketsWithScores({
      US: { demand: null, productMarketFit: null, competition: null, marginPotential: 80, localizationEffort: 80 },
      JP: { demand: null, productMarketFit: null, competition: null, marginPotential: 80, localizationEffort: 80 },
      DE: { demand: null, productMarketFit: null, competition: null, marginPotential: 80, localizationEffort: 80 },
      UK: { demand: null, productMarketFit: null, competition: null, marginPotential: 80, localizationEffort: 80 },
    });
    const match = buildMatchAnalysis({
      product,
      markets,
      compliance: COUNTRIES.map((country) => makeCompliance(country)),
    });
    expect(match.status).toBe("COMPARISON_INCOMPLETE");
    expect(match.rankedCountries).toHaveLength(0);
    expect(match.countries.every((country) => country.weightedScore === null)).toBe(true);
  });

  it("treats a missing compliance check as UNKNOWN rather than CLEAR", () => {
    const product = makeProduct();
    const match = buildMatchAnalysis({
      product,
      markets: marketsWithScores({ US: {}, JP: {}, DE: {}, UK: {} }),
      compliance: [],
    });
    expect(match.countries.every((country) => country.complianceGate === "UNKNOWN")).toBe(true);
    expect(match.countries.every((country) => country.recommendation === "VALIDATE_FIRST")).toBe(true);
  });

  it("ranks the higher score first and assigns a single recommended country", () => {
    const product = makeProduct();
    const markets = marketsWithScores({ US: { demand: 90 }, JP: { demand: 80 }, DE: { demand: 70 }, UK: { demand: 60 } });
    const match = buildMatchAnalysis({
      product,
      markets,
      compliance: COUNTRIES.map((country) => makeCompliance(country)),
    });
    expect(match.rankedCountries[0]).toBe("US");
    expect(match.countries[0].rank).toBe(1);
    expect(match.recommendedCountry).toBe("US");
  });
});
