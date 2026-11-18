import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb } from "@/lib/db/client";
import { createRepositories } from "@/lib/repositories";
import { makeCompliance, makeFx, makeMarket, makeProduct } from "./fixtures";
import { generateLaunchPage, updateLaunchPage } from "@/lib/launch/service";
import { buildMatchAnalysis } from "@/lib/matching/engine";
import { createPassport } from "@/lib/passport/service";
import { LaunchPageContentSchema } from "@/schemas/launch";
import type { Repositories } from "@/lib/repositories";
import type { Country } from "@/types/domain";

vi.mock("@/lib/market/fx", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/market/fx")>();
  return { ...actual, getFxRates: async () => makeFx() };
});

import { runSimulation } from "@/lib/simulation/service";

const COUNTRIES: Country[] = ["US", "JP", "DE", "UK"];

describe("launch, passport and simulation", () => {
  let repos: Repositories;
  let productId: string;

  beforeEach(() => {
    repos = createRepositories(createTestDb());
    const product = repos.products.create(makeProduct());
    productId = product.id;
    for (const country of COUNTRIES) {
      repos.research.upsert({ jobId: null, productId, country, status: "COMPLETE", data: makeMarket(country) });
      repos.compliance.upsert({ productId, country, data: makeCompliance(country) });
    }
    const match = buildMatchAnalysis({
      product,
      markets: repos.research.getByProduct(productId),
      compliance: repos.compliance.getByProduct(productId),
    });
    repos.matches.save(productId, match);
  });

  it("generates a localized, schema-valid launch page without invented proof", async () => {
    const product = repos.products.getById(productId)!;
    const launch = await generateLaunchPage({
      product,
      country: "DE",
      market: repos.research.get(productId, "DE"),
      compliance: repos.compliance.get(productId, "DE"),
      tone: "MINIMAL",
      ai: null,
      repos,
    });
    expect(() => LaunchPageContentSchema.parse(launch)).not.toThrow();
    expect(launch.language).toBe("German");
    expect(launch.currency).toBe("EUR");
    expect(launch.generatedBy).toBe("TEMPLATE");
    expect(launch.features.length).toBeGreaterThanOrEqual(3);
    expect(launch.description).not.toMatch(/certified|guaranteed|best seller/i);
    expect(launch.priceNote).toMatch(/Szenario|kein/i);
  });

  it("edits launch copy without losing provenance metadata", () => {
    const launch = repos.launch.upsert({
      productId,
      country: "US",
      content: LaunchPageContentSchema.parse({
        country: "US",
        language: "English",
        currency: "USD",
        headline: "A calmer desk starts here",
        subheadline: "Walnut organizer with a drawer.",
        description: "A compact organizer for the small things that collect on a desk. Material and dimensions must be confirmed with the supplier before production; the price is a scenario estimate.",
        features: [
          { title: "Walnut", description: "Material is confirmed with the supplier." },
          { title: "Drawer", description: "A pull-out drawer for small items." },
          { title: "Compact", description: "A compact footprint for a desk." },
        ],
        targetAudience: ["Home-office users"],
        price: 49,
        priceNote: "Scenario estimate, not a landed-cost quote.",
        complianceChecklist: [],
        supplierQuestions: [],
        ctaLabel: "Validate this product",
        generatedBy: "TEMPLATE",
        generatedAt: new Date().toISOString(),
        evidenceIds: [],
      }),
    });
    expect(launch.headline).toContain("calmer");
    const edited = updateLaunchPage({
      repos,
      productId,
      country: "US",
      patch: { headline: "A quieter desk starts here" },
    });
    expect(edited.headline).toBe("A quieter desk starts here");
    expect(edited.generatedBy).toBe("TEMPLATE");
  });

  it("issues a versioned passport with next actions and exportable evidence", () => {
    const product = repos.products.getById(productId)!;
    repos.launch.upsert({
      productId,
      country: "US",
      content: LaunchPageContentSchema.parse({
        country: "US",
        language: "English",
        currency: "USD",
        headline: "A calmer desk starts here",
        subheadline: "Walnut organizer with a drawer.",
        description: "A compact organizer for the small things that collect on a desk. Material and dimensions must be confirmed with the supplier before production; the price is a scenario estimate.",
        features: [
          { title: "Walnut", description: "Material is confirmed with the supplier." },
          { title: "Drawer", description: "A pull-out drawer for small items." },
          { title: "Compact", description: "A compact footprint for a desk." },
        ],
        targetAudience: ["Home-office users"],
        price: 49,
        priceNote: "Scenario estimate, not a landed-cost quote.",
        complianceChecklist: [],
        supplierQuestions: [],
        ctaLabel: "Validate this product",
        generatedBy: "TEMPLATE",
        generatedAt: new Date().toISOString(),
        evidenceIds: [],
      }),
    });
    const passport = createPassport({ repos, productId });
    expect(passport.version).toBe(1);
    expect(passport.passportId).toBeTruthy();
    expect(passport.markets).toHaveLength(4);
    expect(passport.nextActions.length).toBeGreaterThan(0);
    expect(passport.disclaimer).toMatch(/法律意见|不是法律/);
    const second = createPassport({ repos, productId });
    expect(second.version).toBe(2);
    expect(repos.passports.listByProduct(productId)).toHaveLength(2);
    expect(product.name).toBe(passport.product.name);
  });

  it("invalidates compliance and launch outputs when material changes", async () => {
    repos.launch.upsert({
      productId,
      country: "US",
      content: LaunchPageContentSchema.parse({
        country: "US",
        language: "English",
        currency: "USD",
        headline: "A calmer desk starts here",
        subheadline: "Walnut organizer with a drawer.",
        description: "A compact organizer for the small things that collect on a desk. Material and dimensions must be confirmed with the supplier before production; the price is a scenario estimate.",
        features: [
          { title: "Walnut", description: "Material is confirmed with the supplier." },
          { title: "Drawer", description: "A pull-out drawer for small items." },
          { title: "Compact", description: "A compact footprint for a desk." },
        ],
        targetAudience: ["Home-office users"],
        price: 49,
        priceNote: "Scenario estimate, not a landed-cost quote.",
        complianceChecklist: [],
        supplierQuestions: [],
        ctaLabel: "Validate this product",
        generatedBy: "TEMPLATE",
        generatedAt: new Date().toISOString(),
        evidenceIds: [],
      }),
    });
    const simulation = await runSimulation({
      repos,
      productId,
      overrides: { material: "Bamboo", supplierCostCNY: 55, targetPrice: 55 },
      countries: ["US", "JP"],
    });
    expect(simulation.impacts.find((impact) => impact.module === "COMPLIANCE")?.action).toBe("REQUIRES_RERUN");
    expect(simulation.impacts.find((impact) => impact.module === "LAUNCH_PAGE")?.action).toBe("INVALIDATED");
    const usAfter = simulation.after.match?.countries.find((country) => country.country === "US");
    expect(usAfter?.complianceGate).toBe("CAUTION");
    expect(simulation.before.product.attributes.material).toBe("Walnut wood");
    const afterMarket = simulation.after.markets?.find((market) => market.country === "US");
    expect(afterMarket?.pricing.suggestedRetail).toBe(55);
  });
});
