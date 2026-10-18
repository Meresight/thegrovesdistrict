"use client";

import Image from "next/image";
import { useCallback, useEffect, useState } from "react";
import {
  booking,
  courts,
  DEFAULT_EVENT_TYPES,
  site,
  type CourtId,
  type FacilityEventType,
} from "@/lib/config";
import { addDays, endOfMonth, formatDateLabel, formatHour, nowInClubTz } from "@/lib/time";
import { supabase } from "@/lib/supabase-browser";
import { getMemberToken, useMember } from "@/lib/use-member";
import { LOYALTY_CYCLE, loyaltyProgress, qualifiesForLoyaltyReward as isRewardGame } from "@/lib/loyalty";
import { Honeypot } from "./form-utils";
import { MonthCalendar } from "./MonthCalendar";
import { AuthModal } from "./AuthModal";
import { btnGhost, btnPrimary, eyebrow, input, label } from "./ui";
import { WAIVER_SECTIONS, WAIVER_CONFIRMATION_TEXT, WAIVER_TITLE, WAIVER_PREAMBLE, parseWaiverSections } from "@/lib/waiver";

const SLOTS = Array.from({ length: site.hours.close - site.hours.open }, (_, i) => site.hours.open + i);

type Booked = Record<string, number[]>;
type SelectedSlot = { courtId: CourtId; hour: number };
type Done = { ref: string; summary: string; total: number; isLoyaltyReward: boolean };

type ClubSettings = {
  regularHourlyRate: number;
  offPeakHourlyRate?: number;
  memberDiscountPercent: number;
  eventHourlyRate: number;
  eventTypes?: FacilityEventType[];
  currencySymbol: string;
  paymentAccountName: string;
  paymentAccountNumber: string;
  paymentQrUrl: string;
  waiverText: string;
  announcement?: string;
};

export function BookingPanel() {
  const initialNow = nowInClubTz();
  const [now, setNow] = useState<{ date: string; hour: number }>(initialNow);
  const [date, setDate] = useState(initialNow.date);
  const [bookingType, setBookingType] = useState<"single" | "event_buyout">("single");
  const [selectedEventTypeId, setSelectedEventTypeId] = useState<string>(DEFAULT_EVENT_TYPES[0].id);
  const [selectedSlots, setSelectedSlots] = useState<SelectedSlot[]>([]);
  const [booked, setBooked] = useState<Booked | null>(null);
  const [pending, setPending] = useState<Booked | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  // Stepper state: 'schedule' -> 'checkout'
  const [step, setStep] = useState<"schedule" | "checkout">("schedule");

  // Dynamic club settings
  const [settings, setSettings] = useState<ClubSettings>({
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
  });
  const { user: currentUser } = useMember();
  const [confirmedGames, setConfirmedGames] = useState<number>(0);
  const [hasPendingReward, setHasPendingReward] = useState(false);

  // Checkout inputs & modals
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [receiptPreview, setReceiptPreview] = useState<string | null>(null);
  const [waiverAgreed, setWaiverAgreed] = useState(false);
  const [modalWaiverChecked, setModalWaiverChecked] = useState(false);
  const [hasScrolledToBottom, setHasScrolledToBottom] = useState(false);
  const [showWaiverModal, setShowWaiverModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);
  const [authMode, setAuthMode] = useState<"signin" | "signup" | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);

  useEffect(() => {
    const n = nowInClubTz();
    setNow(n);
    setDate(n.date);

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("mode") === "event") {
        setBookingType("event_buyout");
      }
    }

    function loadFreshSettings() {
      fetch(`/api/settings?t=${Date.now()}`, { cache: "no-store" })
        .then((r) => r.json())
        .then((d) => {
          if (d.settings) setSettings(d.settings);
        })
        .catch(() => {});
    }

    loadFreshSettings();
    window.addEventListener("focus", loadFreshSettings);
    return () => window.removeEventListener("focus", loadFreshSettings);
  }, []);

  // Loyalty progress comes from the server (bookings are locked by RLS for browsers).
  useEffect(() => {
    if (!currentUser) {
      setConfirmedGames(0);
      setHasPendingReward(false);
      return;
    }
    let cancelled = false;
    getMemberToken().then(async (token) => {
      if (!token) return;
      const res = await fetch("/api/member/bookings", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (cancelled) return;
      setConfirmedGames(data.confirmedCount ?? 0);
      setHasPendingReward(Boolean(data.hasPendingReward));
    });
    return () => {
      cancelled = true;
    };
  }, [currentUser?.id, refresh]);

  useEffect(() => {
    if (!date) return;
    const ac = new AbortController();
    setBooked(null);
    setNotice(null);
    fetch(`/api/availability?date=${date}`, { signal: ac.signal })
      .then(async (r) => {
        const data = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(data.error ?? "Availability unavailable");
        setBooked(data.booked ?? {});
        setPending(data.pending ?? {});
      })
      .catch((e: Error) => {
        if (e.name === "AbortError") return;
        setBooked({});
        setPending({});
        setNotice("Live availability couldn’t be loaded right now.");
      });
    return () => ac.abort();
  }, [date, refresh]);

  const isSlotBooked = useCallback(
    (cId: CourtId, h: number) => {
      if (!booked) return false;
      return (booked[cId] ?? []).includes(h);
    },
    [booked]
  );

  const isSlotPending = useCallback(
    (cId: CourtId, h: number) => {
      if (!pending) return false;
      return (pending[cId] ?? []).includes(h);
    },
    [pending]
  );

  const isPast = useCallback(
    (h: number) => Boolean(now && date === now.date && h <= now.hour),
    [now, date]
  );

  // Toggle cell on matrix
  function toggleCell(cId: CourtId, h: number) {
    setError(null);

    if (bookingType === "event_buyout") {
      // Event buyout locks all 3 courts simultaneously for that hour
      const allSelectedForHour = courts.every((c) =>
        selectedSlots.some((s) => s.courtId === c.id && s.hour === h)
      );

      if (allSelectedForHour) {
        setSelectedSlots((prev) => prev.filter((s) => s.hour !== h));
      } else {
        const newSlots = courts.map((c) => ({ courtId: c.id, hour: h }));
        setSelectedSlots((prev) => [...prev.filter((s) => s.hour !== h), ...newSlots]);
      }
      return;
    }

    // Single court: User can select ANY open slot across Court 1, 2, or 3
    const exists = selectedSlots.some((s) => s.courtId === cId && s.hour === h);
    if (exists) {
      setSelectedSlots((prev) => prev.filter((s) => !(s.courtId === cId && s.hour === h)));
    } else {
      setSelectedSlots((prev) => [...prev, { courtId: cId, hour: h }]);
    }
  }

  // Slot rate helper: Off-peak (8am-4pm / hours 8-15), Peak (4pm-2am / hours 16-25)
  function getSlotRate(h: number): number {
    const offPeak = settings.offPeakHourlyRate ?? booking.defaultOffPeakRate;
    const peak = settings.regularHourlyRate ?? booking.defaultPeakRate;
    return h >= 8 && h < 16 ? offPeak : peak;
  }

  // Price calculations & Event/Tournament types
  const eventTypesList =
    settings.eventTypes && settings.eventTypes.length > 0
      ? settings.eventTypes
      : DEFAULT_EVENT_TYPES;
  const selectedEventType =
    eventTypesList.find((e) => e.id === selectedEventTypeId) ?? eventTypesList[0];
  const activeEventHourlyRate = selectedEventType?.hourlyRate ?? settings.eventHourlyRate;

  const distinctHours = Array.from(new Set(selectedSlots.map((s) => s.hour))).sort((a, b) => a - b);
  const isEvent = bookingType === "event_buyout";
  const rawTotal = isEvent
    ? activeEventHourlyRate * distinctHours.length
    : selectedSlots.reduce((sum, s) => sum + getSlotRate(s.hour), 0);

  // Loyalty reward: after every 10 confirmed games the next booking gets 50% off up to TWO court-hours (2 courts or 2 hours).
  const loyalty = loyaltyProgress(confirmedGames);
  const qualifiesForLoyaltyReward =
    Boolean(currentUser) && isRewardGame(confirmedGames) && !hasPendingReward && !isEvent && selectedSlots.length > 0;
  // Apply 50% discount to up to TWO court-hour slots
  const discountableSubtotal = selectedSlots.slice(0, 2).reduce((sum, s) => sum + getSlotRate(s.hour), 0);
  const discountAmount = qualifiesForLoyaltyReward
    ? Math.round((discountableSubtotal * settings.memberDiscountPercent) / 100)
    : 0;
  const finalTotal = Math.max(0, rawTotal - discountAmount);

  const summary = selectedSlots.length
    ? isEvent
      ? `${selectedEventType?.label ?? "Full Facility"} (All 3 Courts) · ${formatDateLabel(date)} · ${distinctHours.map((h) => formatHour(h)).join(", ")}`
      : `${selectedSlots.map((s) => `${courts.find((c) => c.id === s.courtId)?.name} (${formatHour(s.hour)})`).join(", ")} · ${formatDateLabel(date)}`
    : null;

  async function submitBooking(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!summary || selectedSlots.length === 0) return;
    if (!receiptFile) {
      setError("Please attach a screenshot or photo of your payment receipt.");
      return;
    }
    if (!waiverAgreed) {
      setError("Please read and accept the safety waiver before submitting.");
      return;
    }

    const fd = new FormData(e.currentTarget);
    setSubmitting(true);
    setError(null);

    let uploadedReceiptUrl = "";

    try {
      if (receiptFile) {
        // Upload receipt via server-side /api/upload endpoint for guaranteed delivery
        const uploadData = new FormData();
        uploadData.append("file", receiptFile);
        const upRes = await fetch("/api/upload", {
          method: "POST",
          body: uploadData,
        });
        const upJson = await upRes.json();
        if (upRes.ok && upJson.url) {
          uploadedReceiptUrl = upJson.url;
        } else if (supabase) {
          const fileExt = receiptFile.name.split(".").pop();
          const fileName = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}.${fileExt}`;
          const { error: uploadError } = await supabase.storage
            .from("receipts")
            .upload(fileName, receiptFile);

          if (!uploadError) {
            const { data: pubData } = supabase.storage.from("receipts").getPublicUrl(fileName);
            uploadedReceiptUrl = pubData.publicUrl;
          }
        }
      }

      const authToken = currentUser ? await getMemberToken() : null;

      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (authToken) headers["Authorization"] = `Bearer ${authToken}`;

      const res = await fetch("/api/bookings", {
        method: "POST",
        headers,
        body: JSON.stringify({
          bookingType,
          eventTypeId: isEvent ? selectedEventType?.id : undefined,
          courtId: selectedSlots[0].courtId,
          date,
          hours: distinctHours,
          slots: selectedSlots,
          name: fd.get("name"),
          email: fd.get("email"),
          phone: fd.get("phone"),
          players: Number(fd.get("players")) > 0 ? Number(fd.get("players")) : 4,
          notes: fd.get("notes") || undefined,
          receiptUrl: uploadedReceiptUrl || undefined,
          waiverAgreed,
          website: fd.get("website") || "",
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
        if (res.status === 409) {
          setSelectedSlots([]);
          setStep("schedule");
          setRefresh((k) => k + 1);
        }
        return;
      }

      setDone({
        ref: data.ref,
        summary,
        total: data.totalPrice ?? finalTotal,
        isLoyaltyReward: qualifiesForLoyaltyReward,
      });
      setSelectedSlots([]);
      setReceiptFile(null);
      setStep("schedule");
      setRefresh((k) => k + 1);
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="w-full bg-white px-6 py-12 md:py-16">
        <div className="mx-auto max-w-md text-center space-y-6">
          <div className="mx-auto size-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 text-xl">
            ✓
          </div>
          <div className="space-y-1.5">
            <p className={eyebrow}>Reservation Received</p>
            <h2 className="text-2xl font-semibold tracking-tight text-ink">You're all set — pending payment check</h2>
            <p className="text-xs text-mute leading-relaxed">
              Your slot is reserved. Our staff will verify your payment receipt and confirm shortly.
            </p>
          </div>

          <div className="rounded-2xl border border-line bg-zinc-50/70 p-5 text-left space-y-3 text-xs">
            <div className="flex justify-between">
              <span className="text-mute">Reference</span>
              <span className="font-mono font-bold text-ink">#{done.ref}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-mute shrink-0">Details</span>
              <span className="text-ink text-right">{done.summary}</span>
            </div>
            {done.isLoyaltyReward && (
              <div className="flex justify-between text-emerald-700 font-medium">
                <span>Loyalty reward applied</span>
                <span>{settings.memberDiscountPercent}% off (up to 2 hrs / 2 courts)</span>
              </div>
            )}
            <div className="flex justify-between items-baseline pt-3 border-t border-line">
              <span className="text-mute">Total</span>
              <span className="font-mono text-lg font-bold text-ink">
                {settings.currencySymbol}
                {done.total}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-mute">Status</span>
              <span className="rounded-full bg-amber-50 border border-amber-300 px-2.5 py-0.5 text-[10px] font-bold uppercase text-amber-800">
                Awaiting payment check
              </span>
            </div>
          </div>

          <div className="rounded-2xl border border-line bg-white p-4 text-left space-y-1 text-xs">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-mute font-semibold">
              Booking Reference · <span className="text-ink">#{done.ref}</span>
            </p>
            <p className="text-[11px] text-mute leading-relaxed">
              Save your reference code. After your scheduled game finishes, you can rate our hospitality, courts, and café at{" "}
              <a href={`/survey?ref=${done.ref}`} className="font-medium underline text-ink">
                /survey?ref={done.ref}
              </a>{" "}
              (works for both Members and Guests).
            </p>
          </div>

          <p className="text-[11px] text-mute">All bookings are final and non-refundable.</p>

          <div className="flex flex-col sm:flex-row gap-2 justify-center">
            {currentUser ? (
              <a href="/member" className={`${btnPrimary} px-5 py-2.5 text-xs`}>
                View My Reservations →
              </a>
            ) : (
              <p className="text-[11px] text-mute">
                Tip: sign up with the same email to track your games and earn loyalty rewards.
              </p>
            )}
            <button type="button" onClick={() => setDone(null)} className={`${btnGhost} px-5 py-2.5 text-xs`}>
              Book Another Court
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full bg-white">
      {/* Top Member Club Bar — allows inline Join Free / Sign In without leaving /book */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3 bg-zinc-50 border-b border-line text-xs">
        {currentUser ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] bg-ink text-white px-2 py-0.5 rounded">
              Member Active
            </span>
            <span className="font-mono text-ink font-medium">{currentUser.email}</span>
            <span className="text-mute">·</span>
            <span className="font-mono text-[11px] text-emerald-700 font-medium">
              {loyalty.eligible
                ? "50% Off Reward Unlocked (2 Courts / 2 Hrs)"
                : `${loyalty.completed} / 10 Games toward 50% Off`}
            </span>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2 text-mute">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-ink font-semibold">
              Member Club ·
            </span>
            <span>
              Join for free to count this booking toward <strong className="text-ink">50% off up to 2 courts / 2 hours</strong> every 10 games.
            </span>
          </div>
        )}

        <div className="flex items-center gap-3">
          {currentUser ? (
            <a href="/member" className="font-mono text-[11px] uppercase tracking-wider text-ink underline hover:opacity-75">
              My Games →
            </a>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setAuthMode("signup")}
                className="rounded-full bg-ink text-white px-3.5 py-1 text-[11px] font-medium hover:bg-black/85 transition cursor-pointer"
              >
                Join Free
              </button>
              <button
                type="button"
                onClick={() => setAuthMode("signin")}
                className="font-mono text-[11px] uppercase tracking-wider text-ink underline hover:opacity-75 cursor-pointer"
              >
                Sign In
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stepper Navigation */}
      <div className="flex items-center justify-between px-5 md:px-6 py-2.5 border-b border-line bg-white text-[11px] font-mono tracking-wider">
        <div className="flex items-center gap-3">
          <span className={step === "schedule" ? "text-ink font-semibold flex items-center gap-1.5" : "text-mute flex items-center gap-1.5"}>
            <span className={`size-4 rounded-full flex items-center justify-center text-[10px] ${step === "schedule" ? "bg-ink text-white" : "border border-line text-mute"}`}>
              1
            </span>
            SCHEDULE
          </span>
          <span className="text-line">/</span>
          <span className={step === "checkout" ? "text-ink font-semibold flex items-center gap-1.5" : "text-mute flex items-center gap-1.5"}>
            <span className={`size-4 rounded-full flex items-center justify-center text-[10px] ${step === "checkout" ? "bg-ink text-white" : "border border-line text-mute"}`}>
              2
            </span>
            CHECKOUT
          </span>
        </div>
        {step === "checkout" ? (
          <button
            type="button"
            onClick={() => setStep("schedule")}
            className="text-mute hover:text-ink transition flex items-center gap-1 cursor-pointer"
          >
            ← Back to Schedule
          </button>
        ) : (
          <span className="text-mute text-[10px] hidden sm:inline">
            {selectedSlots.length === 0
              ? "Select court slots below"
              : `${selectedSlots.length} slot${selectedSlots.length > 1 ? "s" : ""} selected`}
          </span>
        )}
      </div>

      {/* ================= STEP 1: CALENDAR & MULTI-COURT SCHEDULE ================= */}
      {step === "schedule" && (
        <div className={`grid grid-cols-1 lg:grid-cols-[340px_1fr_320px] divide-y lg:divide-y-0 lg:divide-x divide-line ${selectedSlots.length > 0 ? "pb-20 lg:pb-0" : ""}`}>
          {/* Column 1: Month Calendar Picker */}
          <div className="p-5 md:p-6 space-y-5 bg-white">
            <div>
              <p className={eyebrow}>1 · Select Date</p>
              <h3 className="mt-1 text-base font-semibold text-ink">Choose Day</h3>
            </div>

            <MonthCalendar
              selectedDate={date}
              onSelectDate={(newDate) => {
                setDate(newDate);
                setSelectedSlots([]);
                setDone(null);
              }}
              minDate={now.date}
              maxDate={endOfMonth(now.date)}
            />

            {/* Booking Type Selector */}
            <div className="pt-3 border-t border-line space-y-2.5">
              <p className={eyebrow}>Reservation Mode</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setBookingType("single");
                    setSelectedSlots([]);
                  }}
                  className={`py-2 px-3 rounded-xl border text-xs font-medium transition ${
                    bookingType === "single"
                      ? "border-ink bg-ink text-white"
                      : "border-line bg-zinc-50 text-mute hover:border-ink hover:text-ink"
                  }`}
                >
                  Single Court
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setBookingType("event_buyout");
                    setSelectedSlots([]);
                  }}
                  className={`py-2 px-3 rounded-xl border text-xs font-medium transition ${
                    bookingType === "event_buyout"
                      ? "border-ink bg-ink text-white"
                      : "border-line bg-zinc-50 text-mute hover:border-ink hover:text-ink"
                  }`}
                >
                  Full Facility
                </button>
              </div>
              <p className="text-[11px] text-mute leading-relaxed">
                {bookingType === "single"
                  ? "Book any open court (Court 1, 2, or 3) for recreation or match play."
                  : "Private event or tournament: locks all 3 courts together for your group."}
              </p>

              {/* Event / Tournament Package Selector when Full Facility is active */}
              {bookingType === "event_buyout" && (
                <div className="pt-2 space-y-2 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-mono uppercase tracking-[0.16em] text-ink font-semibold">
                      Select Event / Tournament Type
                    </p>
                    <span className="text-[10px] font-mono text-wine font-semibold">
                      All 3 Courts
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {eventTypesList.map((evt) => {
                      const active = selectedEventType?.id === evt.id;
                      return (
                        <button
                          key={evt.id}
                          type="button"
                          onClick={() => setSelectedEventTypeId(evt.id)}
                          className={`w-full text-left p-2.5 rounded-xl border transition flex items-center justify-between gap-2 ${
                            active
                              ? "border-ink bg-ink text-white shadow-sm"
                              : "border-line bg-zinc-50/80 text-ink hover:border-ink/50"
                          }`}
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-semibold truncate">{evt.label}</p>
                            {evt.description && (
                              <p
                                className={`text-[10px] truncate ${
                                  active ? "text-white/75" : "text-mute"
                                }`}
                              >
                                {evt.description}
                              </p>
                            )}
                          </div>
                          <span
                            className={`shrink-0 font-mono text-xs font-bold px-2 py-0.5 rounded-md ${
                              active
                                ? "bg-white/15 text-white"
                                : "bg-white border border-line text-ink"
                            }`}
                          >
                            {settings.currencySymbol}
                            {evt.hourlyRate}/hr
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Column 2: Multi-Court Schedule Matrix */}
          <div className="p-5 md:p-6 space-y-5 bg-white overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-line">
              <div>
                <p className={eyebrow}>2 · Select Time Slots</p>
                <h3 className="mt-0.5 text-base font-semibold text-ink">
                  {formatDateLabel(date, { weekday: "long", month: "short", day: "numeric" })}
                </h3>
              </div>

              <div className="flex flex-wrap items-center gap-3 text-[11px] font-mono text-mute">
                {isEvent ? (
                  <span className="font-medium text-ink bg-zinc-100 border border-line px-2.5 py-1 rounded-full">
                    {selectedEventType?.label}: {settings.currencySymbol}
                    {activeEventHourlyRate}/hr (All 3 Courts)
                  </span>
                ) : (
                  <>
                    <span>
                      8AM–4PM: <strong className="text-ink">{settings.currencySymbol}{settings.offPeakHourlyRate ?? booking.defaultOffPeakRate}</strong>
                    </span>
                    <span>·</span>
                    <span>
                      4PM–2AM: <strong className="text-ink">{settings.currencySymbol}{settings.regularHourlyRate ?? booking.defaultPeakRate}</strong>
                    </span>
                  </>
                )}
              </div>
            </div>

            {settings.announcement && (
              <div className="rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-2.5 text-xs text-amber-950 flex items-start gap-2.5">
                <span className="font-semibold uppercase tracking-wider text-[10px] bg-amber-200 text-amber-900 px-1.5 py-0.5 rounded shrink-0">
                  Notice
                </span>
                <span className="leading-relaxed">{settings.announcement}</span>
              </div>
            )}

            {/* Schedule Table */}
            <div className="overflow-x-auto border border-line rounded-xl">
              <table className="w-full text-left border-collapse min-w-[440px]">
                <thead>
                  <tr className="border-b border-line bg-zinc-50 text-[11px] uppercase tracking-wider text-mute">
                    <th className="py-2.5 px-3 font-medium w-28">Hour</th>
                    {courts.map((c) => (
                      <th key={c.id} className="py-2.5 px-3 font-medium text-center">
                        <div className="text-ink font-semibold">{c.name}</div>
                        <div className="text-[10px] text-mute lowercase">{c.note}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line text-xs">
                  {SLOTS.map((h) => {
                    const isHourPast = isPast(h);
                    return (
                      <tr key={h} className="hover:bg-zinc-50/50 transition">
                        <td className="py-2 px-3 font-mono text-[11px] text-mute whitespace-nowrap">
                          {formatHour(h)}
                        </td>

                        {courts.map((c) => {
                          const isBooked = isSlotBooked(c.id, h);
                          const isPending = isSlotPending(c.id, h);
                          const isSelected = selectedSlots.some(
                            (s) => s.courtId === c.id && s.hour === h
                          );
                          const disabled = isHourPast || isBooked;

                          const cellPrice = isEvent
                            ? Math.round(activeEventHourlyRate / 3)
                            : getSlotRate(h);

                          return (
                            <td key={c.id} className="p-1 text-center">
                              {disabled ? (
                                <div
                                  className={`py-2 px-2.5 rounded-lg font-mono text-[10px] cursor-not-allowed ${
                                    isBooked
                                      ? "bg-zinc-200 text-zinc-600 font-semibold"
                                      : "bg-zinc-100 text-zinc-400"
                                  }`}
                                >
                                  {isBooked ? "BOOKED" : "PAST"}
                                </div>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => toggleCell(c.id, h)}
                                  className={`w-full py-2 px-2.5 rounded-lg border font-mono text-[11px] font-medium transition active:scale-[0.98] cursor-pointer ${
                                    isSelected
                                      ? "bg-ink text-white border-ink font-semibold shadow-2xs"
                                      : isPending
                                      ? "bg-amber-50/70 text-amber-900 border-amber-300 hover:border-ink"
                                      : "bg-white text-ink border-line hover:border-ink hover:bg-zinc-50"
                                  }`}
                                >
                                  {isSelected ? "SELECTED" : `${settings.currencySymbol}${cellPrice}`}
                                </button>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Table Status Legend */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[10px] font-mono text-mute pt-1">
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded border border-line bg-white inline-block"></span>
                <span>Available</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded bg-ink inline-block"></span>
                <span className="text-ink font-semibold">Selected</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded border border-amber-300 bg-amber-50 inline-block"></span>
                <span className="text-amber-800">Held (Verification Pending)</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="size-2.5 rounded bg-zinc-200 inline-block"></span>
                <span>Booked</span>
              </span>
            </div>

            {notice && <p className="text-xs text-mute">{notice}</p>}
            {error && <p className="text-xs text-wine font-medium">{error}</p>}
          </div>

          {/* Column 3: Cart & Review CTA */}
          <div className="p-5 md:p-6 bg-white flex flex-col justify-between space-y-6">
            <div className="space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-line">
                <p className={eyebrow}>3 · Summary</p>
                <span className="text-xs font-mono text-mute">{selectedSlots.length} slot(s)</span>
              </div>

              {selectedSlots.length === 0 ? (
                <div className="rounded-xl border border-dashed border-line p-6 text-center text-xs text-mute space-y-1">
                  <p className="font-medium text-ink">No slots selected</p>
                  <p className="text-[11px] leading-relaxed">
                    Tap any available slot on Court 1, 2, or 3 to add to your reservation.
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="rounded-xl border border-line p-3 bg-zinc-50 space-y-2">
                    <div className="flex justify-between items-center text-xs">
                      <span className="font-semibold text-ink">
                        {isEvent ? selectedEventType?.label ?? "Full Facility Buyout" : "Selected Courts"}
                      </span>
                      <span className="text-mute">{formatDateLabel(date)}</span>
                    </div>

                    <div className="flex flex-col gap-1 pt-1">
                      {selectedSlots.map((s, idx) => (
                        <div
                          key={idx}
                          className="flex justify-between items-center text-[11px] font-mono text-ink bg-white border border-line rounded px-2 py-1"
                        >
                          <span>{courts.find((c) => c.id === s.courtId)?.name}</span>
                          <span className="font-medium">{formatHour(s.hour)}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Price breakdown */}
                  <div className="pt-2 space-y-1.5 text-xs text-mute border-t border-line">
                    <div className="flex justify-between">
                      <span>
                        {isEvent
                          ? `${selectedEventType?.label} (${distinctHours.length} hr${distinctHours.length > 1 ? "s" : ""})`
                          : `Court Rate (${selectedSlots.length} slot${selectedSlots.length > 1 ? "s" : ""})`}
                      </span>
                      <span className="font-mono text-ink">{settings.currencySymbol}{rawTotal}</span>
                    </div>

                    {qualifiesForLoyaltyReward && (
                      <div className="flex justify-between text-emerald-600 font-medium">
                        <span>Loyalty Perk (50% Off Up to 2 Hrs / 2 Courts)</span>
                        <span className="font-mono">-{settings.currencySymbol}{discountAmount}</span>
                      </div>
                    )}

                    <div className="flex justify-between text-sm font-semibold text-ink pt-2 border-t border-line">
                      <span>Total Amount</span>
                      <span className="font-mono text-base">{settings.currencySymbol}{finalTotal}</span>
                    </div>
                  </div>

                  {/* Loyalty progress */}
                  <div className="rounded-lg border border-line p-2.5 bg-zinc-50 text-[11px] text-mute space-y-1">
                    <div className="flex items-center justify-between font-medium text-ink">
                      <span>Member Loyalty Card</span>
                      <span className="font-mono">{currentUser ? `${loyalty.completed} / 10 Games` : "Member Club"}</span>
                    </div>
                    {currentUser ? (
                      <p className="text-[10px]">
                        {loyalty.eligible
                          ? "Reward active: 50% off up to 2 court-hours (2 hrs / 2 courts) on your next booking."
                          : `Play ${loyalty.remaining} more confirmed game${loyalty.remaining === 1 ? "" : "s"} to get 50% off up to 2 courts / 2 hours on booking #${loyalty.rewardBookingNumber}.`}
                      </p>
                    ) : (
                      <p className="text-[10px] text-mute">
                        <button
                          type="button"
                          onClick={() => setAuthMode("signup")}
                          className="text-wine font-medium underline cursor-pointer"
                        >
                          Join Free
                        </button>{" "}
                        or{" "}
                        <button
                          type="button"
                          onClick={() => setAuthMode("signin")}
                          className="text-ink font-medium underline cursor-pointer"
                        >
                          Sign In
                        </button>{" "}
                        to count this game toward 50% off (2 hrs / 2 courts) every 10 games.
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div>
              <button
                type="button"
                disabled={selectedSlots.length === 0}
                onClick={() => setStep("checkout")}
                className={`${btnPrimary} w-full py-3 text-xs`}
              >
                Review Booking →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= STEP 2: VELOCITY-INSPIRED 2-COLUMN CHECKOUT ================= */}
      {step === "checkout" && (
        <div className="p-6 md:p-10 max-w-5xl mx-auto">
          {/* Back button */}
          <button
            type="button"
            onClick={() => setStep("schedule")}
            className="text-xs text-mute hover:text-ink flex items-center gap-1.5 mb-6"
          >
            ← Back to Schedule
          </button>

          <form onSubmit={submitBooking}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
              {/* Left Column: Booking Summary Card */}
              <div className="space-y-5">
                <h2 className="text-2xl font-bold tracking-tight text-ink">Booking Summary</h2>

                {/* Member Club Card / Status */}
                {!currentUser ? (
                  <div className="rounded-2xl border border-line bg-white p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[9px] uppercase tracking-[0.16em] bg-zinc-100 text-ink px-1.5 py-0.5 rounded border border-line font-semibold">
                          Member Club
                        </span>
                        <span className="text-xs font-semibold text-ink">
                          Track loyalty on this booking
                        </span>
                      </div>
                      <p className="text-[11px] text-mute">
                        Count this game toward 50% off every 10 games. Free forever.
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setAuthMode("signup")}
                        className="rounded-full bg-ink text-white px-3.5 py-1.5 text-xs font-medium hover:bg-black transition cursor-pointer"
                      >
                        Join Free
                      </button>
                      <button
                        type="button"
                        onClick={() => setAuthMode("signin")}
                        className="rounded-full border border-line bg-white text-ink px-3.5 py-1.5 text-xs font-medium hover:border-ink transition cursor-pointer"
                      >
                        Sign In
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-line bg-white p-4 flex items-center justify-between gap-3 shadow-2xs">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="font-mono text-[9px] uppercase tracking-[0.16em] bg-ink text-white px-2 py-0.5 rounded font-semibold shrink-0">
                        Member Active
                      </span>
                      <span className="font-mono text-xs text-ink truncate">
                        {currentUser.email}
                      </span>
                    </div>
                    <span className="font-mono text-xs text-emerald-700 font-semibold shrink-0">
                      {loyalty.eligible ? "50% Off Ready" : `${loyalty.completed} / 10 Games`}
                    </span>
                  </div>
                )}

                {/* Contact Details Card */}
                <div className="rounded-2xl border border-line bg-zinc-50/70 p-5 space-y-3">
                  <p className={eyebrow}>Player Contact Information</p>
                  <div>
                    <label className={label} htmlFor="v-name">Full Name</label>
                    <input
                      id="v-name"
                      name="name"
                      required
                      minLength={2}
                      defaultValue={currentUser?.email?.split("@")[0] || ""}
                      className={input}
                      placeholder="Alex Rivera"
                    />
                  </div>
                  <div>
                    <label className={label} htmlFor="v-email">Email Address</label>
                    <input
                      id="v-email"
                      name="email"
                      type="email"
                      required
                      defaultValue={currentUser?.email || ""}
                      className={input}
                      placeholder="alex@example.com"
                    />
                  </div>
                  <div>
                    <label className={label} htmlFor="v-phone">Mobile Phone</label>
                    <input
                      id="v-phone"
                      name="phone"
                      type="tel"
                      required
                      className={input}
                      placeholder="0917 123 4567"
                    />
                  </div>
                  {isEvent ? (
                    <div>
                      <label className={label} htmlFor="v-players">Estimated Attendees</label>
                      <input
                        id="v-players"
                        name="players"
                        type="number"
                        min={1}
                        max={60}
                        defaultValue={12}
                        className={input}
                        placeholder="e.g. 15 players"
                      />
                    </div>
                  ) : (
                    <input type="hidden" name="players" value="4" />
                  )}
                </div>

                {/* Reservation Details Card */}
                <div className="rounded-2xl border border-line bg-zinc-50/70 p-5 space-y-3">
                  <p className={eyebrow}>Reservation Details</p>
                  <div className="flex justify-between text-xs pb-2 border-b border-line">
                    <span className="text-mute">Date</span>
                    <span className="font-semibold text-ink">{formatDateLabel(date, { weekday: "long", month: "long", day: "numeric" })}</span>
                  </div>

                  {isEvent && (
                    <div className="flex justify-between text-xs pb-2 border-b border-line">
                      <span className="text-mute">Event Package</span>
                      <span className="font-semibold text-wine">{selectedEventType?.label}</span>
                    </div>
                  )}

                  <div className="space-y-1.5 pt-1">
                    {selectedSlots.map((s, idx) => (
                      <div key={idx} className="flex justify-between text-xs">
                        <span className="text-mute">
                          {isEvent ? `Full Facility (${courts.find((c) => c.id === s.courtId)?.name})` : courts.find((c) => c.id === s.courtId)?.name} · {formatHour(s.hour)}
                          {!isEvent && (
                            <span className="text-[10px] text-zinc-400 ml-1.5">
                              ({s.hour >= 8 && s.hour < 16 ? "Off-Peak" : "Peak"})
                            </span>
                          )}
                        </span>
                        <span className="font-mono text-ink">
                          {settings.currencySymbol}{isEvent ? Math.round(activeEventHourlyRate / 3) : getSlotRate(s.hour)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {qualifiesForLoyaltyReward && (
                    <div className="flex justify-between text-xs text-emerald-600 font-medium pt-2 border-t border-line">
                      <span>Loyalty Perk (50% Off Up to 2 Hrs / 2 Courts)</span>
                      <span className="font-mono">-{settings.currencySymbol}{discountAmount}</span>
                    </div>
                  )}

                  <div className="flex justify-between items-baseline pt-4 border-t border-line text-ink">
                    <span className="text-base font-bold">Total</span>
                    <span className="text-2xl font-bold font-mono">
                      {settings.currencySymbol}{finalTotal}
                    </span>
                  </div>
                </div>
              </div>

              {/* Right Column: Velocity 4-Step Payment & Verification */}
              <div className="space-y-5">
                {/* 1. Scan to Pay Card */}
                <div className="rounded-2xl border border-line bg-white p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="size-5 rounded-full bg-ink text-white text-[10px] font-bold flex items-center justify-center">1</span>
                      <span className="text-xs font-semibold uppercase tracking-wider text-ink">Scan to Pay</span>
                    </div>
                    <span className="rounded bg-zinc-100 px-2 py-0.5 text-[10px] font-mono text-mute">QR PH / INSTAPAY</span>
                  </div>

                  <div className="flex flex-col items-center p-5 border border-line rounded-xl bg-white space-y-3">
                    <button
                      type="button"
                      onClick={() => setShowQrModal(true)}
                      className="relative size-48 border border-line rounded-xl p-2.5 bg-white hover:border-ink transition cursor-pointer"
                      aria-label="Expand payment QR code"
                    >
                      <Image
                        src={settings.paymentQrUrl}
                        alt="Payment QR"
                        fill
                        unoptimized
                        className="object-contain p-1.5"
                      />
                    </button>

                    <div className="text-center space-y-0.5">
                      <p className="font-semibold text-ink text-sm">{settings.paymentAccountName}</p>
                      <p className="font-mono text-xs text-mute">{settings.paymentAccountNumber}</p>
                    </div>

                    <div className="w-full pt-3 border-t border-line flex items-center justify-center gap-6">
                      <button
                        type="button"
                        onClick={() => setShowQrModal(true)}
                        className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink/80 hover:text-ink transition cursor-pointer"
                      >
                        <svg className="size-3.5 stroke-[1.6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                        </svg>
                        <span>Expand QR</span>
                      </button>
                      <span className="h-3 w-px bg-line" aria-hidden="true" />
                      <a
                        href={settings.paymentQrUrl}
                        download="grove-district-payment-qr.png"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-ink/80 hover:text-ink transition"
                      >
                        <svg className="size-3.5 stroke-[1.6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                        </svg>
                        <span>Download</span>
                      </a>
                    </div>
                  </div>

                  {/* Red Warning Callout */}
                  <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-3.5 text-xs text-rose-800 space-y-1">
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] font-semibold flex items-center gap-1.5 text-rose-900">
                      <svg className="size-3.5 stroke-[1.75] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
                      </svg>
                      <span>Important · Receipt Required</span>
                    </p>
                    <p className="text-[11px] leading-relaxed text-rose-700">
                      Your court slot is <strong>not reserved</strong> until you upload your transfer receipt and tap <strong>Confirm Reservation</strong> below.
                    </p>
                  </div>
                </div>

                {/* 2. Upload Payment Receipt with Instant Visual Preview */}
                <div className="rounded-2xl border border-line bg-white p-5 shadow-sm space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="size-5 rounded-full bg-ink text-white text-[10px] font-bold flex items-center justify-center">2</span>
                      <span className="text-xs font-semibold uppercase tracking-wider text-ink">Upload Payment Receipt</span>
                    </div>
                    {receiptFile && (
                      <span className="text-[10px] font-mono text-emerald-600 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                        ✓ File Attached
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-mute">Upload a clear screenshot of your GCash, Maya, or bank transfer confirmation.</p>

                  {receiptPreview ? (
                    <div className="relative rounded-xl border border-line bg-zinc-50 p-3 space-y-2.5">
                      <div className="relative w-full h-48 rounded-lg overflow-hidden border border-line/60 bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={receiptPreview}
                          alt="Receipt preview"
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <div className="flex items-center justify-between text-xs pt-1">
                        <span className="truncate max-w-[200px] font-mono text-[11px] text-mute">
                          {receiptFile?.name}
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            setReceiptFile(null);
                            setReceiptPreview(null);
                          }}
                          className="text-[11px] font-medium text-rose-600 hover:text-rose-700 underline"
                        >
                          Remove / Change
                        </button>
                      </div>
                    </div>
                  ) : (
                    <label className="relative flex flex-col items-center justify-center p-6 border-2 border-dashed border-zinc-300 rounded-xl hover:border-ink hover:bg-zinc-50/50 cursor-pointer transition text-center group">
                      <div className="size-10 rounded-full bg-zinc-100 flex items-center justify-center text-ink group-hover:scale-110 transition mb-2">
                        <svg className="size-5 stroke-[1.5]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.5V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                        </svg>
                      </div>
                      <span className="text-xs font-semibold text-ink">
                        Tap or drag to upload receipt
                      </span>
                      <span className="text-[10px] text-mute mt-1">PNG, JPG, or WEBP screenshot (up to 10MB)</span>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/heic"
                        required
                        onChange={(e) => {
                          const f = e.target.files?.[0] || null;
                          setReceiptFile(f);
                          if (f) {
                            const url = URL.createObjectURL(f);
                            setReceiptPreview(url);
                          } else {
                            setReceiptPreview(null);
                          }
                        }}
                        className="absolute inset-0 opacity-0 cursor-pointer"
                      />
                    </label>
                  )}
                </div>

                {/* 3. WAIVER & RELEASE OF LIABILITY */}
                <div className="rounded-2xl border border-line bg-white p-5 shadow-sm space-y-3.5">
                  <div className="flex items-center gap-2">
                    <span className="size-5 rounded-full bg-ink text-white text-[10px] font-bold flex items-center justify-center">3</span>
                    <span className="text-xs font-semibold uppercase tracking-wider text-ink">Waiver & Release of Liability</span>
                  </div>
                  <p className="text-xs text-mute leading-relaxed">
                    Read the full waiver and confirm you agree before booking.
                  </p>

                  {waiverAgreed ? (
                    <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3.5 flex items-center justify-between">
                      <div className="flex items-center gap-2.5 text-emerald-800 text-xs font-semibold">
                        <span className="size-5 rounded-full bg-emerald-600 text-white flex items-center justify-center text-[11px]">✓</span>
                        <span>Waiver & Rules Accepted</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setModalWaiverChecked(true);
                          setHasScrolledToBottom(true);
                          setShowWaiverModal(true);
                        }}
                        className="text-[11px] font-medium text-ink underline hover:opacity-75"
                      >
                        View Waiver
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setModalWaiverChecked(false);
                        setHasScrolledToBottom(false);
                        setShowWaiverModal(true);
                      }}
                      className="w-full rounded-xl bg-ink text-white py-3.5 px-4 text-xs font-semibold hover:bg-black/85 transition flex items-center justify-center gap-2 shadow-sm"
                    >
                      <svg className="size-4 stroke-[1.8]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                      </svg>
                      <span>Read & Accept Waiver</span>
                    </button>
                  )}
                </div>

                {/* 4. Confirm Reservation Card */}
                <div className="rounded-2xl border border-line bg-white p-5 shadow-sm space-y-4">
                  <div className="flex items-center justify-between pb-2 border-b border-line">
                    <div className="flex items-center gap-2">
                      <span className="size-5 rounded-full bg-ink text-white text-[10px] font-bold flex items-center justify-center">4</span>
                      <span className="text-xs font-semibold uppercase tracking-wider text-ink">Confirm Reservation</span>
                    </div>
                    <span className="text-xs text-mute font-mono">{selectedSlots.length} slot(s)</span>
                  </div>

                  <div className="flex justify-between items-baseline pt-1">
                    <span className="text-sm text-mute">Total Due</span>
                    <span className="text-2xl font-bold font-mono text-ink">
                      {settings.currencySymbol}{finalTotal}
                    </span>
                  </div>

                  <Honeypot />

                  {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

                  <button
                    type="submit"
                    disabled={submitting || !waiverAgreed || !receiptFile}
                    className="w-full py-3.5 px-4 rounded-xl bg-ink font-semibold text-xs tracking-wider text-white hover:bg-black disabled:opacity-40 disabled:cursor-not-allowed transition"
                  >
                    {submitting ? "Uploading & Reserving…" : "Confirm Reservation"}
                  </button>

                  <p className="text-[10px] text-center text-mute">
                    {!receiptFile
                      ? "Attach your payment receipt above to activate confirmation."
                      : !waiverAgreed
                      ? "Please check the box to agree to club rules & waiver."
                      : "Your reservation request will be confirmed by front desk staff."}
                  </p>
                </div>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Safety Waiver Modal */}
      {showWaiverModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-3 sm:p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="relative max-w-xl w-full rounded-2xl bg-white shadow-2xl overflow-hidden max-h-[92vh] flex flex-col border border-line">
            {/* Header matching Image 2 */}
            <div className="flex items-start justify-between p-5 md:p-6 pb-4 border-b border-line shrink-0 bg-white">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-mute font-semibold">
                  Grove District
                </p>
                <h3 className="text-xl md:text-2xl font-bold tracking-tight text-ink mt-0.5">
                  Waiver & Release of Liability
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowWaiverModal(false)}
                className="size-8 rounded-full border border-line hover:bg-zinc-100 flex items-center justify-center text-sm font-light text-ink transition"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Scrollable Terms Content */}
            <div
              onScroll={(e) => {
                const el = e.currentTarget;
                if (el.scrollHeight - el.scrollTop - el.clientHeight <= 40) {
                  setHasScrolledToBottom(true);
                }
              }}
              className="flex-1 overflow-y-auto p-5 md:p-6 text-xs text-ink/80 leading-relaxed space-y-4 bg-white"
            >
              <p className="text-mute text-xs leading-relaxed">
                {WAIVER_PREAMBLE}
              </p>

              {parseWaiverSections(settings.waiverText).map((s) => (
                <div key={s.num} className="space-y-1">
                  <p className="font-bold text-ink text-xs uppercase tracking-wide">
                    {s.num}. {s.title}
                  </p>
                  <p className="text-mute text-[12px] leading-relaxed">
                    {s.text}
                  </p>
                </div>
              ))}
            </div>

            {/* Fixed Footer matching Image 2 */}
            <div className="p-4 md:p-5 border-t border-line bg-white space-y-3 shrink-0">
              <label
                className={`flex items-start gap-3 p-3.5 rounded-xl border transition ${
                  !hasScrolledToBottom && !modalWaiverChecked
                    ? "bg-zinc-50 border-zinc-200 opacity-60 cursor-not-allowed"
                    : "bg-white border-line hover:bg-zinc-50/70 cursor-pointer"
                }`}
              >
                <input
                  type="checkbox"
                  disabled={!hasScrolledToBottom && !modalWaiverChecked}
                  checked={modalWaiverChecked}
                  onChange={(e) => setModalWaiverChecked(e.target.checked)}
                  className="mt-0.5 size-4 rounded border-zinc-300 text-ink focus:ring-0 cursor-pointer disabled:cursor-not-allowed shrink-0"
                />
                <span className="text-[11.5px] text-ink/85 leading-relaxed font-normal">
                  I confirm that I have read and agreed to the Waiver and Release of Liability and Facility Rules of Grove District. I further confirm that all participants included in this booking have been informed of and agree to these terms and voluntarily assume all risks associated with participation.
                </span>
              </label>

              {!hasScrolledToBottom && !modalWaiverChecked && (
                <p className="text-[11px] font-mono text-wine font-medium text-center flex items-center justify-center gap-1.5 animate-pulse">
                  <span>↓</span>
                  <span>Please scroll to the bottom of the terms to unlock agreement</span>
                </p>
              )}

              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setShowWaiverModal(false)}
                  className="rounded-xl border border-line bg-white py-3 text-xs font-semibold text-ink hover:bg-zinc-50 transition text-center"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!modalWaiverChecked}
                  onClick={() => {
                    setWaiverAgreed(true);
                    setShowWaiverModal(false);
                  }}
                  className={`rounded-xl py-3 text-xs font-bold uppercase tracking-wider transition text-center ${
                    modalWaiverChecked
                      ? "bg-ink text-white hover:bg-black/85 shadow-sm"
                      : "bg-zinc-300 text-zinc-500 cursor-not-allowed"
                  }`}
                >
                  ACCEPT
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Full-Screen Payment QR Code Lightbox Modal */}
      {showQrModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150"
          onClick={() => setShowQrModal(false)}
        >
          <div
            className="relative max-w-md w-full rounded-2xl bg-white shadow-2xl border border-line overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start justify-between p-5 border-b border-line bg-white">
              <div>
                <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-mute font-semibold">
                  InstaPay · QR Ph
                </p>
                <h3 className="text-lg font-semibold tracking-tight text-ink mt-0.5">
                  {settings.paymentAccountName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowQrModal(false)}
                className="size-8 rounded-full border border-line hover:bg-zinc-100 flex items-center justify-center text-ink transition cursor-pointer"
                aria-label="Close QR Modal"
              >
                <svg className="size-3.5 stroke-[1.75]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5 bg-white">
              <div className="relative mx-auto size-72 sm:size-80 rounded-xl border border-line bg-white p-4">
                <Image
                  src={settings.paymentQrUrl}
                  alt="Payment QR Code"
                  fill
                  unoptimized
                  className="object-contain p-3"
                />
              </div>

              <div className="border-y border-line divide-y divide-line text-xs">
                <div className="flex items-center justify-between py-2.5">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-mute">
                    Account
                  </span>
                  <span className="font-mono font-medium text-ink">
                    {settings.paymentAccountNumber}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2.5">
                  <span className="font-mono text-[11px] uppercase tracking-wider text-mute">
                    Amount Due
                  </span>
                  <span className="font-mono text-sm font-semibold text-ink">
                    {settings.currencySymbol}
                    {finalTotal}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <a
                  href={settings.paymentQrUrl}
                  download="grove-district-payment-qr.png"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-line bg-white py-2.5 text-xs font-semibold text-ink hover:bg-zinc-50 transition text-center"
                >
                  Save Image
                </a>
                <button
                  type="button"
                  onClick={() => setShowQrModal(false)}
                  className="rounded-xl bg-ink py-2.5 text-xs font-semibold text-white hover:bg-black/85 transition text-center cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Sticky Selection & Review Bar */}
      {step === "schedule" && selectedSlots.length > 0 && (
        <div className="fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur border-t border-line px-5 py-3.5 z-40 lg:hidden shadow-[0_-4px_16px_rgba(0,0,0,0.06)] flex items-center justify-between gap-4 animate-in slide-in-from-bottom duration-150">
          <div className="min-w-0">
            <p className="font-mono text-[10px] uppercase tracking-wider text-mute">
              {selectedSlots.length} Court Slot{selectedSlots.length > 1 ? "s" : ""}
            </p>
            <p className="font-mono text-base font-bold text-ink">
              {settings.currencySymbol}{finalTotal}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setStep("checkout");
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            className="rounded-full bg-ink text-white px-5 py-2.5 text-xs font-semibold hover:bg-black transition cursor-pointer shadow-sm shrink-0"
          >
            Review Booking →
          </button>
        </div>
      )}

      {/* Inline Member AuthModal so guests don't lose their selected slots */}
      <AuthModal
        isOpen={authMode !== null}
        initialMode={authMode ?? "signup"}
        onClose={() => setAuthMode(null)}
        onSuccess={() => {
          setAuthMode(null);
          setRefresh((k) => k + 1);
        }}
      />
    </div>
  );
}
