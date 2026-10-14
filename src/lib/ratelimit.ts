import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

export type LimitResult = { success: boolean; limit: number; remaining: number; reset: number };
export type Limiter = { limit: (key: string) => Promise<LimitResult> };
type Window = `${number} ${"s" | "m" | "h" | "d"}`;

const UNIT_MS = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 } as const;

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? Redis.fromEnv()
    : null;

let warned = false;

/** Fixed-window in-memory fallback. Per-instance only: use Upstash in production. */
function memoryLimiter(max: number, window: Window): Limiter {
  const [n, unit] = window.split(" ") as [string, keyof typeof UNIT_MS];
  const windowMs = Number(n) * UNIT_MS[unit];
  const hits = new Map<string, { count: number; reset: number }>();

  return {
    async limit(key) {
      const now = Date.now();
      if (hits.size > 5_000) {
        for (const [k, v] of hits) if (v.reset <= now) hits.delete(k);
      }
      let entry = hits.get(key);
      if (!entry || entry.reset <= now) {
        entry = { count: 0, reset: now + windowMs };
        hits.set(key, entry);
      }
      entry.count += 1;
      return {
        success: entry.count <= max,
        limit: max,
        remaining: Math.max(0, max - entry.count),
        reset: entry.reset,
      };
    },
  };
}

/** Sliding-window limiter backed by Upstash Redis (falls back to memory when not configured). */
export function createLimiter(name: string, max: number, window: Window): Limiter {
  if (!redis) {
    if (!warned && process.env.NODE_ENV === "production") {
      warned = true;
      console.warn(
        "[ratelimit] UPSTASH_REDIS_REST_URL/TOKEN not set — using per-instance in-memory limiter. Not reliable on serverless.",
      );
    }
    return memoryLimiter(max, window);
  }
  const rl = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(max, window),
    prefix: `gd:${name}`,
    analytics: false,
  });
  return {
    async limit(key) {
      try {
        const r = await rl.limit(key);
        return { success: r.success, limit: r.limit, remaining: r.remaining, reset: r.reset };
      } catch (err) {
        // Fail open if Redis is unreachable so the site stays up; log for visibility.
        console.error("[ratelimit] redis error", err);
        return { success: true, limit: max, remaining: max, reset: Date.now() };
      }
    },
  };
}

export function clientIp(headers: Headers): string {
  return (
    headers.get("x-real-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown"
  );
}

export function rateLimitHeaders(r: LimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(r.limit),
    "X-RateLimit-Remaining": String(r.remaining),
    "X-RateLimit-Reset": String(Math.ceil(r.reset / 1000)),
    "Retry-After": String(Math.max(1, Math.ceil((r.reset - Date.now()) / 1000))),
  };
}
