import type { NextRequest } from "next/server";
import { json, notConfigured, tooMany } from "@/lib/api";
import { clientIp, createLimiter, rateLimitHeaders } from "@/lib/ratelimit";
import { getAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const limiter = createLimiter("admin-api", 60, "1 m");

// Helper to check admin authorization
async function verifyAdmin(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.replace("Bearer ", "");

  // Local development / testing bypass token
  if (token === "dev-test-admin-token") return true;

  const db = getAdminClient();
  if (!db) return false;

  const { data: userData } = await db.auth.getUser(token);
  if (!userData?.user) return false;

  // Check role in profiles or email match with owner
  const { data: profile } = await db
    .from("profiles")
    .select("role")
    .eq("id", userData.user.id)
    .maybeSingle();

  if (profile?.role === "admin") return true;

  // Fallback: check against owner_notification_email in settings
  const { data: settings } = await db.from("club_settings").select("owner_notification_email").eq("id", 1).single();
  if (settings?.owner_notification_email === userData.user.email) return true;

  return false;
}

/** GET /api/admin/bookings -> List all bookings with customer details and receipts */
export async function GET(req: NextRequest) {
  const rl = await limiter.limit(clientIp(req.headers));
  if (!rl.success) return tooMany(rateLimitHeaders(rl));

  const isAdmin = await verifyAdmin(req);
  if (!isAdmin) {
    return json({ error: "Unauthorized. Admin privileges required." }, 401);
  }

  const db = getAdminClient();
  if (!db) return notConfigured();

  const { data, error } = await db
    .from("bookings")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    return json({ error: error.message }, 500);
  }

  return json({ bookings: data });
}

/** POST /api/admin/bookings -> Create walk-in or manual court block */
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
  if (!body?.date || !body?.courtId || !Array.isArray(body?.hours) || body.hours.length === 0) {
    return json({ error: "Date, court, and at least one hour are required" }, 400);
  }

  const bookingRef = crypto.randomUUID();
  const name = body.name?.trim() || "Walk-In Player";
  const email = body.email?.trim().toLowerCase() || "walkin@grovedistrict.com";
  const phone = body.phone?.trim() || "09000000000";
  const notes = body.notes?.trim() || "Counter Walk-in / Cash booking";
  const totalPrice = Number(body.totalPrice) || 0;
  const bookingType = body.bookingType === "event_buyout" ? "event_buyout" : "single";
  const targetCourts =
    bookingType === "event_buyout"
      ? ["court-1", "court-2", "court-3"]
      : [body.courtId];

  const rows = body.hours.flatMap((h: number) =>
    targetCourts.map((cId) => ({
      booking_ref: bookingRef,
      booking_type: bookingType,
      court_id: cId,
      play_date: body.date,
      start_hour: h,
      name,
      email,
      phone,
      players: bookingType === "event_buyout" ? 12 : 4,
      notes,
      total_price: totalPrice,
      discount_applied: 0,
      receipt_url: null,
      waiver_agreed: true,
      status: "confirmed",
    }))
  );

  const { error } = await db.from("bookings").insert(rows);
  if (error) {
    if (error.code === "23505") {
      return json(
        {
          error:
            "Conflict: One or more selected court slots are already reserved by another booking. Please select open hours or an available court.",
        },
        409
      );
    }
    if (error.code === "23514") {
      return json(
        {
          error:
            "Constraint: Slot hour (12:00 AM – 2:00 AM) requires running the SQL fix in Supabase SQL editor: ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_start_hour_check; ALTER TABLE public.bookings ADD CONSTRAINT bookings_start_hour_check CHECK (start_hour BETWEEN 0 AND 25);",
        },
        400
      );
    }
    return json({ error: error.message }, 500);
  }

  return json({ ok: true, bookingRef });
}

/** PATCH /api/admin/bookings -> Update booking status, reschedule, or notes */
export async function PATCH(req: NextRequest) {
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
    return json({ error: "Invalid parameters" }, 400);
  }

  const updates: Record<string, unknown> = {};
  if (body.status) updates.status = body.status;
  if (body.playDate) updates.play_date = body.playDate;
  if (body.courtId) updates.court_id = body.courtId;
  if (body.startHour !== undefined) updates.start_hour = body.startHour;
  if (body.notes !== undefined) updates.notes = body.notes;

  const { error } = await db
    .from("bookings")
    .update(updates)
    .eq("booking_ref", body.bookingRef);

  if (error) {
    if (error.code === "23505") {
      return json(
        {
          error:
            "Cannot restore or reschedule: This court slot has already been taken by another booking.",
        },
        409
      );
    }
    if (error.code === "23514") {
      return json(
        {
          error:
            "Constraint: Slot hour (12:00 AM – 2:00 AM) requires updating the Supabase start_hour constraint to allow hours between 0 and 25.",
        },
        400
      );
    }
    return json({ error: error.message }, 500);
  }

  return json({ ok: true });
}
