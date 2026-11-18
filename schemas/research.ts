import { z } from "zod";

export const MetricSuggestionSchema = z.object({
  score: z.number().min(0).max(100).nullable(),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
  rationale: z.string().max(600),
  evidenceIds: z.array(z.string()).max(12).default([]),
  missingData: z.array(z.string().max(160)).max(12).default([]),
});

export const MarketNarrativeSchema = z.object({
  landscapeSummary: z.string().trim().min(20).max(1200),
  positioningPatterns: z.array(z.string().trim().max(220)).max(8).default([]),
  differentiationOpportunities: z.array(z.string().trim().max(220)).max(8).default([]),
  customerNeeds: z.object({
    focusAttributes: z.array(z.string().trim().max(120)).max(10).default([]),
    purchaseReasons: z.array(z.string().trim().max(220)).max(10).default([]),
    potentialGaps: z.array(z.string().trim().max(220)).max(10).default([]),
    hypotheses: z
      .array(
        z.object({
          statement: z.string().trim().max(300),
          basis: z.string().trim().max(300),
          evidenceIds: z.array(z.string()).max(8).default([]),
        }),
      )
      .max(6)
      .default([]),
  }),
  demandInterpretation: z.object({
    summary: z.string().trim().max(800),
    confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
    caveats: z.array(z.string().trim().max(220)).max(8).default([]),
  }),
  localizationNotes: z.array(z.string().trim().max(220)).max(8).default([]),
  risks: z.array(z.string().trim().max(220)).max(8).default([]),
});

export type MarketNarrative = z.infer<typeof MarketNarrativeSchema>;

export const ComplianceFindingSchema = z.object({
  topic: z.enum([
    "HS_CLASSIFICATION",
    "IMPORT_RESTRICTIONS",
    "PRODUCT_SAFETY",
    "LABELING",
    "PACKAGING",
    "TARIFF",
    "DOCUMENTATION",
    "CHEMICAL",
    "SUSTAINABILITY",
    "MARKET_SURVEILLANCE",
  ]),
  claim: z.string().trim().min(10).max(700),
  requirementType: z.enum(["IMPORT", "MARKET", "BOTH", "UNCERTAIN"]),
  appliesToProduct: z.boolean().nullable(),
  officialSourceUrl: z.string().trim().max(2048),
  quote: z.string().trim().min(8).max(1200),
  confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
  action: z.string().trim().max(400).nullable().default(null),
});

export const ComplianceExtractionSchema = z.object({
  findings: z.array(ComplianceFindingSchema).max(18).default([]),
  hsCandidates: z
    .array(
      z.object({
        code: z.string().trim().regex(/^[0-9]{4}(\.[0-9]{2}){0,3}$/, "HS code must look like 3924.90"),
        description: z.string().trim().max(300),
        rationale: z.string().trim().max(600),
        confidence: z.enum(["HIGH", "MEDIUM", "LOW"]),
        sourceUrl: z.string().trim().max(2048),
        quote: z.string().trim().max(900).default(""),
      }),
    )
    .max(6)
    .default([]),
  missingInformation: z.array(z.string().trim().max(220)).max(12).default([]),
  summary: z.string().trim().max(1200).default(""),
});

export type ComplianceExtraction = z.infer<typeof ComplianceExtractionSchema>;

export const ComplianceCheckRequestSchema = z.object({
  productId: z.string().min(1),
  countries: z.array(z.enum(["US", "JP", "DE", "UK"])).min(1).max(4).optional(),
});