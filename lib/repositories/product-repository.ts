import type { AppDatabase } from "@/lib/db/client";
import { nowIso, parseJson } from "@/lib/db/client";
import type {
  ProductAttributes,
  ProductCategory,
  ProductDNA,
  ProductMode,
  ProductSourcing,
  FieldProvenance,
  ExtractionStatus,
  SourcePlatform,
} from "@/types/domain";

function mapRow(row: Record<string, unknown>): ProductDNA {
  return {
    id: String(row.id),
    sourcePlatform: String(row.source_platform) as SourcePlatform,
    sourceUrl: row.source_url ? String(row.source_url) : null,
    name: String(row.name),
    category: String(row.category) as ProductCategory,
    description: row.description ? String(row.description) : null,
    images: parseJson<string[]>(row.images_json, []),
    attributes: parseJson<ProductAttributes>(row.attributes_json, {
      material: null,
      dimensions: null,
      packagingDimensions: null,
      weight: null,
      color: null,
      intendedUse: null,
      electrical: null,
      specifications: null,
    }),
    sourcing: parseJson<ProductSourcing>(row.sourcing_json, {
      priceCNY: null,
      MOQ: null,
      supplier: null,
    }),
    provenance: parseJson<Record<string, FieldProvenance>>(row.provenance_json, {}),
    missingFields: parseJson<string[]>(row.missing_fields_json, []),
    extractionStatus: String(row.extraction_status) as ExtractionStatus,
    confirmed: Number(row.confirmed) === 1,
    confirmedAt: row.confirmed_at ? String(row.confirmed_at) : null,
    mode: String(row.mode) as ProductMode,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

export function computeMissingFields(product: Pick<ProductDNA, "name" | "attributes" | "sourcing" | "category">): string[] {
  const missing: string[] = [];
  if (!product.name || product.name.trim().length < 2) missing.push("name");
  if (!product.attributes.material) missing.push("attributes.material");
  if (!product.attributes.dimensions) missing.push("attributes.dimensions");
  if (!product.attributes.weight) missing.push("attributes.weight");
  if (!product.attributes.intendedUse) missing.push("attributes.intendedUse");
  if (product.attributes.electrical === null) missing.push("attributes.electrical");
  if (product.sourcing.priceCNY === null) missing.push("sourcing.priceCNY");
  if (!product.category) missing.push("category");
  return missing;
}

export function computeExtractionStatus(product: ProductDNA): ExtractionStatus {
  const critical = ["name", "attributes.material", "attributes.electrical"];
  if (critical.some((field) => product.missingFields.includes(field))) {
    return "NEEDS_REVIEW";
  }
  return product.missingFields.length === 0 ? "COMPLETE" : "PARTIAL";
}

export interface ProductUpdate {
  sourceUrl?: string;
  sourcePlatform?: SourcePlatform;
  specifications?: ProductAttributes["specifications"];
  name?: string;
  category?: ProductCategory;
  description?: string | null;
  material?: string | null;
  dimensions?: string | null;
  packagingDimensions?: string | null;
  weight?: number | null;
  color?: string | null;
  intendedUse?: string | null;
  electrical?: boolean | null;
  priceCNY?: number | null;
  MOQ?: number | null;
  supplier?: string | null;
  confirm?: boolean;
  mode?: ProductMode;
  provenance?: Record<string, FieldProvenance>;
}

export interface ProductRepository {
  create(product: ProductDNA): ProductDNA;
  getById(id: string): ProductDNA | null;
  listRecent(limit?: number): ProductDNA[];
  update(id: string, patch: ProductUpdate): ProductDNA | null;
  delete(id: string): void;
}

export function createProductRepository(db: AppDatabase): ProductRepository {
  return {
    create(product) {
      db.prepare(
        `INSERT INTO products (
          id, source_platform, source_url, name, category, description, images_json,
          attributes_json, sourcing_json, provenance_json, missing_fields_json,
          extraction_status, confirmed, confirmed_at, mode, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        product.id,
        product.sourcePlatform,
        product.sourceUrl ?? null,
        product.name,
        product.category,
        product.description ?? null,
        JSON.stringify(product.images),
        JSON.stringify(product.attributes),
        JSON.stringify(product.sourcing),
        JSON.stringify(product.provenance),
        JSON.stringify(product.missingFields),
        product.extractionStatus,
        product.confirmed ? 1 : 0,
        product.confirmedAt ?? null,
        product.mode,
        product.createdAt,
        product.updatedAt,
      );
      const created = this.getById(product.id);
      if (!created) throw new Error("Failed to persist product.");
      return created;
    },

    getById(id) {
      const row = db.prepare("SELECT * FROM products WHERE id = ?").get(id) as
        | Record<string, unknown>
        | undefined;
      return row ? mapRow(row) : null;
    },

    listRecent(limit = 20) {
      const rows = db
        .prepare("SELECT * FROM products ORDER BY created_at DESC LIMIT ?")
        .all(limit) as Array<Record<string, unknown>>;
      return rows.map(mapRow);
    },

    update(id, patch) {
      const existing = this.getById(id);
      if (!existing) return null;

      const attributes: ProductAttributes = {
        material: patch.material !== undefined ? patch.material : existing.attributes.material,
        dimensions: patch.dimensions !== undefined ? patch.dimensions : existing.attributes.dimensions,
        packagingDimensions:
          patch.packagingDimensions !== undefined
            ? patch.packagingDimensions
            : existing.attributes.packagingDimensions ?? null,
        weight: patch.weight !== undefined ? patch.weight : existing.attributes.weight,
        color: patch.color !== undefined ? patch.color : existing.attributes.color,
        intendedUse: patch.intendedUse !== undefined ? patch.intendedUse : existing.attributes.intendedUse,
        electrical: patch.electrical !== undefined ? patch.electrical : existing.attributes.electrical,
        specifications: patch.specifications ?? existing.attributes.specifications ?? null,
      };
      const sourcing: ProductSourcing = {
        priceCNY: patch.priceCNY !== undefined ? patch.priceCNY : existing.sourcing.priceCNY,
        MOQ: patch.MOQ !== undefined ? patch.MOQ : existing.sourcing.MOQ,
        supplier: patch.supplier !== undefined ? patch.supplier : existing.sourcing.supplier,
      };
      const name = patch.name ?? existing.name;
      const category = patch.category ?? existing.category;

      const missingFields = computeMissingFields({
        name,
        category,
        attributes,
        sourcing,
      });

      const provenance = { ...existing.provenance, ...(patch.provenance ?? {}) };
      if (patch.name !== undefined) provenance.name = patch.provenance?.name ?? "USER_CONFIRMED";
      if (patch.category !== undefined) provenance.category = "USER_CONFIRMED";
      if (patch.description !== undefined) provenance.description = "USER_CONFIRMED";
      for (const key of ["material", "dimensions", "packagingDimensions", "weight", "color", "intendedUse", "electrical"] as const) {
        if (patch[key] !== undefined) provenance[`attributes.${key}`] = patch.provenance?.[`attributes.${key}`] ?? "USER_CONFIRMED";
      }
      for (const key of ["priceCNY", "MOQ", "supplier"] as const) {
        if (patch[key] !== undefined) provenance[`sourcing.${key}`] = patch.provenance?.[`sourcing.${key}`] ?? "USER_CONFIRMED";
      }

      const updatedAt = nowIso();
      const substantiveKeys: Array<keyof ProductUpdate> = [
        "name",
        "sourceUrl",
        "category",
        "description",
        "material",
        "dimensions",
        "packagingDimensions",
        "weight",
        "color",
        "intendedUse",
        "electrical",
        "priceCNY",
        "MOQ",
        "supplier",
      ];
      const hasSubstantiveChange = substantiveKeys.some((key) => patch[key] !== undefined);
      const confirmed = patch.confirm === true ? true : hasSubstantiveChange ? false : existing.confirmed;
      const confirmedAt =
        patch.confirm === true ? updatedAt : hasSubstantiveChange ? null : existing.confirmedAt ?? null;
      const provisional: ProductDNA = {
        ...existing,
        name,
        category,
        description: patch.description !== undefined ? patch.description : existing.description,
        attributes,
        sourcing,
        missingFields,
        provenance,
        updatedAt,
      };
      const extractionStatus = computeExtractionStatus(provisional);

      db.prepare(
        `UPDATE products SET
          source_url = ?, source_platform = ?, name = ?, category = ?, description = ?, attributes_json = ?, sourcing_json = ?,
          provenance_json = ?, missing_fields_json = ?, extraction_status = ?,
          confirmed = ?, confirmed_at = ?, mode = ?, updated_at = ?
        WHERE id = ?`,
      ).run(
        patch.sourceUrl ?? existing.sourceUrl ?? null,
        patch.sourcePlatform ?? existing.sourcePlatform,
        name,
        category,
        patch.description !== undefined ? patch.description : existing.description ?? null,
        JSON.stringify(attributes),
        JSON.stringify(sourcing),
        JSON.stringify(provenance),
        JSON.stringify(missingFields),
        extractionStatus,
        confirmed ? 1 : 0,
        confirmedAt,
        patch.mode ?? existing.mode,
        updatedAt,
        id,
      );

      return this.getById(id);
    },

    delete(id) {
      db.prepare("DELETE FROM products WHERE id = ?").run(id);
    },
  };
}