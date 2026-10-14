import type { NextRequest } from "next/server";
import { booking, site } from "@/lib/config";
import { json } from "@/lib/api";
import { clientIp, createLimiter, rateLimitHeaders } from "@/lib/ratelimit";
import { getPublicClient } from "@/lib/supabase-public";

export const dynamic = "force-dynamic";

const limiter = createLimiter("settings-get", 60, "1 m");

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
    currencySymbol: booking.currencySymbol,
    paymentAccountName: "Grove District",
    paymentAccountNumber: "09509979540 (GCash / Maya)",
    paymentQrUrl: "/images/logo-mark.png",
    waiverText:
      "By booking a court at Grove District, I agree to the facility rules and release Grove District and its staff from any liability for accidental injury or property loss during play. Strict No-Cancellation Policy: All payments are final and non-refundable once verified.",
    announcement: "",
  };

  const db = getPublicClient();
  if (!db) return json({ settings: fallback });

  const { data, error } = await db
    .from("club_settings")
    .select("*")
    .eq("id", 1)
    .single();

  if (error || !data) {
    return json({ settings: fallback });
  }

  // Parse extra settings stored in waiver_text if formatted as JSON
  let extra: { text?: string; offPeakRate?: number; announcement?: string } = {};
  if (data.waiver_text && data.waiver_text.trim().startsWith("{")) {
    try {
      extra = JSON.parse(data.waiver_text);
    } catch {}
  }

  const peakRate = Number(data.regular_hourly_rate) || 550;
  const offPeakRate = extra.offPeakRate !== undefined ? Number(extra.offPeakRate) : 450;

  return json({
    settings: {
      regularHourlyRate: peakRate,
      offPeakHourlyRate: offPeakRate,
      memberDiscountPercent: Number(data.member_discount_percent) || 50,
      eventHourlyRate: Number(data.event_hourly_rate) || 1800,
      currencySymbol: data.currency_symbol || "₱",
      paymentAccountName: data.payment_account_name || "Grove District",
      paymentAccountNumber: data.payment_account_number || "09509979540 (GCash / Maya)",
      paymentQrUrl: data.payment_qr_url || "/images/logo-mark.png",
      waiverText: extra.text || data.waiver_text || fallback.waiverText,
      announcement: extra.announcement || "",
    },
  });
}
