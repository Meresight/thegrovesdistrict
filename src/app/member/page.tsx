"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { courts } from "@/lib/config";
import { formatDateLabel, formatHour } from "@/lib/time";
import { btnGhost, btnPrimary, eyebrow } from "@/components/ui";
import { AuthModal } from "@/components/AuthModal";
import { supabase } from "@/lib/supabase-browser";
import { useMember, getMemberToken, signOutMember, persistMemberSession } from "@/lib/use-member";
import { LoyaltyProgress } from "@/lib/loyalty";

type Reservation = {
  ref: string;
  shortRef: string;
  type: string;
  date: string;
  courts: string[];
  hours: number[];
  totalSlots?: number;
  status: string;
  total: number;
  discount: number;
  receiptUrl: string | null;
  players: number;
  createdAt: string;
};

export default function MemberDashboardPage() {
  const { user, ready } = useMember();
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loyalty, setLoyalty] = useState<LoyaltyProgress>({
    completed: 0,
    remaining: 10,
    eligible: false,
    rewardBookingNumber: 11,
  });
  const [confirmedCount, setConfirmedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [reloadTrigger, setReloadTrigger] = useState(0);

  useEffect(() => {
    if (typeof window !== "undefined") {
      if (
        window.location.search.includes("reset=true") ||
        window.location.hash.includes("type=recovery")
      ) {
        setShowAuth(true);
      }
    }
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    async function loadData() {
      setLoading(true);
      setErrorMsg(null);
      const token = await getMemberToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        let res = await fetch("/api/member/bookings", {
          headers: { Authorization: `Bearer ${token}` },
        });

        // If 401, try refreshing token via Supabase and retry once
        if (res.status === 401 && supabase) {
          try {
            const { data: refData } = await supabase.auth.refreshSession();
            if (refData.session?.access_token) {
              persistMemberSession(
                refData.session.user,
                refData.session.access_token,
                refData.session.refresh_token
              );
              res = await fetch("/api/member/bookings", {
                headers: { Authorization: `Bearer ${refData.session.access_token}` },
              });
            }
          } catch {}
        }

        if (res.status === 401) {
          await signOutMember();
          if (!cancelled) {
            setErrorMsg("Your session expired. Please sign in again to view your reservations.");
          }
          return;
        }

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Unable to load reservations right now.");
        }

        const data = await res.json();
        if (cancelled) return;
        setReservations(data.reservations || []);
        if (data.loyalty) setLoyalty(data.loyalty);
        setConfirmedCount(data.confirmedCount || 0);
      } catch (err: unknown) {
        console.warn("[member dashboard load]", err);
        if (!cancelled) {
          setErrorMsg(err instanceof Error ? err.message : "Unable to load reservations.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
  }, [user, ready, reloadTrigger]);

  if (!ready || loading) {
    return (
      <div className="mx-auto max-w-4xl px-6 py-20 text-center text-xs text-mute font-mono">
        Loading member dashboard…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="mx-auto max-w-md px-6 py-20 text-center space-y-4">
        <p className={eyebrow}>Member Portal</p>
        <h1 className="text-2xl font-medium tracking-tight">Please sign in to view your games</h1>
        <p className="text-xs text-mute leading-relaxed">
          {errorMsg || "Log in with your member account to see your court reservations, verified receipts, and track your loyalty perk progress."}
        </p>
        <div className="pt-3 flex items-center justify-center gap-3">
          <button
            onClick={() => setShowAuth(true)}
            className={`${btnPrimary} text-xs py-2 px-5`}
          >
            Log In to Account
          </button>
          <Link href="/book" className={`${btnGhost} text-xs py-2 px-4`}>
            Book a Court →
          </Link>
        </div>

        <AuthModal
          isOpen={showAuth}
          onClose={() => setShowAuth(false)}
          onSuccess={() => {
            setShowAuth(false);
            setReloadTrigger((n) => n + 1);
          }}
        />
      </div>
    );
  }

  // Next upcoming game
  const upcomingReservations = reservations.filter(
    (r) => r.status !== "declined" && r.status !== "cancelled"
  );
  const nextGame = upcomingReservations[0] || null;

  return (
    <div className="mx-auto max-w-4xl px-6 py-12 space-y-8">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-line">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-mono uppercase bg-ink text-white px-2 py-0.5 rounded">
              Verified Member
            </span>
            <span className="text-xs text-mute font-mono">{user.email}</span>
          </div>
          <h1 className="mt-2 text-3xl font-medium tracking-tight text-ink">My Court Reservations</h1>
        </div>

        <div className="flex items-center gap-3">
          <Link href="/book" className={`${btnPrimary} text-xs py-2 px-4`}>
            Book New Court →
          </Link>
          <button
            onClick={signOutMember}
            className={`${btnGhost} text-xs py-2 px-3`}
          >
            Sign Out
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="rounded-xl border border-rose-200 bg-rose-50/70 p-4 text-xs text-rose-800 flex items-center justify-between gap-3">
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setReloadTrigger((n) => n + 1)}
            className="underline font-medium hover:opacity-80 shrink-0"
          >
            Retry
          </button>
        </div>
      )}

      {/* Hero "Next Game" Card if any */}
      {nextGame && (
        <div className="rounded-2xl border border-line bg-white p-6 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <p className={eyebrow}>Next Reserved Game</p>
            <span className="text-xs font-mono font-bold text-ink">#{nextGame.shortRef}</span>
          </div>

          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <div className="space-y-1">
              <h3 className="text-xl font-semibold text-ink">
                {nextGame.type === "event_buyout"
                  ? "Whole Facility Buyout (All Courts)"
                  : nextGame.courts.map((id) => courts.find((c) => c.id === id)?.name || id).join(", ")}
              </h3>
              <p className="text-xs text-mute font-mono">
                {formatDateLabel(nextGame.date, { weekday: "long", month: "long", day: "numeric" })} ·{" "}
                {nextGame.hours.map((h) => formatHour(h)).join(", ")}
              </p>
            </div>

            <div>
              {nextGame.status === "confirmed" ? (
                <span className="rounded-full bg-emerald-50 border border-emerald-200 px-3 py-1 text-xs font-semibold text-emerald-700">
                  ✓ Confirmed & Paid
                </span>
              ) : (
                <span className="rounded-full bg-amber-50 border border-amber-300 px-3 py-1 text-xs font-semibold text-amber-800">
                  ⏳ Awaiting payment check
                </span>
              )}
            </div>
          </div>

          <p className="text-[11px] text-mute pt-1 border-t border-line/60">
            Strict No-Cancellation Policy: All court bookings are final and non-refundable. For date adjustments, contact club staff.
          </p>
        </div>
      )}

      {/* Loyalty Perk Progress Card */}
      <div className="rounded-2xl border border-line bg-zinc-50/70 p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className={eyebrow}>10-Game Loyalty Perk</p>
            <h3 className="text-lg font-medium text-ink">
              {loyalty.eligible
                ? "🎉 You unlocked 50% Off up to 2 courts / 2 hours on your next booking!"
                : `${loyalty.remaining} more confirmed game${loyalty.remaining === 1 ? "" : "s"} until 50% Off (2 Hrs / 2 Courts)`}
            </h3>
          </div>
          <span className="font-mono text-sm font-semibold text-ink">
            {confirmedCount} Confirmed Game{confirmedCount === 1 ? "" : "s"}
          </span>
        </div>

        {/* 10-step progress dots */}
        <div className="grid grid-cols-10 gap-1.5 pt-2">
          {Array.from({ length: 10 }).map((_, i) => {
            const stepNum = i + 1;
            const isCompleted = stepNum <= loyalty.completed;
            const isTarget = stepNum === 10;

            return (
              <div
                key={i}
                className={`h-2.5 rounded-full transition-all ${
                  isTarget
                    ? isCompleted
                      ? "bg-emerald-500 shadow-sm"
                      : "bg-emerald-100 border border-emerald-300"
                    : isCompleted
                    ? "bg-ink"
                    : "bg-zinc-200"
                }`}
                title={isTarget ? "10 Confirmed Games Unlocks Reward" : `Game ${stepNum}`}
              />
            );
          })}
        </div>
        <p className="text-[11px] text-mute leading-relaxed">
          {loyalty.eligible
            ? `Your reward is ready: booking #${loyalty.rewardBookingNumber} will automatically receive 50% off up to 2 court-hours (2 courts or 2 hours).`
            : `Play 10 confirmed games to receive 50% off up to 2 courts / 2 hours on booking #${loyalty.rewardBookingNumber}. Repeats every 10 games.`}
        </p>
      </div>

      {/* Reservations List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-ink">Reservation History</h2>
          <span className="text-xs font-mono text-mute">{reservations.length} Booking(s)</span>
        </div>

        {reservations.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-line p-10 text-center space-y-2 bg-white">
            <p className="text-sm font-medium text-ink">No reservations yet</p>
            <p className="text-xs text-mute max-w-sm mx-auto">
              Ready to get on court? Pick your hours and reserve a court at Grove District.
            </p>
            <div className="pt-2">
              <Link href="/book" className={btnPrimary}>
                Book a Court Now →
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {reservations.map((res) => {
              const courtDisplay =
                res.type === "event_buyout"
                  ? "Whole Facility Buyout (All Courts)"
                  : res.courts.map((id) => courts.find((c) => c.id === id)?.name || id).join(", ");
              const distinctHours = Array.from(new Set(res.hours)).sort((a, b) => a - b);
              const slotsCount = res.totalSlots || res.hours.length;

              return (
                <div
                  key={res.ref}
                  className="rounded-2xl border border-line bg-white p-5 space-y-3 shadow-xs hover:border-ink/60 transition"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-line">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-ink text-sm">{courtDisplay}</span>
                      <span className="text-xs text-mute">·</span>
                      <span className="text-xs font-medium text-ink">
                        {formatDateLabel(res.date, { weekday: "short", month: "short", day: "numeric" })}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {res.status === "confirmed" && (
                        <>
                          <Link
                            href={`/survey?ref=${res.shortRef}`}
                            className="rounded-full bg-amber-50 border border-amber-300 px-2.5 py-0.5 text-[10px] font-semibold text-amber-900 hover:bg-amber-100 transition"
                          >
                            ★ Rate Your Game
                          </Link>
                          <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                            ✓ Confirmed & Paid
                          </span>
                        </>
                      )}
                      {res.status === "pending_review" && (
                        <span className="rounded-full bg-amber-50 border border-amber-300 px-2.5 py-0.5 text-[10px] font-semibold text-amber-800">
                          ⏳ Awaiting payment check
                        </span>
                      )}
                      {(res.status === "cancelled" || res.status === "declined") && (
                        <span className="rounded-full bg-zinc-100 border border-zinc-200 px-2.5 py-0.5 text-[10px] font-semibold text-zinc-600">
                          ✕ Declined
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-baseline justify-between gap-2 text-xs">
                    <div className="text-mute">
                      <span>Hours: </span>
                      <span className="font-mono text-ink font-medium">
                        {distinctHours.map((h) => formatHour(h)).join(", ")}
                      </span>
                      <span className="ml-2 text-zinc-500 font-mono text-[11px]">
                        ({slotsCount} court-hour{slotsCount > 1 ? "s" : ""} · {res.players} players)
                      </span>
                    </div>

                    <div className="font-mono text-ink font-semibold">
                      Total: ₱{res.total}
                      {res.discount > 0 && (
                        <span className="text-[10px] text-emerald-600 font-normal ml-1.5">
                          (Saved ₱{res.discount} Loyalty Perk)
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between pt-2 text-[10px] text-mute font-mono border-t border-line/60 gap-2">
                    <span>Ref: #{res.shortRef}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-zinc-400">Final & non-refundable</span>
                      <span>Reserved {new Date(res.createdAt).toLocaleString("en-PH", { dateStyle: "medium", timeStyle: "short" })}</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <AuthModal
        isOpen={showAuth}
        onClose={() => setShowAuth(false)}
        onSuccess={() => {
          setShowAuth(false);
          setReloadTrigger((n) => n + 1);
        }}
      />
    </div>
  );
}
