import { json, readJson, routeError } from "@/lib/api/respond";
import { methodUpdate } from "@/lib/localmate/method-model";
import { getRepositories } from "@/lib/repositories";

export const runtime = "nodejs";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const update = methodUpdate.parse(await readJson(request));
    return json({ method: getRepositories().methods.update(id, update) });
  } catch (error) {
    return routeError(error);
  }
}
