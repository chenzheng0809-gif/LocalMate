import { z } from "zod";
import { json, readJson, routeError } from "@/lib/api/respond";
import { observationInput } from "@/lib/localmate/observations";
import { getRepositories } from "@/lib/repositories";

type Context = { params: Promise<{ id: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const input = observationInput.parse(await readJson(request));
    return json({ observation: getRepositories().observations.save(id, input) }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}

export async function DELETE(request: Request, context: Context) {
  try {
    const { id } = await context.params;
    const input = z.object({ id: z.string().max(80) }).parse(await readJson(request));
    getRepositories().observations.remove(id, input.id);
    return json({ removed: true });
  } catch (error) {
    return routeError(error);
  }
}
