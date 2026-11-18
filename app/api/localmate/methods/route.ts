import { json, readJson, routeError } from "@/lib/api/respond";
import { methodFields } from "@/lib/localmate/method-model";
import { getRepositories } from "@/lib/repositories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET() {
  return json({ methods: getRepositories().methods.list() }, { headers: { "cache-control": "no-store" } });
}

export async function POST(request: Request) {
  try {
    const fields = methodFields.parse(await readJson(request));
    return json({ method: getRepositories().methods.create(fields) }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
