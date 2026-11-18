import { getRepositories } from "@/lib/repositories";
import { runSimulation } from "@/lib/simulation/service";
import { SimulationRequestSchema } from "@/schemas/simulation";
import { json, readJson, routeError, routeParam } from "@/lib/api/respond";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(_request: Request, context: { params: Promise<Record<string, string>> }) {
  try {
    const id = await routeParam(context, "id");
    const repos = getRepositories();
    return json({
      simulations: repos.simulations.listByProduct(id, 20),
      latest: repos.simulations.getLatest(id),
    });
  } catch (error) {
    return routeError(error);
  }
}

export async function POST(request: Request, context: { params: Promise<Record<string, string>> }) {
  try {
    const id = await routeParam(context, "id");
    const raw = await readJson(request);
    const parsed = SimulationRequestSchema.parse({ ...(raw as object), productId: id });
    const simulation = await runSimulation({
      repos: getRepositories(),
      productId: id,
      overrides: parsed.overrides,
      label: parsed.label,
      countries: parsed.countries,
    });
    return json({ simulation }, { status: 201 });
  } catch (error) {
    return routeError(error);
  }
}
