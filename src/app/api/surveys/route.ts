import type { NextRequest } from "next/server";
import { json, notConfigured, tooMany } from "@/lib/api";
import { clientIp, createLimiter, rateLimitHeaders } from "@/lib/ratelimit";
import { getAdminClient } from "@/lib/supabase-admin";
import { formatHour } from "@/lib/time";

export const dynamic = "force-dynamic";

const limiter = createLimiter("surveys", 30, "1 m");

function badRequest(msg: string) {
  return json({ error: msg }, 400);
}

export type SurveyRecord = {
  id: string;
  bookingId: string; // full booking_ref UUID
  bookingRef: string; // 8-char uppercase ref
  playerName: string;
  playerEmail: string;
  isMember: boolean;
  playDate: string;
  courtLabel: string;
  hoursLabel: string;
  overall: number;
  hospitality: number;
  courtQuality: number;
  cafeFood: number;
  comment: string;
  featured: boolean; // FALSE by default — only Admin can feature on Homepage
  createdAt: string;
};

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

  const { data: settings } = await db
    .from("club_settings")
    .select("owner_notification_email")
    .eq("id", 1)
    .single();
  if (settings?.owner_notification_email === userData.user.email) return true;

  return false;
}

async function readSettingsAndSurveys(db: NonNullable<ReturnType<typeof getAdminClient>>) {
  const { data: row } = await db
    .from("club_settings")
    .select("waiver_text")
    .eq("id", 1)
    .maybeSingle();

  let parsed: Record<string, unknown> = {};
  if (row?.waiver_text && row.waiver_text.trim().startsWith("{")) {
    try {
      parsed = JSON.parse(row.waiver_text);
    } catch {}
  } else if (row?.waiver_text) {
    parsed = { text: row.waiver_text };
  }

  const surveys: SurveyRecord[] = Array.isArray(parsed.surveys)
    ? (parsed.surveys as SurveyRecord[])
    : [];

  return { parsed, surveys };
}

async function saveSurveys(
  db: NonNullable<ReturnType<typeof getAdminClient>>,
  parsed: Record<string, unknown>,
  surveys: SurveyRecord[]
) {
  const nextPayload = JSON.stringify({
    ...parsed,
    surveys,
  });

  const { error } = await db
    .from("club_settings")
    .update({
      waiver_text: nextPayload,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);

  return error;
}

function getBookingEndTimestampMs(playDate: string, hours: number[]): number {
  const baseMs = new Date(`${playDate}T00:00:00+08:00`).getTime();
  const maxStartHour = hours.length > 0 ? Math.max(...hours) : 8;
  const endHour = maxStartHour + 1;
  return baseMs + endHour * 3600_000;
}

function formatPublicName(fullName: string): string {
  const parts = (fullName || "Player").trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  const first = parts[0];
  const lastInitial = parts[parts.length - 1][0]?.toUpperCase() || "";
  return lastInitial ? `${first} ${lastInitial}.` : first;
}

/**
 * GET /api/surveys
 * - Public default: returns only owner-approved (`featured: true`) surveys for Homepage.
 * - `?lookup=REF_OR_EMAIL`: looks up eligible confirmed bookings for a Guest or Member.
 * - `?admin=1`: returns all surveys (including 1-star private feedback) for Owner Dashboard.
 */
export async function GET(req: NextRequest) {
  const db = getAdminClient();
  if (!db) return json({ surveys: [], stats: null });

  const url = new URL(req.url);
  const isAdminQuery = url.searchParams.get("admin") === "1";
  const lookup = url.searchParams.get("lookup")?.trim() || url.searchParams.get("ref")?.trim();

  const { surveys } = await readSettingsAndSurveys(db);

  // 1. Admin mode: return all surveys (featured & unfeatured)
  if (isAdminQuery) {
    const isAdmin = await verifyAdmin(req);
    if (!isAdmin) return json({ error: "Unauthorized" }, 401);
    const sorted = [...surveys].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    return json({ surveys: sorted });
  }

  // 2. Lookup mode: find a player's confirmed booking by #REF or Email in `bookings` table
  if (lookup) {
    const cleaned = lookup.replace(/^#/, "").trim().toLowerCase();
    if (cleaned.length < 3) {
      return badRequest("Please enter at least 4 characters of your Booking Reference or your full Email.");
    }

    const { data: rows, error } = await db
      .from("bookings")
      .select("booking_ref, user_id, name, email, play_date, booking_type, court_id, start_hour, status")
      .eq("status", "confirmed")
      .order("play_date", { ascending: false })
      .limit(300);

    if (error) return json({ error: error.message }, 500);

    // Group slot rows by booking_ref
    const grouped: Record<string, any[]> = {};
    for (const r of rows ?? []) {
      const ref = String(r.booking_ref);
      const shortRef = ref.slice(0, 8).toLowerCase();
      const email = String(r.email || "").toLowerCase();
      const isMatch = cleaned.includes("@")
        ? email === cleaned
        : shortRef === cleaned || ref.toLowerCase().startsWith(cleaned);
      if (isMatch) {
        grouped[ref] = grouped[ref] || [];
        grouped[ref].push(r);
      }
    }

    const matchedRefs = Object.keys(grouped);
    if (matchedRefs.length === 0) {
      return json(
        {
          error:
            "No confirmed booking found matching that Booking Reference or Email. Make sure your booking has been verified by the club.",
        },
        404
      );
    }

    const nowMs = Date.now();
    const surveyedBookingIds = new Set(surveys.map((s) => s.bookingId));

    const mapped = matchedRefs.map((ref) => {
      const slotRows = grouped[ref];
      const first = slotRows[0];
      const hours = Array.from(new Set<number>(slotRows.map((s: any) => Number(s.start_hour)))).sort(
        (a, b) => a - b
      );
      const courtsSet = Array.from(
        new Set<string>(slotRows.map((s: any) => String(s.court_id).replace("court-", "Court ")))
      ).sort();
      const courtLabel =
        first.booking_type === "event_buyout" || courtsSet.length === 3
          ? "All 3 Courts"
          : courtsSet.join(", ") || "Court 1";
      const hoursLabel = hours.map((h) => formatHour(h)).join(", ");
      const endMs = getBookingEndTimestampMs(first.play_date, hours);
      const hasFinished = nowMs >= endMs;
      const alreadySubmitted =
        surveyedBookingIds.has(ref) || surveyedBookingIds.has(ref.slice(0, 8).toUpperCase());

      return {
        bookingId: ref,
        bookingRef: ref.slice(0, 8).toUpperCase(),
        playerName: first.name,
        playerEmail: first.email,
        isMember: Boolean(first.user_id),
        playDate: first.play_date,
        courtLabel,
        hoursLabel,
        hasFinished,
        endTimestampMs: endMs,
        alreadySubmitted,
      };
    });

    return json({ bookings: mapped });
  }

  // 3. Public Homepage mode: ONLY return owner-approved (`featured === true`) reviews
  const featured = surveys
    .filter((s) => s.featured === true)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
    .map((s) => ({
      id: s.id,
      bookingRef: s.bookingRef,
      playerName: formatPublicName(s.playerName),
      isMember: s.isMember,
      playDate: s.playDate,
      courtLabel: s.courtLabel,
      overall: s.overall,
      hospitality: s.hospitality,
      courtQuality: s.courtQuality,
      cafeFood: s.cafeFood,
      comment: s.comment,
      createdAt: s.createdAt,
    }));

  const count = featured.length;
  const stats =
    count > 0
      ? {
          count,
          avgOverall: Number(
            (featured.reduce((acc, s) => acc + s.overall, 0) / count).toFixed(1)
          ),
          avgHospitality: Number(
            (featured.reduce((acc, s) => acc + s.hospitality, 0) / count).toFixed(1)
          ),
          avgCourtQuality: Number(
            (featured.reduce((acc, s) => acc + s.courtQuality, 0) / count).toFixed(1)
          ),
          avgCafeFood: Number(
            (featured.reduce((acc, s) => acc + s.cafeFood, 0) / count).toFixed(1)
          ),
        }
      : null;

  return json({ surveys: featured, stats });
}

/**
 * POST /api/surveys
 * Submit a post-play 5-star survey for a confirmed & completed booking.
 * Always saves with `featured: false` so the owner curates what appears on the homepage.
 */
export async function POST(req: NextRequest) {
  const rl = await limiter.limit(clientIp(req.headers));
  if (!rl.success) return tooMany(rateLimitHeaders(rl));

  const db = getAdminClient();
  if (!db) return notConfigured();

  const body = await req.json().catch(() => null);
  if (!body || !body.bookingId) {
    return badRequest("Booking reference is required.");
  }

  const overall = Number(body.overall);
  const hospitality = Number(body.hospitality);
  const courtQuality = Number(body.courtQuality);
  const cafeFood = Number(body.cafeFood);
  const comment = String(body.comment || "").trim().slice(0, 600);

  for (const score of [overall, hospitality, courtQuality, cafeFood]) {
    if (!Number.isInteger(score) || score < 1 || score > 5) {
      return badRequest("Please provide a 1 to 5 star rating for all categories.");
    }
  }

  // Verify the booking exists in `bookings` and is confirmed
  const { data: slotRows, error: bookingErr } = await db
    .from("bookings")
    .select("booking_ref, user_id, name, email, play_date, booking_type, court_id, start_hour, status")
    .eq("booking_ref", body.bookingId);

  if (bookingErr || !slotRows || slotRows.length === 0) {
    return badRequest("Booking not found.");
  }

  const first = slotRows[0];
  if (first.status !== "confirmed") {
    return badRequest("Only confirmed bookings can submit a post-play survey.");
  }

  const hours = Array.from(new Set<number>(slotRows.map((s: any) => Number(s.start_hour)))).sort(
    (a, b) => a - b
  );
  const endMs = getBookingEndTimestampMs(first.play_date, hours);

  if (Date.now() < endMs) {
    return badRequest(
      "Your scheduled court session hasn't finished yet! Please come back and rate your experience right after your game."
    );
  }

  const { parsed, surveys } = await readSettingsAndSurveys(db);

  if (surveys.some((s) => s.bookingId === first.booking_ref)) {
    return badRequest("A survey has already been submitted for this booking. Thank you!");
  }

  const courtsSet = Array.from(
    new Set<string>(slotRows.map((s: any) => String(s.court_id).replace("court-", "Court ")))
  ).sort();
  const courtLabel =
    first.booking_type === "event_buyout" || courtsSet.length === 3
      ? "All 3 Courts"
      : courtsSet.join(", ") || "Court 1";
  const hoursLabel = hours.map((h) => formatHour(h)).join(", ");

  const newSurvey: SurveyRecord = {
    id: `srv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    bookingId: first.booking_ref,
    bookingRef: String(first.booking_ref).slice(0, 8).toUpperCase(),
    playerName: first.name || "Player",
    playerEmail: first.email || "",
    isMember: Boolean(first.user_id || body.isMember),
    playDate: first.play_date,
    courtLabel,
    hoursLabel,
    overall,
    hospitality,
    courtQuality,
    cafeFood,
    comment,
    featured: false, // Owner must explicitly approve in /admin to show on Homepage
    createdAt: new Date().toISOString(),
  };

  const nextSurveys = [newSurvey, ...surveys];
  const saveErr = await saveSurveys(db, parsed, nextSurveys);
  if (saveErr) {
    return json({ error: saveErr.message }, 500);
  }

  return json({ ok: true, surveyId: newSurvey.id }, 201);
}

/**
 * PATCH /api/surveys
 * Admin-only: Toggle `featured: true/false` to publish or hide a review on the Homepage.
 */
export async function PATCH(req: NextRequest) {
  const isAdmin = await verifyAdmin(req);
  if (!isAdmin) return json({ error: "Unauthorized" }, 401);

  const db = getAdminClient();
  if (!db) return notConfigured();

  const body = await req.json().catch(() => null);
  if (!body || !body.id || typeof body.featured !== "boolean") {
    return badRequest("Survey id and featured boolean are required.");
  }

  const { parsed, surveys } = await readSettingsAndSurveys(db);
  const idx = surveys.findIndex((s) => s.id === body.id);
  if (idx === -1) {
    return json({ error: "Survey not found" }, 404);
  }

  surveys[idx] = {
    ...surveys[idx],
    featured: body.featured,
  };

  const saveErr = await saveSurveys(db, parsed, surveys);
  if (saveErr) {
    return json({ error: saveErr.message }, 500);
  }

  return json({ ok: true, survey: surveys[idx] });
}

/**
 * DELETE /api/surveys
 * Admin-only: Delete a survey entry.
 */
export async function DELETE(req: NextRequest) {
  const isAdmin = await verifyAdmin(req);
  if (!isAdmin) return json({ error: "Unauthorized" }, 401);

  const db = getAdminClient();
  if (!db) return notConfigured();

  const url = new URL(req.url);
  const id = url.searchParams.get("id");
  if (!id) return badRequest("Survey id is required.");

  const { parsed, surveys } = await readSettingsAndSurveys(db);
  const nextSurveys = surveys.filter((s) => s.id !== id);

  const saveErr = await saveSurveys(db, parsed, nextSurveys);
  if (saveErr) {
    return json({ error: saveErr.message }, 500);
  }

  return json({ ok: true });
}
