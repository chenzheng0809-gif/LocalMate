import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { config } from "@/lib/config";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

export async function GET(_request: Request, context: { params: Promise<Record<string, string>> }) {
  const params = await context.params;
  const raw = params.name ?? "";
  const name = path.basename(raw);
  if (!name || name !== raw) return new Response("Not found", { status: 404 });
  const extension = name.split(".").pop()?.toLowerCase() ?? "";
  if (!MIME[extension]) return new Response("Not found", { status: 404 });
  const filePath = path.join(config.uploadDir, name);
  const root = path.resolve(config.uploadDir);
  if (!path.resolve(filePath).startsWith(root + path.sep) || !existsSync(filePath)) {
    return new Response("Not found", { status: 404 });
  }
  const bytes = readFileSync(filePath);
  return new Response(bytes, {
    headers: {
      "Content-Type": MIME[extension],
      "Cache-Control": "public, max-age=3600",
      "Content-Length": String(bytes.byteLength),
    },
  });
}
