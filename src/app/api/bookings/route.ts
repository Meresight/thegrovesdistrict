import type { NextRequest } from "next/server";
import { booking, courts, site } from "@/lib/config";
import { json, notConfigured, parsePost, tooMany } from "@/lib/api";
import { createLimiter, rateLimitHeaders } from "@/lib/ratelimit";
import { getAdminClient } from "@/lib/supabase-admin";
import { addDays, endOfMonth, formatHour, isValidDate, nowInClubTz } from "@/lib/time";
import { bookingSchema } from "@/lib/validation";
import { qualifiesForLoyaltyReward } from "@/lib/loyalty";
import { sendBookingNotifications } from "@/lib/email";

export const dynamic = "force-dynamic";

const ipLimiter = createLimiter("booking-ip", 8, "10 m");
const emailLimiter = createLimiter("booking-email", 8, "1 d");

export async function POST(req: NextRequest) {
  const parsed = await parsePost(req, ipLimiter, bookingSchema);
  if (!parsed.ok) return parsed.res;
  const input = parsed.data;

  // Honeypot tripped
  if (input.website) return json({ ok: true, ref: "XXXXXXXX" });

  const rl = await emailLimiter.limit(input.email);
  if (!rl.success) return tooMany(rateLimitHeaders(rl));

  // --- Business rules ---
  const now = nowInClubTz();
  const lastDayOfMonth = endOfMonth(now.date);
  if (
    !isValidDate(input.date) ||
    input.date < now.date ||
    input.date > lastDayOfMonth
  ) {
    return json({ error: "Court bookings are currently open for the active calendar month only." }, 422);
  }

  const isEvent = input.bookingType === "event_buyout";

  // Exact court+hour picks. Single-court carts may mix courts; buyouts always take every court.
  const requestedSlots =
    !isEvent && input.slots?.length
      ? input.slots
      : input.hours.map((h) => ({ courtId: input.courtId, hour: h }));
  const slotMap = new Map<string, { courtId: (typeof input.courtId); hour: number }>();
  for (const s of requestedSlots) slotMap.set(`${s.courtId}:${s.hour}`, s);
  const slotList = [...slotMap.values()].sort((a, b) => a.hour - b.hour || a.courtId.localeCompare(b.courtId));

  const hours = [...new Set(slotList.map((s) => s.hour))].sort((a, b) => a - b);
  const inRange = hours.every((h) => h >= site.hours.open && h < site.hours.close);
  const inPast = input.date === now.date && hours.some((h) => h <= now.hour);
  if (!inRange || inPast || slotList.length === 0) {
    return json({ error: "Please choose valid time slots." }, 422);
  }

  const db = getAdminClient();
  if (!db) return notConfigured();

  // 1. Fetch dynamic settings
  const { data: settingsData } = await db
    .from("club_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  let extra: { offPeakRate?: number; eventTypes?: { id: string; label: string; hourlyRate: number }[] } = {};
  if (settingsData?.waiver_text && settingsData.waiver_text.trim().startsWith("{")) {
    try {
      extra = JSON.parse(settingsData.waiver_text);
    } catch {}
  }

  const peakRate = Number(settingsData?.regular_hourly_rate ?? booking.defaultPeakRate);
  const offPeakRate =
    extra.offPeakRate !== undefined ? Number(extra.offPeakRate) : booking.defaultOffPeakRate;
  const baseEventRate = Number(settingsData?.event_hourly_rate ?? booking.defaultEventRate);
  const discountPct = Number(
    settingsData?.member_discount_percent ?? booking.defaultMemberDiscountPercent
  );

  let activeEventRate = baseEventRate;
  let activeEventLabel = "Full Facility Buyout";
  if (isEvent) {
    const configuredTypes = Array.isArray(extra.eventTypes) ? extra.eventTypes : [];
    const matched = configuredTypes.find((et) => et.id === input.eventTypeId);
    if (matched) {
      activeEventRate = Number(matched.hourlyRate) || baseEventRate;
      activeEventLabel = matched.label;
    } else if (input.eventTypeId === "tournament") {
      activeEventRate = 2200;
      activeEventLabel = "Tournament / Pickleball Cup";
    } else if (input.eventTypeId === "corporate") {
      activeEventRate = 2500;
      activeEventLabel = "Corporate / Team Building Event";
    } else if (input.eventTypeId === "celebration") {
      activeEventRate = 2000;
      activeEventLabel = "Birthday / Private Celebration";
    }
  }

  // 2. Membership comes ONLY from a valid login token. Typing a member's email as a guest
  //    must never unlock member perks.
  let userId: string | null = null;
  let isMember = false;

  const authHeader = req.headers.get("authorization");
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await db.auth.getUser(token);
    if (userData?.user) {
      userId = userData.user.id;
      isMember = true;
    }
  }

  // 3. Loyalty: after every 10 CONFIRMED court-games, the next booking gets the discount.
  let confirmedGames = 0;
  let hasPendingReward = false;
  if (userId) {
    const email = input.email?.trim().toLowerCase();
    let query = db.from("bookings").select("booking_ref, status, discount_applied").neq("status", "cancelled");
    if (email) {
      query = query.or(`user_id.eq.${userId},email.ilike.${email}`);
    } else {
      query = query.eq("user_id", userId);
    }
    const { data: history } = await query;
    let confirmedSlotsCount = 0;
    for (const row of history ?? []) {
      if (row.status === "confirmed") confirmedSlotsCount++;
      if (row.status === "pending_review" && Number(row.discount_applied) > 0) hasPendingReward = true;
    }
    confirmedGames = confirmedSlotsCount;
  }

  // Price calculation: Uses live Off-Peak (8am-4pm) and Peak (4pm-2am) rates from Admin settings
  const slotRate = (h: number) => (h >= 8 && h < 16 ? offPeakRate : peakRate);

  // Reward applies to up to TWO court-hour slots (2 courts for 1 hr or 1 court for 2 hrs),
  // never whole-facility buyouts, and only one reward can be pending at a time.
  const qualifiesFor50Percent =
    isMember && qualifiesForLoyaltyReward(confirmedGames) && !hasPendingReward && !isEvent && slotList.length > 0;

  const rawTotal = isEvent
    ? activeEventRate * hours.length
    : slotList.reduce((sum, s) => sum + slotRate(s.hour), 0);

  // Discount applies to up to 2 court-hour slots (2 courts / 2 hours)
  const discountableSubtotal = slotList.slice(0, 2).reduce((sum, s) => sum + slotRate(s.hour), 0);
  const discountAmount = qualifiesFor50Percent ? Math.round((discountableSubtotal * discountPct) / 100) : 0;
  const finalTotal = Math.max(0, rawTotal - discountAmount);

  const ref = crypto.randomUUID();

  // Event buyout: every court for each chosen hour. Otherwise the exact court+hour picks.
  const bookedSlots = isEvent
    ? courts.flatMap((c) => hours.map((h) => ({ courtId: c.id, hour: h })))
    : slotList;

  const finalNotes = isEvent
    ? `[Event: ${activeEventLabel}]${input.notes ? ` ${input.notes}` : ""}`
    : input.notes || null;

  const rows = bookedSlots.map((s) => ({
    booking_ref: ref,
    booking_type: input.bookingType,
    court_id: s.courtId,
    play_date: input.date,
    start_hour: s.hour,
    user_id: userId,
    name: input.name,
    email: input.email,
    phone: input.phone,
    players: input.players ?? 4,
    notes: finalNotes,
    total_price: finalTotal,
    discount_applied: discountAmount,
    receipt_url: input.receiptUrl || null,
    waiver_agreed: input.waiverAgreed,
    status: "pending_review",
  }));

  // Auto-release any unreviewed pending bookings older than 25 minutes for these slots
  const twentyFiveMinsAgo = new Date(Date.now() - 25 * 60 * 1000).toISOString();
  for (const s of bookedSlots) {
    await db
      .from("bookings")
      .update({
        status: "cancelled",
        notes: "Auto-released: 25-minute payment verification timeout expired",
      })
      .eq("court_id", s.courtId)
      .eq("play_date", input.date)
      .eq("start_hour", s.hour)
      .eq("status", "pending_review")
      .lt("created_at", twentyFiveMinsAgo);
  }

  const { error } = await db.from("bookings").insert(rows);
  if (error) {
    if (error.code === "23505") {
      return json(
        {
          error: isEvent
            ? "One or more courts are already reserved during those hours. Event buyout requires all courts to be open."
            : "Sorry, one of those slots was just taken. Please pick another.",
        },
        409
      );
    }
    if (error.code === "23514") {
      return json(
        {
          error:
            "Slots from 12:00 AM to 2:00 AM are currently undergoing database maintenance. Please book hours up to 11:00 PM or contact club staff.",
        },
        400
      );
    }
    console.error("[bookings]", error.message);
    return json({ error: "Something went wrong. Please try again." }, 500);
  }

  // Trigger automated email dispatch via Resend (customer confirmation + owner alert)
  const courtDisplayName = isEvent
    ? "Whole Facility Buyout (All Courts)"
    : courts.find((c) => c.id === input.courtId)?.name || "Grove District Court";
  const formattedHours = hours.map((h) => formatHour(h)).join(", ");

  sendBookingNotifications(
    {
      ref,
      name: input.name,
      email: input.email,
      phone: input.phone,
      date: input.date,
      hours: formattedHours,
      courtDisplay: courtDisplayName,
      totalPrice: finalTotal,
      discountApplied: discountAmount,
    },
    settingsData?.owner_notification_email || site.email
  ).catch((err) => {
    console.error("[bookings-email]", err);
  });

  return json(
    {
      ok: true,
      ref: ref.slice(0, 8).toUpperCase(),
      totalPrice: finalTotal,
      discountApplied: discountAmount,
      isMember,
    },
    201
  );
}
