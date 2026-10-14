import type { NextRequest } from "next/server";
import { json, notConfigured, parsePost, tooMany } from "@/lib/api";
import { createLimiter, rateLimitHeaders } from "@/lib/ratelimit";
import { getAdminClient } from "@/lib/supabase-admin";
import { joinSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const ipLimiter = createLimiter("join-ip", 4, "1 h");
const emailLimiter = createLimiter("join-email", 2, "1 d");

export async function POST(req: NextRequest) {
  const parsed = await parsePost(req, ipLimiter, joinSchema);
  if (!parsed.ok) return parsed.res;
  const input = parsed.data;

  if (input.website) return json({ ok: true });

  const rl = await emailLimiter.limit(input.email);
  if (!rl.success) return tooMany(rateLimitHeaders(rl));

  const db = getAdminClient();
  if (!db) return notConfigured();

  const { error } = await db.from("member_applications").upsert(
    {
      name: input.name,
      email: input.email,
      phone: input.phone || null,
      level: input.level,
      message: input.message || null,
    },
    { onConflict: "email" },
  );
  if (error) {
    console.error("[join]", error.message);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
  return json({ ok: true }, 201);
}
