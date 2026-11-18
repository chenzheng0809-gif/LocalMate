import { enforceGuestLimit } from "@/lib/ai/guest";
import { z } from "zod";
import { getAIProvider } from "@/lib/ai/factory";
import { getRepositories } from "@/lib/repositories";
import { intakeFromAgent } from "@/lib/agent/intake";
import { json, readJson, routeError } from "@/lib/api/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 180;

const IntakeSchema = z.object({
  message: z.string().trim().min(1).max(4000),
  sourceUrl: z.string().trim().max(2048).optional(),
  images: z.array(z.string().max(12_000_000)).max(4).optional(),
});

export async function POST(request: Request) {
  try {
    const input = IntakeSchema.parse(await readJson(request));
    await enforceGuestLimit(request);
    const result = await intakeFromAgent({
      repos: getRepositories(),
      ai: getAIProvider(),
      message: input.message,
      sourceUrl: input.sourceUrl,
      images: input.images,
    });
    return json(result, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
