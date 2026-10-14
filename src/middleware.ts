import { NextResponse, type NextRequest } from "next/server";
import { clientIp, createLimiter, rateLimitHeaders } from "@/lib/ratelimit";

// Global safety net for every API route (per-route limits are stricter).
const globalLimiter = createLimiter("global-api", 60, "1 m");

export async function middleware(req: NextRequest) {
  const r = await globalLimiter.limit(clientIp(req.headers));
  if (!r.success) {
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: rateLimitHeaders(r) },
    );
  }
  return NextResponse.next();
}

export const config = { matcher: ["/api/:path*"] };
