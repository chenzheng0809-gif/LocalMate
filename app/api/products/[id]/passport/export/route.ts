import { getRepositories } from "@/lib/repositories";
import { exportPassport } from "@/lib/passport/service";
import { routeError } from "@/lib/api/respond";
import { AppError } from "@/lib/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request, context: { params: Promise<Record<string, string>> }) {
  try {
    const params = await context.params;
    const id = params.id;
    if (!id) throw new AppError("必须提供产品 ID。", { status: 400 });
    const rawVersion = new URL(request.url).searchParams.get("version");
    const version = rawVersion ? Number(rawVersion) : undefined;
    if (rawVersion && (!Number.isFinite(version) || !Number.isInteger(version) || version! <= 0)) {
      throw new AppError("护照版本必须是正整数。", { status: 400 });
    }
    const exported = exportPassport(getRepositories(), id, version);
    return new Response(exported.json, {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${exported.filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    return routeError(error);
  }
}
