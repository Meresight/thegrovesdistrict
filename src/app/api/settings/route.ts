import type { NextRequest } from "next/server";
import { booking, DEFAULT_EVENT_TYPES, type FacilityEventType } from "@/lib/config";
import { json } from "@/lib/api";
import { clientIp, createLimiter, rateLimitHeaders } from "@/lib/ratelimit";
import { getAdminClient } from "@/lib/supabase-admin";
import { getPublicClient } from "@/lib/supabase-public";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const limiter = createLimiter("settings-get", 120, "1 m");

const NO_CACHE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
  Pragma: "no-cache",
  Expires: "0",
};

export async function GET(req: NextRequest) {
  const rl = await limiter.limit(clientIp(req.headers));
  if (!rl.success) {
    return json({ error: "Too many requests" }, 429, rateLimitHeaders(rl));
  }

  const fallback = {
    regularHourlyRate: booking.defaultPeakRate,
    offPeakHourlyRate: booking.defaultOffPeakRate,
    memberDiscountPercent: booking.defaultMemberDiscountPercent,
    eventHourlyRate: booking.defaultEventRate,
    eventTypes: DEFAULT_EVENT_TYPES,
    currencySymbol: booking.currencySymbol,
    paymentAccountName: "Grove District",
    paymentAccountNumber: "09509979540 (GCash / Maya)",
    paymentQrUrl: "/images/logo-mark.png",
    waiverText:
      "By booking a court at Grove District, I agree to the facility rules and release Grove District and its staff from any liability for accidental injury or property loss during play. Strict No-Cancellation Policy: All payments are final and non-refundable once verified.",
    announcement: "",
  };

  const db = getAdminClient() ?? getPublicClient();
  if (!db) return json({ settings: fallback }, 200, NO_CACHE_HEADERS);

  const { data, error } = await db
    .from("club_settings")
    .select("*")
    .eq("id", 1)
    .maybeSingle();

  if (error || !data) {
    return json({ settings: fallback }, 200, NO_CACHE_HEADERS);
  }

  // Parse extra settings stored in waiver_text if formatted as JSON
  let extra: {
    text?: string;
    offPeakRate?: number;
    announcement?: string;
    eventTypes?: FacilityEventType[];
  } = {};
  if (data.waiver_text && data.waiver_text.trim().startsWith("{")) {
    try {
      extra = JSON.parse(data.waiver_text);
    } catch {}
  }

  const peakRate = Number(data.regular_hourly_rate) || 550;
  const offPeakRate = extra.offPeakRate !== undefined ? Number(extra.offPeakRate) : 450;
  const baseEventRate = Number(data.event_hourly_rate) || 1800;

  const eventTypes: FacilityEventType[] =
    Array.isArray(extra.eventTypes) && extra.eventTypes.length > 0
      ? extra.eventTypes.map((et) => ({
          id: String(et.id || "event"),
          label: String(et.label || "Private Event"),
          hourlyRate: Number(et.hourlyRate) || baseEventRate,
          description: et.description ? String(et.description) : undefined,
        }))
      : DEFAULT_EVENT_TYPES.map((et, idx) =>
          idx === 0 ? { ...et, hourlyRate: baseEventRate } : et
        );

  const rawQrUrl = data.payment_qr_url || "/images/logo-mark.png";
  const normalizedQrUrl =
    rawQrUrl.startsWith("http") && rawQrUrl.includes("/receipts/")
      ? `/api/receipt?url=${encodeURIComponent(rawQrUrl)}`
      : rawQrUrl;

  return json(
    {
      settings: {
        regularHourlyRate: peakRate,
        offPeakHourlyRate: offPeakRate,
        memberDiscountPercent:
          data.member_discount_percent !== null && data.member_discount_percent !== undefined
            ? Number(data.member_discount_percent)
            : 50,
        eventHourlyRate: baseEventRate,
        eventTypes,
        currencySymbol: data.currency_symbol || "₱",
        paymentAccountName: data.payment_account_name || "Grove District",
        paymentAccountNumber: data.payment_account_number || "09509979540 (GCash / Maya)",
        paymentQrUrl: normalizedQrUrl,
        waiverText: extra.text || data.waiver_text || fallback.waiverText,
        ownerNotificationEmail: data.owner_notification_email || "grovedistrictcebu@gmail.com",
        announcement: extra.announcement || "",
      },
    },
    200,
    NO_CACHE_HEADERS
  );
}
