import { describe, expect, it } from "vitest";
import { createTestDb } from "@/lib/db/client";
import { createRepositories } from "@/lib/repositories";
import { assertInScope, createManualProduct, updateProduct } from "@/lib/product/service";
import { saveImages } from "@/lib/product/uploads";

describe("product intake and confirmation", () => {
  it("creates a manual product with explicit provenance and missing fields", async () => {
    const repos = createRepositories(createTestDb());
    const product = await createManualProduct(repos, {
      name: "Bamboo desk organizer",
      category: "DESK_ORGANIZER",
      material: "Bamboo",
      dimensions: "30 × 20 × 10 cm",
      electrical: false,
      priceCNY: 45,
    });
    expect(product.confirmed).toBe(false);
    expect(product.provenance.name).toBe("USER_CONFIRMED");
    expect(product.provenance["attributes.material"]).toBe("USER_CONFIRMED");
    expect(product.missingFields).toContain("attributes.weight");
    expect(product.missingFields).not.toContain("attributes.material");
  });

  it("clears confirmation when a substantive field changes", async () => {
    const repos = createRepositories(createTestDb());
    const product = await createManualProduct(repos, {
      name: "Acrylic storage box",
      category: "STORAGE_BOX",
      material: "Acrylic",
      electrical: false,
      priceCNY: 20,
    });
    const confirmed = updateProduct(repos, product.id, { confirm: true });
    expect(confirmed.confirmed).toBe(true);
    const changed = updateProduct(repos, product.id, { material: "Bamboo" });
    expect(changed.confirmed).toBe(false);
    expect(changed.provenance["attributes.material"]).toBe("USER_CONFIRMED");
  });

  it("marks electrical and known out-of-scope inputs as OUT_OF_SCOPE", async () => {
    const repos = createRepositories(createTestDb());
    const product = await createManualProduct(repos, {
      name: "LED desk lamp with USB charger",
      category: "DESK_ORGANIZER",
      description: "Electrical lamp with a lithium battery and USB charging.",
      electrical: true,
    });
    expect(product.category).toBe("OUT_OF_SCOPE");
    expect(() => assertInScope(product)).toThrow(/超出范围/);
  });

  it("rejects private or non-HTTPS remote image URLs", () => {
    expect(() => saveImages(["http://127.0.0.1/secret.png"])).toThrow(/HTTPS|public/i);
    expect(() => saveImages(["https://localhost/secret.png"])).toThrow(/HTTPS|public/i);
  });

  it("detects food, cosmetic and children's terms from the brief", async () => {
    const repos = createRepositories(createTestDb());
    const product = await createManualProduct(repos, {
      name: "Children's snack storage set",
      category: "STORAGE_BOX",
      description: "Food-contact snack container for children.",
      electrical: false,
    });
    expect(product.category).toBe("OUT_OF_SCOPE");
  });
});
