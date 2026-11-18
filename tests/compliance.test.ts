import { describe, expect, it } from "vitest";
import { createTestDb } from "@/lib/db/client";
import { createRepositories } from "@/lib/repositories";
import { runComplianceCheck } from "@/lib/compliance/service";
import { COMPLIANCE_RULES, OFFICIAL_SOURCES, rulesForCountry } from "@/lib/compliance/catalog";
import { buildHsCandidates } from "@/lib/compliance/hs";
import {
  isOfficialDomain,
  isObviouslyBlockedHost,
  quoteExistsInText,
  sanitizeSourceUrl,
} from "@/lib/search/source-validator";
import { makeProduct } from "./fixtures";

describe("source safety and quote validation", () => {
  it("rejects localhost, private IPs, file and non-http URLs", () => {
    expect(sanitizeSourceUrl("http://127.0.0.1/admin")).toBeNull();
    expect(sanitizeSourceUrl("http://localhost:3000/secret")).toBeNull();
    expect(sanitizeSourceUrl("http://10.0.0.4/internal")).toBeNull();
    expect(sanitizeSourceUrl("file:///etc/passwd")).toBeNull();
    expect(sanitizeSourceUrl("javascript:alert(1)")).toBeNull();
    expect(isObviouslyBlockedHost("192.168.1.10")).toBe(true);
  });

  it("accepts public official URLs", () => {
    expect(sanitizeSourceUrl("https://www.cbp.gov/trade/rulings")).toContain("https://www.cbp.gov");
    expect(isOfficialDomain("cbp.gov", "US")).toBe(true);
    expect(isOfficialDomain("customs.go.jp", "JP")).toBe(true);
    expect(isOfficialDomain("zoll.de", "DE")).toBe(true);
    expect(isOfficialDomain("gov.uk", "UK")).toBe(true);
    expect(isOfficialDomain("example.com", "US")).toBe(false);
  });

  it("matches normalized quotes but rejects fabricated ones", () => {
    const page = "Importers must mark the country of origin on the article and its container. 19 CFR 134.";
    expect(quoteExistsInText("mark the country of origin on the article", page)).toBe(true);
    expect(quoteExistsInText("Importers must mark the country of origin on the article and its container.", page)).toBe(true);
    expect(quoteExistsInText("Importers must obtain a certificate of conformity from the CPSC.", page)).toBe(false);
  });

  it("keeps every rule pointed at a curated source", () => {
    for (const country of ["US", "JP", "DE", "UK"] as const) {
      const sourceIds = new Set(OFFICIAL_SOURCES[country].map((source) => source.id));
      for (const rule of COMPLIANCE_RULES[country]) {
        expect(rule.sourceIds.length).toBeGreaterThan(0);
        for (const sourceId of rule.sourceIds) {
          expect(sourceIds.has(sourceId)).toBe(true);
        }
      }
    }
  });

  it("keeps HS candidates at heading level instead of copying an unrelated tariff line", () => {
    const candidates = buildHsCandidates(makeProduct());
    expect(candidates[0]?.code).toBe("4420.90");
    expect(candidates.every((candidate) => !/cigar|cigarette/i.test(candidate.description))).toBe(true);
  });

  it("includes a wood-specific rule when material is wood", () => {
    const woodRules = rulesForCountry("US").filter((rule) =>
      /lacey|timber|wood|plant/i.test(`${rule.title} ${rule.requirement}`),
    );
    expect(woodRules.length).toBeGreaterThan(0);
  });
});

describe("compliance entry point", () => {
  it("returns OUT_OF_SCOPE without fetching official sources", async () => {
    const repos = createRepositories(createTestDb());
    const product = makeProduct({ category: "OUT_OF_SCOPE", attributes: { ...makeProduct().attributes, electrical: true } });
    const result = await runComplianceCheck({ product, country: "US", ai: null, repos });
    expect(result.data.status).toBe("OUT_OF_SCOPE");
    expect(result.data.officialSources).toHaveLength(0);
    expect(result.evidence).toHaveLength(0);
  });
});
