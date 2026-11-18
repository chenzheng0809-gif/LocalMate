import { getDb } from "@/lib/db/client";
import { workerOnline } from "@/lib/workflow/worker-lease";
import { publicConfigInfo } from "@/lib/config";
import { getCorpusInfo } from "@/lib/search/local-corpus";
import { json, routeError } from "@/lib/api/respond";
import { getRepositories } from "@/lib/repositories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const repos = getRepositories();
    return json({
      ...publicConfigInfo(),
      worker: { online: workerOnline(getDb()) },
      corpus: getCorpusInfo(),
      products: repos.products.listRecent(5).map((product) => ({
        id: product.id,
        name: product.name,
        category: product.category,
        confirmed: product.confirmed,
        mode: product.mode,
        createdAt: product.createdAt,
      })),
      serverTime: new Date().toISOString(),
    });
  } catch (error) {
    return routeError(error);
  }
}
