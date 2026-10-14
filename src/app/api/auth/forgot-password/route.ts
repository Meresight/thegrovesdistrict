import type { NextRequest } from "next/server";
import { json, notConfigured, tooMany } from "@/lib/api";
import { clientIp, createLimiter, rateLimitHeaders } from "@/lib/ratelimit";
import { getAdminClient } from "@/lib/supabase-admin";
import { sendPasswordResetEmail } from "@/lib/email";
import { site } from "@/lib/config";

export const dynamic = "force-dynamic";

const limiter = createLimiter("auth-forgot-password", 5, "10 m");

export async function POST(req: NextRequest) {
  const rl = await limiter.limit(clientIp(req.headers));
  if (!rl.success) return tooMany(rateLimitHeaders(rl));

  const db = getAdminClient();
  if (!db) return notConfigured();

  const body = await req.json().catch(() => null);
  const email = body?.email?.trim().toLowerCase();

  if (!email || !email.includes("@")) {
    return json({ error: "Please enter a valid email address." }, 400);
  }

  const origin = req.nextUrl.origin || process.env.NEXT_PUBLIC_SITE_URL || site.url;
  const redirectTo = `${origin}/member?reset=true`;

  try {
    let sentViaResend = false;
    const { data, error } = await db.auth.admin.generateLink({
      type: "recovery",
      email,
      options: {
        redirectTo,
      },
    });

    const actionLink = data?.properties?.action_link;
    if (actionLink && !error) {
      const emailRes = await sendPasswordResetEmail(email, actionLink);
      if (emailRes.success) {
        sentViaResend = true;
      } else {
        console.warn("[forgot-password] Resend email notice:", emailRes.error, "— triggering Supabase native mailer fallback");
      }
    }

    // Fallback: If Resend failed (e.g. sandbox 403 or unverified domain), dispatch via Supabase native mailer
    if (!sentViaResend) {
      const { error: nativeError } = await db.auth.resetPasswordForEmail(email, { redirectTo });
      if (nativeError) {
        console.warn("[forgot-password] Supabase native reset warning:", nativeError.message);
      }
    }
  } catch (err) {
    console.error("[forgot-password] Exception during password reset:", err);
  }

  return json({
    ok: true,
    message: "If an account is associated with this email, password reset instructions have been sent to your Gmail.",
  });
}
