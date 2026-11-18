import { config as loadEnv } from "dotenv";

loadEnv({ path: ".env.local", override: true });

const [{ createRepositories }, { createManualProduct, updateProduct }, { getAIProvider }, { getSearchClient }, { runResearchSynchronously }] =
  await Promise.all([
    import("@/lib/repositories"),
    import("@/lib/product/service"),
    import("@/lib/ai/factory"),
    import("@/lib/search"),
    import("@/lib/workflow/research"),
  ]);

const repos = createRepositories((await import("@/lib/db/client")).getDb());
let productId = process.argv[2];

if (!productId) {
  const product = await createManualProduct(repos, {
    name: "Walnut Desk Organizer with Drawer",
    category: "DESK_ORGANIZER",
    description: "Compact solid-walnut desktop organizer with a pull-out drawer for stationery and home-office essentials.",
    material: "Walnut wood",
    dimensions: "32 × 18 × 12 cm",
    weight: 1.2,
    color: "Natural walnut",
    intendedUse: "Desktop stationery and home-office organization",
    electrical: false,
    priceCNY: 68,
    MOQ: 50,
    supplier: "Demo supplier (unverified)",
  });
  updateProduct(repos, product.id, { confirm: true });
  productId = product.id;
  console.log(`Seeded and confirmed demo product ${productId}.`);
}

const product = repos.products.getById(productId);
if (!product) throw new Error(`Product ${productId} not found.`);
if (!product.confirmed) throw new Error("The product brief must be confirmed before research.");
if (product.category === "OUT_OF_SCOPE") throw new Error("This product is OUT_OF_SCOPE for the v1 research scope.");

const ai = getAIProvider();
const search = getSearchClient();
console.log(`Researching ${product.name} across US / JP / DE / UK…`);
console.log(`AI: ${ai ? "configured" : "not configured (deterministic fallback)"} | Search: ${search.mode}`);

const job = await runResearchSynchronously(
  {
    repos,
    ai,
    search,
    onEvent: (event) => {
      if (event.level === "ERROR" || event.level === "WARN" || /complete|ranking|market/i.test(event.message)) {
        console.log(`[${event.phase}] ${event.message}`);
      }
    },
  },
  { productId, countries: ["US", "JP", "DE", "UK"] },
);

console.log(`\nJob ${job.id}: ${job.status} at ${job.progress}%`);
const markets = repos.research.getByProduct(productId);
console.log(`Markets: ${markets.map((market) => `${market.country} ${market.status} (${market.competitors.length} comparables)`).join(" | ")}`);
const match = repos.matches.getLatest(productId);
if (match) {
  console.log(`Ranking: ${match.status}; validation priority: ${match.recommendedCountry ?? "none"}`);
  console.log(match.countries.map((country) => `${country.country} rank=${country.rank ?? "—"} score=${country.weightedScore ?? "—"} gate=${country.complianceGate}`).join(" | "));
}
console.log(`\nOpen http://localhost:3000/discover/${productId}`);
if (job.status === "FAILED") process.exit(1);
