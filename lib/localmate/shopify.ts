import { AppError } from "@/lib/errors";
import type { ListingDraft } from "./launch";

export type ShopifyRecord = { shop: string; remoteId: string | null; state: "requested" | "verified" };
type RemoteProduct = { id: string; handle: string; status: string };

export function shopifyTestShop(): string | null {
  const shop = process.env.LOCALMATE_SHOPIFY_TEST_SHOP?.trim().toLowerCase();
  return shop && /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/.test(shop) && process.env.LOCALMATE_SHOPIFY_ADMIN_TOKEN ? shop : null;
}

function descriptionHtml(text: string) {
  return text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replace(/\r?\n/g, "<br>");
}

export function shopifyDraftClient(shop: string, token: string, request = fetch) {
  async function graphql<T>(query: string, variables: object = {}): Promise<T> {
    let response: Response;
    try {
      response = await request(`https://${shop}/admin/api/2026-10/graphql.json`, {
        method: "POST", redirect: "error", cache: "no-store", signal: AbortSignal.timeout(12000),
        headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
        body: JSON.stringify({ query, variables }),
      });
    } catch {
      throw new AppError("连接 Shopify 超时或失败。", { status: 502 });
    }
    const body = await response.json().catch(() => null);
    if (!response.ok || body?.errors?.length || !body?.data) {
      throw new AppError(`Shopify 拒绝请求或返回异常（HTTP ${response.status}）。`, { status: 502 });
    }
    return body.data as T;
  }

  return {
    async assertTestShop() {
      const data = await graphql<{ shop: { plan: { partnerDevelopment: boolean } } }>(
        "query { shop { plan { partnerDevelopment } } }",
      );
      if (data.shop?.plan?.partnerDevelopment !== true) throw new AppError("此操作需要 Shopify 开发店。", { status: 403 });
    },
    async create(draft: ListingDraft, handle: string) {
      const data = await graphql<{ productCreate: { product: RemoteProduct | null; userErrors: { message: string }[] } }>(
        "mutation($product: ProductCreateInput!) { productCreate(product: $product) { product { id handle status } userErrors { message } } }",
        { product: { title: draft.title, descriptionHtml: descriptionHtml(draft.description), handle, status: "DRAFT" } },
      );
      if (data.productCreate.userErrors.length || !data.productCreate.product) {
        throw new AppError("Shopify 未接受草稿。请在开发店核对商品结果。", { status: 502 });
      }
      return data.productCreate.product;
    },
    async read(handle: string, id?: string) {
      const data = id
        ? await graphql<{ product: RemoteProduct | null }>("query($id: ID!) { product(id: $id) { id handle status } }", { id })
        : await graphql<{ product: RemoteProduct | null }>(
          "query($identifier: ProductIdentifierInput!) { product: productByIdentifier(identifier: $identifier) { id handle status } }", { identifier: { handle } },
        );
      return data.product;
    },
  };
}
