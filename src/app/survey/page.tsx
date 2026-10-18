"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { btnPrimary, btnGhost, eyebrow, input, label } from "@/components/ui";

const card = "rounded-2xl border border-line bg-white shadow-2xs";
const h2 = "text-[1.65rem] leading-[1.1] tracking-[-0.03em] md:text-[2.4rem]";

type LookupBooking = {
  bookingId: string;
  bookingRef: string;
  playerName: string;
  playerEmail: string;
  isMember: boolean;
  playDate: string;
  courtLabel: string;
  hoursLabel: string;
  hasFinished: boolean;
  endTimestampMs: number;
  alreadySubmitted: boolean;
};

function StarSelector({
  title,
  subtitle,
  value,
  onChange,
}: {
  title: string;
  subtitle: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 py-3.5 border-b border-line last:border-b-0">
      <div>
        <p className="text-sm font-medium text-ink">{title}</p>
        <p className="text-xs text-mute">{subtitle}</p>
      </div>
      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((star) => {
          const active = star <= value;
          return (
            <button
              key={star}
              type="button"
              onClick={() => onChange(star)}
              className={`size-9 rounded-xl border text-base transition flex items-center justify-center ${
                active
                  ? "bg-amber-400/15 border-amber-400 text-amber-500 shadow-xs scale-105"
                  : "bg-zinc-50 border-line text-zinc-300 hover:text-amber-400 hover:border-amber-300"
              }`}
              aria-label={`Rate ${title} ${star} stars`}
            >
              ★
            </button>
          );
        })}
        <span className="ml-1.5 w-8 text-right font-mono text-xs font-medium text-ink">
          {value}/5
        </span>
      </div>
    </div>
  );
}

function SurveyContent() {
  const searchParams = useSearchParams();
  const initialRef = searchParams.get("ref") || "";

  const [lookupInput, setLookupInput] = useState(initialRef);
  const [searching, setSearching] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [bookings, setBookings] = useState<LookupBooking[]>([]);
  const [selectedBooking, setSelectedBooking] = useState<LookupBooking | null>(null);

  const [overall, setOverall] = useState(5);
  const [hospitality, setHospitality] = useState(5);
  const [courtQuality, setCourtQuality] = useState(5);
  const [cafeFood, setCafeFood] = useState(5);
  const [comment, setComment] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  async function runLookup(query: string) {
    const q = query.trim();
    if (!q) return;
    setSearching(true);
    setLookupError(null);
    setBookings([]);
    setSelectedBooking(null);

    try {
      const res = await fetch(`/api/surveys?lookup=${encodeURIComponent(q)}`, {
        cache: "no-store",
      });
      const data = await res.json();
      if (!res.ok) {
        setLookupError(data.error || "Could not find a confirmed booking.");
      } else {
        const list: LookupBooking[] = data.bookings || [];
        setBookings(list);
        const firstEligible =
          list.find((b) => b.hasFinished && !b.alreadySubmitted) || list[0] || null;
        setSelectedBooking(firstEligible);
      }
    } catch {
      setLookupError("Network error while looking up your booking.");
    } finally {
      setSearching(false);
    }
  }

  useEffect(() => {
    if (initialRef) {
      runLookup(initialRef);
    }
  }, [initialRef]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedBooking) return;
    setSubmitting(true);
    setSubmitError(null);

    try {
      const res = await fetch("/api/surveys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: selectedBooking.bookingId,
          overall,
          hospitality,
          courtQuality,
          cafeFood,
          comment,
          isMember: selectedBooking.isMember,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || "Could not submit your survey.");
      } else {
        setSubmitted(true);
      }
    } catch {
      setSubmitError("Network error while submitting survey.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-[1240px] bg-white min-h-screen flex flex-col justify-between">
      <Header />
      <section className="px-6 md:px-10 flex-1 py-12 md:py-20">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <p className={eyebrow}>Post-Play Experience Survey</p>
            <h1 className={`${h2} mt-2`}>How was your game at Grove District?</h1>
            <p className="mt-2 text-sm text-mute leading-relaxed">
              Both registered Club Members and Guest players can rate their experience once their scheduled court time finishes.
            </p>
          </div>

          {submitted ? (
            <div className={`${card} p-8 text-center space-y-4`}>
              <div className="mx-auto size-12 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 flex items-center justify-center text-lg">
                ✓
              </div>
              <h2 className="text-xl font-medium text-ink">Thank you for your feedback!</h2>
              <p className="text-sm text-mute max-w-md mx-auto leading-relaxed">
                Your feedback for Booking{" "}
                <strong className="font-mono text-ink">#{selectedBooking?.bookingRef}</strong> has been sent directly to the Grove District team.
              </p>
              <div className="pt-3 flex flex-wrap justify-center gap-3">
                <Link href="/" className={btnGhost}>
                  ← Back to Homepage
                </Link>
                <Link href="/book" className={btnPrimary}>
                  Book Next Session →
                </Link>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Step 1: Find Booking by Reference or Email */}
              <div className={`${card} p-6`}>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    runLookup(lookupInput);
                  }}
                  className="space-y-3"
                >
                  <label className={label}>
                    Enter your Booking Reference (#REF) or Email Address
                  </label>
                  <div className="flex flex-col sm:flex-row gap-2.5">
                    <input
                      type="text"
                      value={lookupInput}
                      onChange={(e) => setLookupInput(e.target.value)}
                      placeholder="e.g. #A1B2C3D4 or your@email.com"
                      className={`${input} flex-1`}
                      required
                    />
                    <button
                      type="submit"
                      disabled={searching}
                      className={`${btnPrimary} px-6 shrink-0`}
                    >
                      {searching ? "Finding…" : "Find Booking"}
                    </button>
                  </div>
                  <p className="text-[11px] text-mute">
                    No account required — Guests can enter the 8-character Reference ID from their booking confirmation screen or email.
                  </p>
                </form>

                {lookupError && (
                  <div className="mt-4 rounded-xl bg-red-50 border border-red-200 p-3.5 text-xs text-red-700">
                    {lookupError}
                  </div>
                )}

                {bookings.length > 1 && (
                  <div className="mt-5 pt-4 border-t border-line">
                    <p className="text-xs font-mono uppercase tracking-wider text-mute mb-2.5">
                      Select Which Session to Rate:
                    </p>
                    <div className="space-y-2">
                      {bookings.map((b) => {
                        const isSelected = selectedBooking?.bookingId === b.bookingId;
                        return (
                          <button
                            key={b.bookingId}
                            type="button"
                            onClick={() => setSelectedBooking(b)}
                            className={`w-full text-left rounded-xl border p-3 transition flex items-center justify-between gap-3 ${
                              isSelected
                                ? "border-ink bg-zinc-50"
                                : "border-line bg-white hover:border-zinc-300"
                            }`}
                          >
                            <div>
                              <p className="text-xs font-medium text-ink">
                                <span className="font-mono font-bold">#{b.bookingRef}</span> ·{" "}
                                {b.courtLabel} ({b.playDate})
                              </p>
                              <p className="text-[11px] text-mute">{b.hoursLabel}</p>
                            </div>
                            <span
                              className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded-full ${
                                b.alreadySubmitted
                                  ? "bg-zinc-100 text-zinc-600"
                                  : b.hasFinished
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                  : "bg-amber-50 text-amber-700 border border-amber-200"
                              }`}
                            >
                              {b.alreadySubmitted
                                ? "Rated ✓"
                                : b.hasFinished
                                ? "Ready to Rate"
                                : "Upcoming"}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Step 2: Survey Form for Selected Booking */}
              {selectedBooking && (
                <div className={`${card} p-6 md:p-8`}>
                  <div className="flex flex-wrap items-center justify-between gap-2 pb-4 mb-5 border-b border-line">
                    <div>
                      <span className="text-[11px] font-mono uppercase tracking-widest text-mute">
                        Confirmed Session · #{selectedBooking.bookingRef}
                      </span>
                      <h3 className="text-base font-medium text-ink mt-0.5">
                        {selectedBooking.playerName} · {selectedBooking.courtLabel}
                      </h3>
                      <p className="text-xs text-mute">
                        {selectedBooking.playDate} · {selectedBooking.hoursLabel}
                      </p>
                    </div>
                    <span
                      className={`text-[10px] font-mono uppercase tracking-wider px-2.5 py-1 rounded-full ${
                        selectedBooking.isMember
                          ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                          : "bg-zinc-100 text-zinc-700"
                      }`}
                    >
                      {selectedBooking.isMember ? "Club Member" : "Guest Player"}
                    </span>
                  </div>

                  {selectedBooking.alreadySubmitted ? (
                    <div className="rounded-xl bg-zinc-50 border border-line p-5 text-center">
                      <p className="text-sm font-medium text-ink">
                        You have already submitted a review for booking #{selectedBooking.bookingRef}.
                      </p>
                      <p className="text-xs text-mute mt-1">
                        Thank you for helping us keep Grove District at its best!
                      </p>
                    </div>
                  ) : !selectedBooking.hasFinished ? (
                    <div className="rounded-xl bg-amber-50/80 border border-amber-200 p-5 text-center space-y-2">
                      <span className="inline-block font-mono text-[10px] uppercase tracking-[0.16em] bg-amber-100 text-amber-900 px-2.5 py-0.5 rounded font-semibold">
                        Session Upcoming / In Progress
                      </span>
                      <p className="text-sm font-medium text-amber-950">
                        Your scheduled game hasn&apos;t finished yet
                      </p>
                      <p className="text-xs text-amber-800 leading-relaxed">
                        This post-play survey unlocks automatically right after your scheduled court time ends on{" "}
                        <strong>{selectedBooking.playDate}</strong> ({selectedBooking.hoursLabel}). Come back right after your match!
                      </p>
                    </div>
                  ) : (
                    <form onSubmit={handleSubmit} className="space-y-5">
                      <div>
                        <StarSelector
                          title="Overall Experience"
                          subtitle="Your overall session at Grove District"
                          value={overall}
                          onChange={setOverall}
                        />
                        <StarSelector
                          title="Hospitality & Staff"
                          subtitle="Warmth, check-in speed, and court assistance"
                          value={hospitality}
                          onChange={setHospitality}
                        />
                        <StarSelector
                          title="Court Quality & Lighting"
                          subtitle="Surface grip, nets, balls, and indoor lighting"
                          value={courtQuality}
                          onChange={setCourtQuality}
                        />
                        <StarSelector
                          title="Courtside Café (Food & Drinks)"
                          subtitle="Coffee, refreshments, and courtside hangout"
                          value={cafeFood}
                          onChange={setCafeFood}
                        />
                      </div>

                      <div>
                        <label className={label}>
                          Share your thoughts or suggestions (Optional)
                        </label>
                        <textarea
                          rows={3}
                          maxLength={600}
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          placeholder="Tell us what you loved about the courts, staff, or café—or anything we can improve..."
                          className={`${input} resize-none`}
                        />
                      </div>

                      {submitError && (
                        <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-700">
                          {submitError}
                        </div>
                      )}

                      <button
                        type="submit"
                        disabled={submitting}
                        className={`${btnPrimary} w-full py-3`}
                      >
                        {submitting ? "Submitting Feedback…" : "Submit Feedback"}
                      </button>
                    </form>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </section>
      <Footer />
    </div>
  );
}

export default function SurveyPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen flex items-center justify-center bg-paper text-sm text-mute">
          Loading survey…
        </main>
      }
    >
      <SurveyContent />
    </Suspense>
  );
}
