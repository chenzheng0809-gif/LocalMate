import { getRepositories } from "@/lib/repositories";
import { json } from "@/lib/api/respond";
import { reportMarkdown, reportSummary, reportTasks } from "@/lib/localmate/report-view";

export const dynamic = "force-dynamic";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const url = new URL(request.url);
  const tasks = reportTasks(getRepositories().team.list(id), url.searchParams.get("run") ?? undefined);
  const report = reportSummary(tasks);
  if (!report) return json({ error: "找不到这次报告。" }, { status: 404 });
  if (!report.done) return json({ error: "顾问还在生成报告。" }, { status: 409 });
  return new Response(reportMarkdown(report), {
    headers: {
      "content-type": "text/markdown; charset=utf-8",
      "content-disposition": 'attachment; filename="localmate-market-report.md"',
      "cache-control": "no-store",
    },
  });
}
