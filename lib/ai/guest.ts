import { createHmac, randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { cookies } from "next/headers";
import { config } from "@/lib/config";
import { getDb } from "@/lib/db/client";
import { AppError } from "@/lib/errors";
import { takeDailySlot, utcDay } from "./limits";

const cookieName = "localmate_ai_guest";

function signature(visitor: string) {
  return createHmac("sha256", config.ai.apiKey).update(`localmate:visitor:${visitor}`).digest("hex");
}

export async function enforceGuestLimit(request: Request) {
  if (config.demoMode) return;
  const header = config.ai.trustedVisitorHeader;
  let visitor: string;
  if (header) {
    const address = request.headers.get(header)?.trim() ?? "";
    visitor = isIP(address) ? `ip:${address}` : "unresolved-ip";
  } else {
    const jar = await cookies();
    const [id, signed] = (jar.get(cookieName)?.value ?? "").split(".");
    if (id && /^[a-f0-9-]{36}$/.test(id) && signed === signature(id)) {
      visitor = id;
    } else {
      visitor = randomUUID();
      jar.set(cookieName, `${visitor}.${signature(visitor)}`, {
        httpOnly: true,
        sameSite: "lax",
        secure: new URL(request.url).protocol === "https:",
        path: "/",
        maxAge: 30 * 24 * 60 * 60,
      });
    }
  }

  if (!takeDailySlot(getDb(), utcDay(), `guest:${signature(visitor)}`, config.ai.guestDailyLimit)) {
    throw new AppError("今日访客 AI 评估额度已用完，请明天再试。", { status: 429, code: "AI_GUEST_LIMIT" });
  }
}
