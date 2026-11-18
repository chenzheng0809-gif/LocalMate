import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { parse1688Html } from "@/lib/product/source-1688";
import { createTestDb } from "@/lib/db/client";
import { createRepositories, type Repositories } from "@/lib/repositories";
import { POST as prepare } from "@/app/api/localmate/missions/[id]/prepare/route";
import { POST as createProject } from "@/app/api/localmate/projects/route";
import { createManualProduct } from "@/lib/product/service";

const state = vi.hoisted(() => ({ repos: null as Repositories | null, fetchPage: vi.fn() }));
vi.mock("@/lib/repositories", async (original) => ({
  ...await original<typeof import("@/lib/repositories")>(),
  getRepositories: () => state.repos!,
}));
vi.mock("@/lib/search/fetch-client", async (original) => ({
  ...await original<typeof import("@/lib/search/fetch-client")>(),
  getFetchClient: () => ({ fetchPage: state.fetchPage }),
}));

const fixture = `<!doctype html><html><head><title>桌面收纳盒 - 阿里巴巴</title></head><body>
<script>
window.context={"result":{"data":{
  "gallery":{"fields":{"subject":"抽屉式桌面收纳盒","offerImgList":["https://cbu01.alicdn.com/a.jpg","https://cbu01.alicdn.com/b.jpg"]}},
  "productAttributes":{"fields":{"data":[
    {"name":"材质","value":"塑料"},
    {"name":"具体材质","value":"HIPS"},
    {"name":"颜色","value":"白色"},
    {"name":"产品尺寸","value":"20 × 15 × 10 cm"},
    {"name":"产品类别","value":"桌面收纳盒"}
  ]}},
  "productPackInfo":{"fields":{"pieceWeightScale":{"pieceWeightScaleInfo":[{"length":48,"width":35,"height":35.5,"weight":800}]}}},
  "mainPrice":{"fields":{"finalPriceModel":{"tradeWithoutPromotion":{"offerMinPrice":"12.50","offerMaxPrice":"28.00","offerBeginAmount":2}}}},
  "description":{"fields":{"detailUrl":"https://itemcdn.tmall.com/1688offer/test"}},
  "Root":{"fields":{"dataJson":{"tempModel":{"offerTitle":"抽屉式桌面收纳盒","companyName":"台州测试塑业有限公司","saledCount":2987},"orderParamModel":{"orderParam":{"beginNum":2}}}}},
  "shippingServices":{"fields":{"skuWeight":{5734229396723:0.8}}}
}}}
</script></body></html>`;

describe("1688 server-rendered offer parsing", () => {
  it("extracts title, price range, MOQ, supplier, attributes, images and package facts", () => {
    const snapshot = parse1688Html(fixture);
    expect(snapshot).not.toBeNull();
    expect(snapshot?.title).toBe("抽屉式桌面收纳盒");
    expect(snapshot?.priceCNY).toBe(12.5);
    expect(snapshot?.priceMaxCNY).toBe(28);
    expect(snapshot?.moq).toBe(2);
    expect(snapshot?.supplier).toBe("台州测试塑业有限公司");
    expect(snapshot?.packagingDimensions).toBe("48 × 35 × 35.5 cm");
    expect(snapshot?.weightKg).toBe(0.8);
    expect(snapshot?.material).toBe("塑料");
    expect(snapshot?.attributes["具体材质"]).toBe("HIPS");
    expect(snapshot?.images).toHaveLength(2);
    expect(snapshot?.detailUrl).toContain("itemcdn.tmall.com");
  });

  it("returns null rather than inventing data when the page has no embedded context", () => {
    expect(parse1688Html("<html><body>登录后查看</body></html>")).toBeNull();
  });
});

describe("scope detection with storage and negated electrical language", () => {
  it("keeps a cosmetic organizer in scope because the product is storage", async () => {
    const repos = createRepositories(createTestDb());
    const product = await createManualProduct(repos, {
      name: "化妆品桌面收纳盒",
      category: "DESK_ORGANIZER",
      description: "用于收纳口红、面膜和化妆刷的桌面置物架。",
      electrical: false,
    });
    expect(product.category).toBe("DESK_ORGANIZER");
  });

  it("does not treat '未显示电子元件' as an electrical product", async () => {
    const repos = createRepositories(createTestDb());
    const product = await createManualProduct(repos, {
      name: "白色金属网桌面收纳篮",
      category: "DESK_ORGANIZER",
      description: "图中未显示电子元件或电源线。",
      electrical: false,
    });
    expect(product.category).not.toBe("OUT_OF_SCOPE");
  });
});

it("attaches a supplier import to an existing project and rejects login pages without changing the product", async () => {
  const db = createTestDb();
  try {
    const repos = state.repos = createRepositories(db);
    const legacy = createManualProduct(repos, { name: "待确认商品" });
    const mission = repos.missions.create({ requestId: randomUUID(), productId: legacy.id, direction: "product_to_market",
      goal: "从商品找市场", markets: [] });
    const sourceUrl = "https://detail.1688.com/offer/889897473488.html";
    const request = (body: object) => new Request("http://localhost", { method: "POST",
      headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const context = { params: Promise.resolve({ id: mission.id }) };
    const command = { type: "import_product", revision: mission.revision, sourceUrl };
    state.fetchPage.mockResolvedValue({ ok: true, finalUrl: sourceUrl,
      html: "<html><head><title>安全验证</title></head><body>请登录</body></html>", text: "请登录" });
    const blocked = await prepare(request(command), context);
    expect(blocked.status).toBe(422);
    expect((await blocked.json()).code).toBe("IMPORT_FETCH_FAILED");
    expect(repos.missions.get(mission.id)?.productId).toBe(legacy.id);
    expect(repos.products.listRecent(10)).toHaveLength(1);

    state.fetchPage.mockClear();
    state.fetchPage.mockImplementation(async (url: string) => url.startsWith("https://m.1688.com")
      ? { ok: true, finalUrl: url, html: fixture, text: "抽屉式桌面收纳盒" }
      : { ok: false, status: 403, finalUrl: url });
    const response = await prepare(request({ ...command, sourceUrl: `店铺分享：${sourceUrl}，看看` }), context);
    expect(response.status).toBe(200);
    const imported = await response.json();
    expect(repos.missions.get(mission.id)?.productId).toBe(imported.product.id);
    expect(imported.product).toMatchObject({
      name: "抽屉式桌面收纳盒", sourceUrl, confirmed: false,
      attributes: { dimensions: "20 × 15 × 10 cm", packagingDimensions: "48 × 35 × 35.5 cm", weight: 0.8 },
      sourcing: { priceCNY: 12.5 },
      provenance: { "attributes.dimensions": "SOURCE_EXTRACTED" },
    });
    expect(state.fetchPage).toHaveBeenCalledWith("https://m.1688.com/offer/889897473488.html", expect.anything());
    expect((await prepare(request(command), context)).status).toBe(409);

    repos.products.update(imported.product.id, { confirm: true, dimensions: "20", weight: 20, priceCNY: 5 });
    const updated = await prepare(request({ ...command, revision: imported.mission.revision, updateExisting: true }), context);
    expect(updated.status).toBe(200);
    const refreshed = await updated.json();
    expect(refreshed.product).toMatchObject({ id: imported.product.id, confirmed: false,
      attributes: { dimensions: "20 × 15 × 10 cm", weight: 0.8 }, sourcing: { priceCNY: 12.5 },
      provenance: { "attributes.weight": "SOURCE_EXTRACTED" } });

    const created = await createProject(request({ requestId: randomUUID(), direction: "product_to_market",
      goal: "我想调研出海。", sourceUrl, deferResearch: true }));
    expect(created.status).toBe(201);
    const newMission = (await created.json()).mission;
    expect(repos.products.getById(newMission.productId)?.sourceUrl).toBe(sourceUrl);
  } finally {
    state.fetchPage.mockReset();
    state.repos = null;
    db.close();
  }
});
