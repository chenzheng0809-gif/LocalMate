import { enforceGuestLimit } from "@/lib/ai/guest";
import { getRepositories } from "@/lib/repositories";
import { enqueueResearchJob } from "@/lib/workflow/research";
import { AppError } from "@/lib/errors";
import { json, routeError, routeParam } from "@/lib/api/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request, context: { params: Promise<Record<string, string>> }) {
  try {
    const jobId = await routeParam(context, "jobId");
    const repos = getRepositories();
    const previous = repos.jobs.getById(jobId);
    if (!previous) throw new AppError("研究任务不存在。", { status: 404 });
    await enforceGuestLimit(request);
    const job = enqueueResearchJob(
      { repos },
      { productId: previous.productId, countries: previous.countries, force: true },
    );
    return json({ job, previousJobId: previous.id }, { status: 202 });
  } catch (error) {
    return routeError(error);
  }
}
