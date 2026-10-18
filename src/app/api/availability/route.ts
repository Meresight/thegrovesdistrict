import type { NextRequest } from "next/server";
import { booking, site } from "@/lib/config";
import { json, notConfigured, tooMany } from "@/lib/api";
import { clientIp, createLimiter, rateLimitHeaders } from "@/lib/ratelimit";
import { getAdminClient } from "@/lib/supabase-admin";
import { endOfMonth, isValidDate, nowInClubTz } from "@/lib/time";

export const dynamic = "force-dynamic";

const limiter = createLimiter("availability", 40, "1 m");

/** GET /api/availability?date=YYYY-MM-DD -> { booked: { [courtId]: number[] } } */
export async function GET(req: NextRequest) {
  const rl = await limiter.limit(clientIp(req.headers));
  if (!rl.success) return tooMany(rateLimitHeaders(rl));

  const date = req.nextUrl.searchParams.get("date") ?? "";
  const today = nowInClubTz().date;
  const lastDayOfMonth = endOfMonth(today);
  if (!isValidDate(date) || date < today || date > lastDayOfMonth) {
    return json({ error: "Invalid date: Booking is open for the current month only." }, 422);
  }

  const db = getAdminClient();
  if (!db) return notConfigured();

  // Load all active or pending bookings for date
  const { data, error } = await db
    .from("bookings")
    .select("court_id, booking_type, start_hour, status, created_at")
    .eq("play_date", date)
    .neq("status", "cancelled");

  if (error) {
    console.error("[availability]", error.message);
    return json({ error: "Could not load availability" }, 500);
  }

  const booked: Record<string, number[]> = {};
  const pending: Record<string, number[]> = {};
  const nowMs = Date.now();
  const HOLD_LIMIT_MS = 25 * 60 * 1000; // 25-minute auto-release limit for unapproved bookings

  for (const row of data ?? []) {
    const affectedCourts =
      row.booking_type === "event_buyout"
        ? ["court-1", "court-2", "court-3"]
        : [row.court_id];

    if (row.status === "confirmed") {
      for (const cId of affectedCourts) {
        (booked[cId] ??= []).push(row.start_hour);
      }
    } else if (row.status === "pending_review") {
      const ageMs = nowMs - new Date(row.created_at).getTime();
      // Only hold the slot if within 25 minutes of submission. After 25 minutes without owner approval, slot returns to available.
      if (ageMs < HOLD_LIMIT_MS) {
        for (const cId of affectedCourts) {
          (pending[cId] ??= []).push(row.start_hour);
          (booked[cId] ??= []).push(row.start_hour);
        }
      }
    }
  }

  return json({ booked, pending, open: site.hours.open, close: site.hours.close });
}
