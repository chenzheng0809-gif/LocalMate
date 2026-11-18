import { getRepositories } from "@/lib/repositories";
import { createManualProduct, updateProduct } from "@/lib/product/service";
import { evidenceFromUserInput } from "@/lib/search/evidence-extractor";
import { json, routeError } from "@/lib/api/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  try {
    const repos = getRepositories();
    const product = await createManualProduct(repos, {
      name: "Walnut Desk Organizer with Drawer",
      category: "DESK_ORGANIZER",
      description:
        "Compact wooden desktop organizer with a pull-out drawer, two open compartments and a pen slot. Demo brief: supplier price and MOQ are illustrative, not a procurement quote.",
      material: "Walnut wood",
      dimensions: "32 × 18 × 12 cm",
      weight: 1.2,
      color: "Natural walnut",
      intendedUse: "Desktop stationery and home-office organization",
      electrical: false,
      priceCNY: 68,
      MOQ: 50,
      supplier: "Demo supplier (illustrative — not a verified quote)",
      sourcePlatform: "DEMO",
      mode: "DEMO",
    });
    const confirmed = updateProduct(repos, product.id, { confirm: true });
    repos.evidence.insertMany([
      evidenceFromUserInput({
        productId: confirmed.id,
        claimSupported: "Demo product brief; supplier price and MOQ are illustrative assumptions, not a real quote.",
        excerpt:
          "Demo brief: Walnut Desk Organizer with Drawer, 32 × 18 × 12 cm, 1.2 kg, CNY 68 target supplier cost, MOQ 50. These inputs are for demonstration and are not a verified supplier quotation.",
      }),
    ]);
    return json(
      {
        product: confirmed,
        label: "DEMO BRIEF",
        note: "This seed creates a demo product brief. Market research uses real public product pages; the supplier price/MOQ are illustrative and must not be presented as a real quote.",
      },
      { status: 201 },
    );
  } catch (error) {
    return routeError(error);
  }
}
