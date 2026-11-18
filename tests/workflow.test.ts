import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTestDb } from "@/lib/db/client";
import { createRepositories } from "@/lib/repositories";
import { makeCompliance, makeFx, makeProduct, makeSearchClient } from "./fixtures";
import type { Repositories } from "@/lib/repositories";

vi.mock("@/lib/compliance/service", () => ({
  runComplianceCheck: async ({ country }: { country: "US" | "JP" | "DE" | "UK" }) => ({
    data: makeCompliance(country, "PRECHECK_COMPLETE"),
    evidence: [],
  }),
}));

vi.mock("@/lib/market/fx", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/market/fx")>();
  return { ...actual, getFxRates: async () => makeFx() };
});

import { runResearchSynchronously } from "@/lib/workflow/research";

describe("research workflow", () => {
  let repos: Repositories;

  beforeEach(() => {
    repos = createRepositories(createTestDb());
  });

  it("runs four markets, attaches the compliance gate, persists a ranking and emits events", async () => {
    const product = repos.products.create(makeProduct({ id: "prod_workflow" }));
    const events: string[] = [];
    const job = await runResearchSynchronously(
      {
        repos,
        ai: null,
        search: makeSearchClient(),
        onEvent: (event) => events.push(`${event.phase}:${event.message}`),
      },
      { productId: product.id, countries: ["US", "JP", "DE", "UK"] },
    );

    expect(job.status).toBe("COMPLETED");
    expect(job.progress).toBe(100);
    const markets = repos.research.getByProduct(product.id);
    expect(markets).toHaveLength(4);
    expect(markets.every((market) => market.status === "COMPLETE")).toBe(true);
    expect(markets.every((market) => market.competitors.length > 0)).toBe(true);
    expect(repos.compliance.getByProduct(product.id)).toHaveLength(4);
    const match = repos.matches.getLatest(product.id);
    expect(match).not.toBeNull();
    expect(match!.status).toBe("RANKED");
    expect(match!.recommendedCountry).not.toBeNull();
    expect(repos.jobs.listEvents(job.id).length).toBeGreaterThan(8);
    expect(events.some((event) => event.startsWith("match:"))).toBe(true);
  });

  it("refuses to research an unconfirmed brief", async () => {
    const product = repos.products.create(makeProduct({ id: "prod_unconfirmed", confirmed: false, confirmedAt: null }));
    await expect(
      runResearchSynchronously(
        { repos, ai: null, search: makeSearchClient() },
        { productId: product.id, countries: ["US"] },
      ),
    ).rejects.toThrow(/确认/);
  });

  it("refuses to research an out-of-scope product", async () => {
    const product = repos.products.create(
      makeProduct({ id: "prod_scope", category: "OUT_OF_SCOPE", attributes: { ...makeProduct().attributes, electrical: true } }),
    );
    await expect(
      runResearchSynchronously(
        { repos, ai: null, search: makeSearchClient() },
        { productId: product.id, countries: ["US"] },
      ),
    ).rejects.toThrow(/超出范围/);
  });
});
