import { describe, expect, it } from "vitest";
import { parse1688Html } from "@/lib/product/source-1688";
import { createTestDb } from "@/lib/db/client";
import { createRepositories } from "@/lib/repositories";
import { productAgentInternals } from "@/lib/product/service";

function page(options: {
  attributes: Array<{ name: string; value: string }>;
  pieceWeightScale?: Record<string, number>;
}): string {
  return `<!doctype html><html><head><title>收纳盒 - 阿里巴巴</title></head><body>
<script>
window.context={"result":{"data":{
  "gallery":{"fields":{"subject":"测试收纳盒","offerImgList":["https://cbu01.alicdn.com/a.jpg"]}},
  "productAttributes":{"fields":{"data":[
    ${options.attributes.map((row) => `{"name":"${row.name}","value":"${row.value}"}`).join(",")}
  ]}},
  ${options.pieceWeightScale ? `"productPackInfo":{"fields":{"pieceWeightScale":{"pieceWeightScaleInfo":[${JSON.stringify(options.pieceWeightScale)}]}}},` : ""}
  "mainPrice":{"fields":{"finalPriceModel":{"tradeWithoutPromotion":{"offerMinPrice":"5.01","offerMaxPrice":"5.01","offerBeginAmount":1}}}},
  "Root":{"fields":{"dataJson":{"tempModel":{"offerTitle":"测试收纳盒","companyName":"测试供应商"}}}}
}}}
</script></body></html>`;
}

describe("1688 packaging facts must never be fabricated", () => {
  it("treats a zero-valued piece weight scale as not stated", () => {
    const snapshot = parse1688Html(
      page({
        attributes: [{ name: "材质", value: "塑料" }],
        pieceWeightScale: { length: 0, width: 0, height: 0, weight: 1000 },
      }),
    );
    expect(snapshot?.packagingDimensions).toBeNull();
    expect(snapshot?.weightKg).toBe(1);
    expect(String(snapshot?.packagingDimensions ?? "")).not.toContain("0 × 0 × 0");
  });

  it("keeps a real piece weight scale", () => {
    const snapshot = parse1688Html(
      page({
        attributes: [{ name: "材质", value: "塑料" }],
        pieceWeightScale: { length: 48, width: 35, height: 35.5, weight: 800 },
      }),
    );
    expect(snapshot?.packagingDimensions).toBe("48 × 35 × 35.5 cm");
    expect(snapshot?.weightKg).toBe(0.8);
  });

  it("prefers a stated packaging size over the piece weight scale", () => {
    const snapshot = parse1688Html(
      page({
        attributes: [
          { name: "材质", value: "塑料" },
          { name: "包装尺寸", value: "52 × 40 × 38 cm" },
        ],
        pieceWeightScale: { length: 48, width: 35, height: 35.5, weight: 800 },
      }),
    );
    expect(snapshot?.packagingDimensions).toBe("52 × 40 × 38 cm");
  });
});

describe("1688 product dimensions come from the attribute table", () => {
  it("reads a product size when the page states one", () => {
    const snapshot = parse1688Html(
      page({
        attributes: [
          { name: "材质", value: "塑料" },
          { name: "产品尺寸", value: "32 × 18 × 12 cm" },
        ],
      }),
    );
    expect(snapshot?.productDimensions).toBe("32 × 18 × 12 cm");
  });

  it("ignores non-measurement values that reuse the 尺寸 key", () => {
    const snapshot = parse1688Html(
      page({
        attributes: [
          { name: "材质", value: "塑料" },
          { name: "尺寸", value: "大号" },
        ],
      }),
    );
    expect(snapshot?.productDimensions).toBeNull();
  });

  it("does not treat a packaging size as the product size", () => {
    const snapshot = parse1688Html(
      page({
        attributes: [
          { name: "材质", value: "塑料" },
          { name: "包装尺寸", value: "52 × 40 × 38 cm" },
        ],
      }),
    );
    expect(snapshot?.productDimensions).toBeNull();
    expect(snapshot?.packagingDimensions).toBe("52 × 40 × 38 cm");
  });
});

describe("structured product attributes are stored on the product record", () => {
  const { buildProduct } = productAgentInternals;

  it("keeps the supplier attribute table verbatim", () => {
    const product = buildProduct({
      extraction: {
        name: "测试收纳盒",
        category: "STORAGE_BOX",
        description: null,
        material: "塑料",
        dimensions: null,
        packagingDimensions: null,
        weightKg: null,
        color: null,
        intendedUse: null,
        electrical: false,
        priceCNY: null,
        moq: null,
        supplier: null,
        imageObservations: [],
        missingFields: [],
        confidence: 0.9,
      },
      sourcePlatform: "1688",
      specifications: { 材质: "塑料", 型号: "3102", 箱装数量: "48PCS" },
    });
    expect(product.attributes.specifications).toEqual({ 材质: "塑料", 型号: "3102", 箱装数量: "48PCS" });
  });

  it("survives a user edit of other product fields", async () => {
    const repos = createRepositories(createTestDb());
    const product = buildProduct({
      extraction: {
        name: "测试收纳盒",
        category: "STORAGE_BOX",
        description: null,
        material: "塑料",
        dimensions: null,
        packagingDimensions: null,
        weightKg: null,
        color: null,
        intendedUse: null,
        electrical: false,
        priceCNY: null,
        moq: null,
        supplier: null,
        imageObservations: [],
        missingFields: [],
        confidence: 0.9,
      },
      sourcePlatform: "1688",
      specifications: { 材质: "塑料", 型号: "3102" },
    });
    const created = repos.products.create(product);
    const updated = repos.products.update(created.id, { color: "白色" });
    expect(updated?.attributes.specifications).toEqual({ 材质: "塑料", 型号: "3102" });
  });
});
