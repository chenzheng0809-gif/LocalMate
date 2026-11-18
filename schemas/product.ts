import { z } from "zod";
import { COUNTRIES, PRODUCT_CATEGORIES } from "@/types/domain";

export const CountrySchema = z.enum(COUNTRIES);
export const ProductCategorySchema = z.enum(PRODUCT_CATEGORIES);

export const ProductExtractionSchema = z.object({
  name: z.string().trim().min(2).max(200),
  category: ProductCategorySchema,
  description: z.string().trim().max(1600).nullable().default(null),
  material: z.string().trim().max(200).nullable().default(null),
  dimensions: z.string().trim().max(200).nullable().default(null),
  packagingDimensions: z.string().trim().max(200).nullable().default(null),
  weightKg: z.number().positive().max(500).nullable().default(null),
  color: z.string().trim().max(120).nullable().default(null),
  intendedUse: z.string().trim().max(400).nullable().default(null),
  electrical: z.boolean().nullable().default(null),
  priceCNY: z.number().nonnegative().max(1_000_000).nullable().default(null),
  moq: z.number().int().nonnegative().max(1_000_000).nullable().default(null),
  supplier: z.string().trim().max(200).nullable().default(null),
  imageObservations: z.array(z.string().max(300)).max(12).default([]),
  missingFields: z.array(z.string().max(80)).max(30).default([]),
  confidence: z.number().min(0).max(1).default(0.5),
});

export type ProductExtraction = z.infer<typeof ProductExtractionSchema>;

export const ManualProductInputSchema = z.object({
  name: z.string().trim().min(2, "Product name must be at least 2 characters").max(200),
  category: ProductCategorySchema.default("OTHER_HOME_ORGANIZATION"),
  description: z.string().trim().max(2000).optional(),
  material: z.string().trim().max(200).optional(),
  dimensions: z.string().trim().max(200).optional(),
  packagingDimensions: z.string().trim().max(200).optional(),
  weight: z.number().positive().max(500).optional(),
  color: z.string().trim().max(120).optional(),
  intendedUse: z.string().trim().max(400).optional(),
  electrical: z.boolean().optional(),
  priceCNY: z.number().nonnegative().max(1_000_000).optional(),
  MOQ: z.number().int().nonnegative().max(1_000_000).optional(),
  supplier: z.string().trim().max(200).optional(),
  sourceUrl: z.string().trim().max(2048).optional(),
  sourcePlatform: z.enum(["1688", "TAOBAO", "MANUAL", "IMAGE"]).default("MANUAL"),
  mode: z.enum(["LIVE", "DEMO"]).default("LIVE"),
});

export type ManualProductInput = z.infer<typeof ManualProductInputSchema>;

export const ProductPatchSchema = z
  .object({
    name: z.string().trim().min(2).max(200).optional(),
    category: ProductCategorySchema.optional(),
    description: z.string().trim().max(2000).nullable().optional(),
    material: z.string().trim().max(200).nullable().optional(),
    dimensions: z.string().trim().max(200).nullable().optional(),
    packagingDimensions: z.string().trim().max(200).nullable().optional(),
    weight: z.number().positive().max(500).nullable().optional(),
    color: z.string().trim().max(120).nullable().optional(),
    intendedUse: z.string().trim().max(400).nullable().optional(),
    electrical: z.boolean().nullable().optional(),
    priceCNY: z.number().nonnegative().max(1_000_000).nullable().optional(),
    MOQ: z.number().int().nonnegative().max(1_000_000).nullable().optional(),
    supplier: z.string().trim().max(200).nullable().optional(),
    confirm: z.boolean().optional(),
    mode: z.enum(["LIVE", "DEMO"]).optional(),
  })
  .strict();

export type ProductPatch = z.infer<typeof ProductPatchSchema>;

export const ProductImportRequestSchema = z.object({
  sourceUrl: z.string().trim().max(2048).optional(),
  manual: ManualProductInputSchema.partial().optional(),
  images: z.array(z.string().max(8_000_000)).max(6).optional(),
  mode: z.enum(["LIVE", "DEMO"]).default("LIVE"),
});

export const ConfirmProductSchema = z.object({
  confirm: z.literal(true),
});

export const ImageAnalysisResultSchema = z.object({
  productName: z.string().max(200).nullable(),
  category: ProductCategorySchema,
  visibleAttributes: z.record(z.string(), z.string().max(300)).default({}),
  observations: z.array(z.string().max(300)).max(20).default([]),
  containsElectricalComponents: z.boolean().nullable().default(null),
  containsText: z.array(z.string().max(300)).max(20).default([]),
  confidence: z.number().min(0).max(1).default(0.5),
});

export type ImageAnalysisResult = z.infer<typeof ImageAnalysisResultSchema>;