import { enforceGuestLimit } from "@/lib/ai/guest";
import { getRepositories } from "@/lib/repositories";
import { ResearchStartRequestSchema } from "@/schemas/simulation";
import { enqueueResearchJob } from "@/lib/workflow/research";
import { json, readJson, routeError } from "@/lib/api/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const input = ResearchStartRequestSchema.parse(await readJson(request));
    const repos = getRepositories();
    await enforceGuestLimit(request);
    const job = enqueueResearchJob(
      { repos },
      { productId: input.productId, countries: input.countries, force: input.force },
    );
    return json({ job, jobId: job.id }, { status: 202 });
  } catch (error) {
    return routeError(error);
  }
}
