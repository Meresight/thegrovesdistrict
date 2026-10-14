import type { NextRequest } from "next/server";
import { json, notConfigured, parsePost, tooMany } from "@/lib/api";
import { createLimiter, rateLimitHeaders } from "@/lib/ratelimit";
import { getAdminClient } from "@/lib/supabase-admin";
import { contactSchema } from "@/lib/validation";

export const dynamic = "force-dynamic";

const ipLimiter = createLimiter("contact-ip", 4, "1 h");
const emailLimiter = createLimiter("contact-email", 5, "1 d");

export async function POST(req: NextRequest) {
  const parsed = await parsePost(req, ipLimiter, contactSchema);
  if (!parsed.ok) return parsed.res;
  const input = parsed.data;

  if (input.website) return json({ ok: true });

  const rl = await emailLimiter.limit(input.email);
  if (!rl.success) return tooMany(rateLimitHeaders(rl));

  const db = getAdminClient();
  if (!db) return notConfigured();

  const { error } = await db
    .from("contact_messages")
    .insert({ name: input.name, email: input.email, message: input.message });
  if (error) {
    console.error("[contact]", error.message);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
  return json({ ok: true }, 201);
}
