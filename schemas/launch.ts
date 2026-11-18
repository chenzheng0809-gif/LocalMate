import { z } from "zod";

export const LaunchPageContentSchema = z.object({
  country: z.enum(["US", "JP", "DE", "UK"]),
  language: z.string().trim().max(40),
  currency: z.string().trim().max(8),
  headline: z.string().trim().min(4).max(160),
  subheadline: z.string().trim().min(4).max(260),
  description: z.string().trim().min(20).max(1800),
  features: z
    .array(
      z.object({
        title: z.string().trim().min(2).max(90),
        description: z.string().trim().min(4).max(260),
      }),
    )
    .min(3)
    .max(6),
  targetAudience: z.array(z.string().trim().max(140)).min(1).max(6),
  price: z.number().nonnegative().max(1_000_000).nullable(),
  priceNote: z.string().trim().max(260),
  complianceChecklist: z
    .array(
      z.object({
        item: z.string().trim().max(240),
        status: z.enum(["OPEN", "DONE", "VERIFY"]),
        sourceUrl: z.string().trim().max(2048).optional(),
      }),
    )
    .max(12)
    .default([]),
  supplierQuestions: z.array(z.string().trim().max(260)).max(10).default([]),
  ctaLabel: z.string().trim().min(2).max(60),
  generatedBy: z.enum(["AI", "TEMPLATE"]).default("AI"),
  model: z.string().max(120).optional(),
  generatedAt: z.string(),
  evidenceIds: z.array(z.string()).max(30).default([]),
});

export const LaunchGenerateRequestSchema = z.object({
  productId: z.string().min(1),
  country: z.enum(["US", "JP", "DE", "UK"]),
  tone: z.enum(["PREMIUM", "MINIMAL", "PRACTICAL"]).default("MINIMAL"),
});

export const LaunchPageUpdateSchema = LaunchPageContentSchema.partial().extend({
  headline: z.string().trim().min(4).max(160).optional(),
  description: z.string().trim().min(20).max(1800).optional(),
  features: z
    .array(
      z.object({
        title: z.string().trim().min(2).max(90),
        description: z.string().trim().min(4).max(260),
      }),
    )
    .min(1)
    .max(6)
    .optional(),
  price: z.number().nonnegative().max(1_000_000).nullable().optional(),
});