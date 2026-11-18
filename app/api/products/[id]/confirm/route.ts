import { getRepositories } from "@/lib/repositories";
import { updateProduct } from "@/lib/product/service";
import { evidenceFromUserInput } from "@/lib/search/evidence-extractor";
import { ConfirmProductSchema } from "@/schemas/product";
import { AINotConfiguredError } from "@/lib/ai/types";
import { json, readJson, routeError, routeParam } from "@/lib/api/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<Record<string, string>> }) {
  try {
    ConfirmProductSchema.parse(await readJson(request));
    const id = await routeParam(context, "id");
    const repos = getRepositories();
    const product = updateProduct(repos, id, { confirm: true });
    const evidence = evidenceFromUserInput({
      productId: product.id,
      claimSupported: "User explicitly confirmed the product brief before research.",
      excerpt: JSON.stringify({
        name: product.name,
        category: product.category,
        attributes: product.attributes,
        sourcing: product.sourcing,
        confirmedAt: product.confirmedAt,
      }),
    });
    repos.evidence.insertMany([evidence]);
    return json({ product, evidenceId: evidence.id });
  } catch (error) {
    if (error instanceof AINotConfiguredError) return routeError(error);
    return routeError(error);
  }
}
