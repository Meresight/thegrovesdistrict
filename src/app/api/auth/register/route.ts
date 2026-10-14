import type { NextRequest } from "next/server";
import { json, notConfigured, tooMany } from "@/lib/api";
import { clientIp, createLimiter, rateLimitHeaders } from "@/lib/ratelimit";
import { getAdminClient } from "@/lib/supabase-admin";
import { sendWelcomeMemberEmail } from "@/lib/email";

export const dynamic = "force-dynamic";

const limiter = createLimiter("auth-register", 10, "1 m");

export async function POST(req: NextRequest) {
  const rl = await limiter.limit(clientIp(req.headers));
  if (!rl.success) return tooMany(rateLimitHeaders(rl));

  const db = getAdminClient();
  if (!db) return notConfigured();

  const body = await req.json().catch(() => null);
  const email = body?.email?.trim().toLowerCase();
  const password = body?.password;
  const fullName = body?.fullName?.trim() || "";

  if (!email || !email.includes("@")) {
    return json({ error: "Please provide a valid email address" }, 400);
  }
  if (!password || password.length < 6) {
    return json({ error: "Password must be at least 6 characters" }, 400);
  }

  // 1. Create user in Supabase Auth
  const { data: createData, error: createError } = await db.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });

  if (createError) {
    if (
      createError.message.toLowerCase().includes("already registered") ||
      createError.message.toLowerCase().includes("already exists")
    ) {
      return json({ error: "An account with this email already exists. Please sign in." }, 409);
    }
    return json({ error: createError.message }, 400);
  }

  const user = createData.user;

  // 2. Ensure profile is saved in public.profiles
  if (user) {
    await db.from("profiles").upsert({
      id: user.id,
      email: user.email,
      full_name: fullName,
      role: "member",
    });
  }

  // 3. Dispatch Welcome Email to newly registered member's Gmail via Resend
  try {
    await sendWelcomeMemberEmail(email, fullName);
  } catch (err) {
    console.error("[register] Welcome email dispatch caught error:", err);
  }

  return json({ ok: true, user: { id: user?.id, email, full_name: fullName } });
}
