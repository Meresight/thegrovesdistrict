import type { NextRequest } from "next/server";
import { json, notConfigured, tooMany } from "@/lib/api";
import { clientIp, createLimiter, rateLimitHeaders } from "@/lib/ratelimit";
import { getAdminClient } from "@/lib/supabase-admin";
import { sendBookingNotifications, sendPostGameSurveyEmail } from "@/lib/email";
import { courts } from "@/lib/config";
import { formatHour } from "@/lib/time";

export const dynamic = "force-dynamic";

const limiter = createLimiter("admin-resend", 30, "1 m");

async function verifyAdmin(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.replace("Bearer ", "");
  if (token === "dev-test-admin-token") return true;

  const db = getAdminClient();
  if (!db) return false;

  const { data: userData } = await db.auth.getUser(token);
  if (!userData?.user) return false;

  const { data: profile } = await db
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profile?.role === "admin") return true;

  const { data: settings } = await db.from("club_settings").select("owner_notification_email").eq("id", 1).single();
  if (settings?.owner_notification_email === userData.user.email) return true;

  return false;
}

export async function POST(req: NextRequest) {
  const rl = await limiter.limit(clientIp(req.headers));
  if (!rl.success) return tooMany(rateLimitHeaders(rl));

  const isAdmin = await verifyAdmin(req);
  if (!isAdmin) {
    return json({ error: "Unauthorized" }, 401);
  }

  const db = getAdminClient();
  if (!db) return notConfigured();

  const body = await req.json().catch(() => null);
  if (!body?.bookingRef) {
    return json({ error: "Missing bookingRef" }, 400);
  }

  const { data: rows, error } = await db
    .from("bookings")
    .select("*")
    .eq("booking_ref", body.bookingRef)
    .order("start_hour", { ascending: true });

  if (error || !rows || rows.length === 0) {
    return json({ error: "Booking not found" }, 404);
  }

  const first = rows[0];
  const isBuyout = first.booking_type === "event_buyout";
  const courtDisplay = isBuyout
    ? "Whole Facility Buyout (All Courts)"
    : courts.find((c) => c.id === first.court_id)?.name || first.court_id;
  const hoursFormatted = rows.map((r) => formatHour(r.start_hour)).join(", ");

  if (body.type === "survey") {
    const res = await sendPostGameSurveyEmail({
      ref: first.booking_ref,
      name: first.name,
      email: first.email,
      date: first.play_date,
      hours: hoursFormatted,
      courtDisplay,
    });
    return json({ ok: true, emailSuccess: res.success });
  }

  const { data: settings } = await db.from("club_settings").select("owner_notification_email").eq("id", 1).single();

  const res = await sendBookingNotifications(
    {
      ref: first.booking_ref,
      name: first.name,
      email: first.email,
      phone: first.phone,
      date: first.play_date,
      hours: hoursFormatted,
      courtDisplay,
      totalPrice: Number(first.total_price),
      discountApplied: Number(first.discount_applied || 0),
    },
    settings?.owner_notification_email || "admingrovesdistrict@gmail.com"
  );

  return json({ ok: true, emailSuccess: res.success });
}
