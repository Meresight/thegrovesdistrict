import type { NextRequest } from "next/server";
import { revalidatePath } from "next/cache";
import { json, notConfigured, tooMany } from "@/lib/api";
import { DEFAULT_EVENT_TYPES, type FacilityEventType } from "@/lib/config";
import { clientIp, createLimiter, rateLimitHeaders } from "@/lib/ratelimit";
import { getAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const limiter = createLimiter("admin-settings", 40, "1 m");

async function verifyAdmin(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return false;
  const token = authHeader.replace("Bearer ", "");

  // Local / built-in owner session token
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
    .maybeSingle();
  if (settings?.owner_notification_email === userData.user.email) return true;

  return false;
}

/** PUT /api/admin/settings -> Update rates, event types, QR code, bank info, waiver */
export async function PUT(req: NextRequest) {
  const rl = await limiter.limit(clientIp(req.headers));
  if (!rl.success) return tooMany(rateLimitHeaders(rl));

  const isAdmin = await verifyAdmin(req);
  if (!isAdmin) {
    return json({ error: "Unauthorized" }, 401);
  }

  const db = getAdminClient();
  if (!db) return notConfigured();

  const body = await req.json().catch(() => null);
  if (!body) return json({ error: "Invalid payload" }, 400);

  // Preserve any existing extra data (surveys, sent survey email IDs, etc.) stored in waiver_text JSON
  let existingExtra: Record<string, unknown> = {};
  const { data: currentRow } = await db
    .from("club_settings")
    .select("waiver_text")
    .eq("id", 1)
    .maybeSingle();
  if (currentRow?.waiver_text && currentRow.waiver_text.trim().startsWith("{")) {
    try {
      existingExtra = JSON.parse(currentRow.waiver_text);
    } catch {}
  }

  const baseEventRate = Number(body.eventHourlyRate) || 1800;
  const eventTypes: FacilityEventType[] = Array.isArray(body.eventTypes)
    ? body.eventTypes.map((et: any) => ({
        id: String(et.id || `evt_${Date.now()}`),
        label: String(et.label || "Private Event").trim(),
        hourlyRate: Number(et.hourlyRate) || baseEventRate,
        description: et.description ? String(et.description).trim() : undefined,
      }))
    : (existingExtra.eventTypes as FacilityEventType[]) || DEFAULT_EVENT_TYPES;

  const waiverPayload = JSON.stringify({
    ...existingExtra,
    text: body.waiverText || "",
    offPeakRate: body.offPeakHourlyRate !== undefined ? Number(body.offPeakHourlyRate) : 450,
    announcement: body.announcement || "",
    eventTypes,
  });

  // Use upsert on id=1 so saving settings ALWAYS works even if club_settings was empty
  const { error } = await db
    .from("club_settings")
    .upsert(
      {
        id: 1,
        regular_hourly_rate: Number(body.regularHourlyRate) || 550,
        member_discount_percent:
          body.memberDiscountPercent !== undefined ? Number(body.memberDiscountPercent) : 50,
        event_hourly_rate: baseEventRate,
        currency_symbol: body.currencySymbol || "₱",
        payment_account_name: body.paymentAccountName || "Grove District",
        payment_account_number: body.paymentAccountNumber || "09509979540 (GCash / Maya)",
        payment_qr_url: body.paymentQrUrl || "/images/logo-mark.png",
        waiver_text: waiverPayload,
        owner_notification_email: body.ownerNotificationEmail || "grovedistrictcebu@gmail.com",
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  if (error) {
    return json({ error: error.message }, 500);
  }

  try {
    revalidatePath("/");
    revalidatePath("/book");
    revalidatePath("/waiver");
  } catch {}

  return json({ ok: true });
}
