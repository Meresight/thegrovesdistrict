import type { NextRequest } from "next/server";
import { json, notConfigured } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase-admin";
import { loyaltyProgress } from "@/lib/loyalty";

export const dynamic = "force-dynamic";

type Row = {
  booking_ref: string;
  booking_type: string;
  court_id: string;
  play_date: string;
  start_hour: number;
  status: string;
  total_price: number;
  discount_applied: number;
  receipt_url: string | null;
  players: number;
  notes: string | null;
  created_at: string;
};

/**
 * GET /api/member/bookings
 * Returns the signed-in member's reservations (grouped per booking) and loyalty progress.
 * Uses the service role on the server because the bookings table is locked by RLS for browsers.
 */
export async function GET(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return json({ error: "Please sign in." }, 401);

  const db = getAdminClient();
  if (!db) return notConfigured();

  const { data: userData } = await db.auth.getUser(token);
  const user = userData?.user;
  if (!user) {
    return json({ error: "Session expired. Please sign in again.", code: "SESSION_EXPIRED" }, 401);
  }

  const email = (user.email ?? "").trim().toLowerCase();

  // Attach earlier bookings made with this email to the account
  if (email) {
    try {
      await db.from("bookings").update({ user_id: user.id }).ilike("email", email).is("user_id", null);
    } catch {}
  }

  let query = db
    .from("bookings")
    .select(
      "booking_ref, booking_type, court_id, play_date, start_hour, status, total_price, discount_applied, receipt_url, players, notes, created_at"
    );

  if (email) {
    query = query.or(`user_id.eq.${user.id},email.ilike.${email}`);
  } else {
    query = query.eq("user_id", user.id);
  }

  const { data, error } = await query
    .order("play_date", { ascending: false })
    .order("start_hour", { ascending: true });

  if (error) {
    console.error("[member/bookings]", error.message);
    return json({ error: "Could not load your reservations." }, 500);
  }

  const groups = new Map<string, Row[]>();
  for (const row of (data ?? []) as Row[]) {
    const list = groups.get(row.booking_ref) ?? [];
    list.push(row);
    groups.set(row.booking_ref, list);
  }

  const reservations = [...groups.entries()].map(([ref, rows]) => {
    const first = rows[0];
    return {
      ref,
      shortRef: ref.slice(0, 8).toUpperCase(),
      type: first.booking_type,
      date: first.play_date,
      courts: [...new Set(rows.map((r) => r.court_id))],
      hours: rows.map((r) => r.start_hour).sort((a, b) => a - b),
      totalSlots: rows.length,
      status: first.status,
      total: first.total_price,
      discount: first.discount_applied,
      receiptUrl: first.receipt_url,
      players: first.players,
      createdAt: first.created_at,
    };
  });

  const allRows = (data ?? []) as Row[];
  const confirmedCount = allRows.filter((r) => r.status === "confirmed").length;
  const hasPendingReward = reservations.some((r) => r.status === "pending_review" && r.discount > 0);

  return json({
    user: { id: user.id, email: user.email },
    reservations,
    confirmedCount,
    hasPendingReward,
    loyalty: loyaltyProgress(confirmedCount),
  });
}
