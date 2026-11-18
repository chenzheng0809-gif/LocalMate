import { getRepositories } from "@/lib/repositories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: Request, context: { params: Promise<Record<string, string>> }) {
  const params = await context.params;
  const jobId = params.jobId;
  if (!jobId) {
    return new Response("缺少任务 ID", { status: 400 });
  }
  const repos = getRepositories();
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      const close = () => {
        if (closed) return;
        closed = true;
        if (timer) clearTimeout(timer);
        try {
          controller.close();
        } catch {
          // already closed by the client
        }
      };

      request.signal.addEventListener("abort", close);
      const seen = new Set<string>();
      let ticks = 0;

      const tick = () => {
        if (closed) return;
        const job = repos.jobs.getById(jobId);
        if (!job) {
          send("error", { message: "研究任务不存在。" });
          close();
          return;
        }
        send("job", job);
        for (const event of repos.jobs.listEvents(jobId)) {
          if (seen.has(event.id)) continue;
          seen.add(event.id);
          send("event", event);
        }
        const terminal = ["COMPLETED", "PARTIAL", "FAILED"].includes(job.status);
        ticks += 1;
        if (terminal && ticks > 1) {
          send("done", { job });
          close();
          return;
        }
        timer = setTimeout(tick, 1000);
      };
      tick();
    },
    cancel() {
      closed = true;
      if (timer) clearTimeout(timer);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
