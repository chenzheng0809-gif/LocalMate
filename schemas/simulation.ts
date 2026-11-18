import { z } from "zod";

export const SimulationOverridesSchema = z
  .object({
    name: z.string().trim().min(2).max(200).optional(),
    material: z.string().trim().max(200).nullable().optional(),
    dimensions: z.string().trim().max(200).nullable().optional(),
    weight: z.number().positive().max(500).nullable().optional(),
    supplierCostCNY: z.number().nonnegative().max(1_000_000).nullable().optional(),
    shippingCost: z.number().nonnegative().max(100_000).nullable().optional(),
    dutyRatePct: z.number().min(0).max(100).nullable().optional(),
    platformFeePct: z.number().min(0).max(100).nullable().optional(),
    targetPrice: z.number().nonnegative().max(1_000_000).nullable().optional(),
    intendedUse: z.string().trim().max(400).nullable().optional(),
  })
  .strict();

export const SimulationRequestSchema = z.object({
  productId: z.string().min(1),
  overrides: SimulationOverridesSchema,
  label: z.string().trim().max(120).optional(),
  countries: z.array(z.enum(["US", "JP", "DE", "UK"])).min(1).max(4).optional(),
});

export const MatchRequestSchema = z.object({
  productId: z.string().min(1),
});

export const ResearchStartRequestSchema = z.object({
  productId: z.string().min(1),
  countries: z.array(z.enum(["US", "JP", "DE", "UK"])).min(1).max(4).default(["US", "JP", "DE", "UK"]),
  force: z.boolean().default(false),
});

export const PassportCreateRequestSchema = z.object({
  productId: z.string().min(1),
  note: z.string().trim().max(300).optional(),
});