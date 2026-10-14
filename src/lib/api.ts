import { NextResponse, type NextRequest } from "next/server";
import type { ZodSchema } from "zod";
import { clientIp, rateLimitHeaders, type Limiter } from "./ratelimit";

export function json(data: unknown, status = 200, headers?: Record<string, string>) {
  return NextResponse.json(data, { status, headers });
}

export function tooMany(headers: Record<string, string>) {
  return json({ error: "Too many requests. Please try again in a little while." }, 429, headers);
}

/** Basic CSRF defence: state-changing requests must come from our own origin. */
export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  if (!origin) return false;
  try {
    return new URL(origin).host === req.headers.get("host");
  } catch {
    return false;
  }
}

type Parsed<T> = { ok: true; data: T; ip: string } | { ok: false; res: NextResponse };

/**
 * Shared POST pipeline: origin check -> per-IP rate limit -> JSON body size/shape -> zod validation.
 */
export async function parsePost<T>(
  req: NextRequest,
  limiter: Limiter,
  schema: ZodSchema<T>,
): Promise<Parsed<T>> {
  if (!sameOrigin(req)) return { ok: false, res: json({ error: "Forbidden" }, 403) };

  const ip = clientIp(req.headers);
  const rl = await limiter.limit(ip);
  if (!rl.success) return { ok: false, res: tooMany(rateLimitHeaders(rl)) };

  if (!req.headers.get("content-type")?.includes("application/json")) {
    return { ok: false, res: json({ error: "Unsupported content type" }, 415) };
  }
  const raw = await req.text();
  if (raw.length > 10_000) return { ok: false, res: json({ error: "Payload too large" }, 413) };

  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return { ok: false, res: json({ error: "Invalid JSON" }, 400) };
  }

  const result = schema.safeParse(body);
  if (!result.success) {
    const first = result.error.issues[0];
    return { ok: false, res: json({ error: first?.message ?? "Invalid input" }, 422) };
  }
  return { ok: true, data: result.data, ip };
}

export const notConfigured = () =>
  json({ error: "Service temporarily unavailable. Please contact us directly." }, 503);
