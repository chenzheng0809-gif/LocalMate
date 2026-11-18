import { getRepositories } from "@/lib/repositories";
import { AppError } from "@/lib/errors";
import { json, routeError, routeParam } from "@/lib/api/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_request: Request, context: { params: Promise<Record<string, string>> }) {
  try {
    const jobId = await routeParam(context, "jobId");
    const repos = getRepositories();
    const job = repos.jobs.getById(jobId);
    if (!job) throw new AppError("研究任务不存在。", { status: 404 });
    const events = repos.jobs.listEvents(jobId);
    return json({
      job,
      events,
      markets: repos.research.listByJob(jobId),
      match: repos.matches.getLatest(job.productId),
    });
  } catch (error) {
    return routeError(error);
  }
}
