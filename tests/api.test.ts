import { beforeAll, describe, expect, it, vi } from "vitest";
import { createTestDb } from "@/lib/db/client";
import { createRepositories, type Repositories } from "@/lib/repositories";

const state = vi.hoisted(() => ({ repos: null as Repositories | null }));

vi.mock("@/lib/repositories", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/repositories")>();
  return {
    ...actual,
    getRepositories: () => {
      if (!state.repos) throw new Error("Test repositories not initialized");
      return state.repos;
    },
  };
});

import { GET as getProducts, POST as postProduct } from "@/app/api/products/route";
import { GET as getProduct, PATCH as patchProduct } from "@/app/api/products/[id]/route";
import { POST as confirmProduct } from "@/app/api/products/[id]/confirm/route";
import { GET as getMarkets } from "@/app/api/products/[id]/markets/route";
import { GET as getMatch } from "@/app/api/products/[id]/match/route";
import { POST as postLaunch } from "@/app/api/products/[id]/launch/route";
import { POST as postCompliance } from "@/app/api/products/[id]/compliance/route";
import { POST as postPassport } from "@/app/api/products/[id]/passport/route";
import { POST as seedDemo } from "@/app/api/demo/seed/route";
import { GET as getStatus } from "@/app/api/system/status/route";

function jsonRequest(body: unknown, method = "POST"): Request {
  return new Request("http://localhost/api/test", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function body<T>(response: Response): Promise<T> {
  return (await response.json()) as T;
}

describe("API route handlers", () => {
  beforeAll(() => {
    state.repos = createRepositories(createTestDb());
  });

  it("reports public system status without secrets", async () => {
    const response = await getStatus();
    expect(response.status).toBe(200);
    const data = await body<Record<string, unknown>>(response);
    expect(data).toHaveProperty("appMode");
    expect(data).toHaveProperty("search");
    expect(JSON.stringify(data)).not.toContain("OCTOPUS_API_KEY");
    expect(JSON.stringify(data)).not.toContain("apiKey");
  });

  it("creates a manual product, lists it, patches it and confirms it", async () => {
    const created = await postProduct(
      jsonRequest({
        name: "Bamboo desktop organizer",
        category: "DESK_ORGANIZER",
        material: "Bamboo",
        electrical: false,
        priceCNY: 42,
      }),
    );
    expect(created.status).toBe(201);
    const createdBody = await body<{ product: { id: string; confirmed: boolean } }>(created);
    expect(createdBody.product.confirmed).toBe(false);
    const id = createdBody.product.id;

    const list = await getProducts();
    expect(list.status).toBe(200);
    const listBody = await body<{ products: Array<{ id: string }> }>(list);
    expect(listBody.products.some((product) => product.id === id)).toBe(true);

    const patched = await patchProduct(
      jsonRequest({ material: "Walnut wood" }, "PATCH"),
      { params: Promise.resolve({ id }) },
    );
    expect(patched.status).toBe(200);
    const patchedBody = await body<{ product: { attributes: { material: string } } }>(patched);
    expect(patchedBody.product.attributes.material).toBe("Walnut wood");

    const confirmation = await confirmProduct(jsonRequest({ confirm: true }), {
      params: Promise.resolve({ id }),
    });
    expect(confirmation.status).toBe(200);
    const confirmed = await body<{ product: { confirmed: boolean } }>(confirmation);
    expect(confirmed.product.confirmed).toBe(true);
  });

  it("returns 422 for invalid product input", async () => {
    const response = await postProduct(jsonRequest({ name: "x" }));
    expect(response.status).toBe(422);
    const data = await body<{ code: string; details: unknown[] }>(response);
    expect(data.code).toBe("VALIDATION_ERROR");
    expect(data.details.length).toBeGreaterThan(0);
  });

  it("blocks launch, compliance and passport mutations before product confirmation", async () => {
    const created = await postProduct(jsonRequest({ name: "Unconfirmed bamboo tray", category: "DESK_ORGANIZER", material: "Bamboo", electrical: false, priceCNY: 18 }));
    const createdBody = await body<{ product: { id: string } }>(created);
    const context = { params: Promise.resolve({ id: createdBody.product.id }) };

    const launch = await postLaunch(jsonRequest({ country: "US" }), context);
    expect(launch.status).toBe(409);
    expect((await body<{ code: string }>(launch)).code).toBe("PRODUCT_NOT_CONFIRMED");

    const compliance = await postCompliance(jsonRequest({ countries: ["US"] }), context);
    expect(compliance.status).toBe(409);

    const passport = await postPassport(jsonRequest({}), context);
    expect(passport.status).toBe(409);
  });

  it("returns 409 when matching is requested before research", async () => {
    const demo = await seedDemo();
    const demoBody = await body<{ product: { id: string } }>(demo);
    const response = await getMatch(new Request("http://localhost/api/test"), {
      params: Promise.resolve({ id: demoBody.product.id }),
    });
    expect(response.status).toBe(409);
  });

  it("returns an empty market payload and 404 for unknown products", async () => {
    const demo = await seedDemo();
    const demoBody = await body<{ product: { id: string } }>(demo);
    const markets = await getMarkets(new Request("http://localhost/api/test"), {
      params: Promise.resolve({ id: demoBody.product.id }),
    });
    expect(markets.status).toBe(200);
    const marketBody = await body<{ markets: unknown[] }>(markets);
    expect(marketBody.markets).toEqual([]);

    const missing = await getProduct(new Request("http://localhost/api/test"), {
      params: Promise.resolve({ id: "prod_missing" }),
    });
    expect(missing.status).toBe(404);
  });

  it("seeds a clearly-labelled demo brief", async () => {
    const response = await seedDemo();
    expect(response.status).toBe(201);
    const data = await body<{ label: string; note: string; product: { confirmed: boolean; sourcePlatform: string } }>(response);
    expect(data.label).toBe("DEMO BRIEF");
    expect(data.product.confirmed).toBe(true);
    expect(data.product.sourcePlatform).toBe("DEMO");
    expect(data.note).toMatch(/illustrative/i);
  });
});
