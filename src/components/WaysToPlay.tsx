"use client";

import { useState } from "react";
import Link from "next/link";
import { useClubSettings } from "@/lib/useClubSettings";
import { useMember } from "@/lib/use-member";
import { AuthModal } from "./AuthModal";
import { eyebrow, btnPrimary, btnGhost } from "./ui";

export function WaysToPlay() {
  const settings = useClubSettings();
  const { user } = useMember();
  const [authMode, setAuthMode] = useState<"signin" | "signup" | null>(null);

  const ways = [
    {
      tag: "Most Popular",
      title: "Court Rental",
      desc: "Reserve Court 1, 2, or 3 exclusively for your group. Book 1 to 8 hours for private singles or doubles match play.",
      details: [
        "Up to 8 players per court",
        `From ${settings.currencySymbol}${settings.offPeakHourlyRate}/hr (Off-Peak) / ${settings.currencySymbol}${settings.regularHourlyRate}/hr (Peak)`,
        "Non-marking court shoes required",
      ],
      cta: "Book a Court",
      href: "/book",
      primary: true,
    },
    {
      tag: "Free Club Membership",
      title: "Join as a Member",
      desc: `Sign up for a free Grove District Member Account to avail ${settings.memberDiscountPercent}% off up to 2 courts (2 hours) every 10 confirmed games you play.`,
      details: [
        `★ ${settings.memberDiscountPercent}% Off 2 Courts / 2 Hours on every 11th game`,
        "Automatic game & loyalty stamp tracking",
        "Manage all your court reservations in one place",
      ],
      cta: user ? "View My Member Perks" : "Join as a Member — Free",
      href: "/member",
      isMemberAction: !user,
      primary: false,
    },
    {
      tag: "Tournaments & Events",
      title: "Full Facility & Events",
      desc: "Lock down all 3 courts exclusively for tournaments, corporate team-building, birthday celebrations, or private club sessions.",
      details: [
        "All 3 indoor courts locked for your group",
        "Custom Tournament, Corporate & Event options",
        `Starting from ${settings.currencySymbol}${settings.eventHourlyRate}/hr`,
      ],
      cta: "Reserve Full Facility",
      href: "/book?mode=event",
      primary: false,
    },
  ];

  return (
    <section id="ways-to-play" className="scroll-mt-16 border-t border-line">
      <div className="grid md:grid-cols-[1fr_2.2fr]">
        <div className="p-6 md:border-r md:border-line md:p-8">
          <p className={eyebrow}>(02) Ways to Play & Member Perks</p>
        </div>
        <div className="p-6 md:p-12 space-y-8">
          <div>
            <h2 className="text-[1.65rem] leading-[1.1] tracking-[-0.03em] md:text-[2.6rem]">
              Play your way — and join as a Member to unlock 50% off.
            </h2>
            <p className="mt-3 max-w-[600px] text-[13px] leading-relaxed text-mute">
              Reserve a private court with friends, book all 3 courts for a tournament or celebration, or sign up for a free Member Account to start earning{" "}
              <strong className="text-ink font-medium">
                {settings.memberDiscountPercent}% off up to 2 courts (2 hours)
              </strong>{" "}
              every 10 games.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {ways.map((w) => (
              <div
                key={w.title}
                className={`flex flex-col justify-between rounded-2xl border p-6 transition hover:shadow-sm ${
                  w.title === "Join as a Member"
                    ? "border-ink bg-zinc-50/70 ring-1 ring-ink/10"
                    : "border-line bg-white hover:border-ink"
                }`}
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span
                      className={`rounded-full px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase ${
                        w.title === "Join as a Member"
                          ? "bg-ink text-white"
                          : "bg-zinc-100 text-ink"
                      }`}
                    >
                      {w.tag}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-xl font-medium tracking-tight text-ink">{w.title}</h3>
                    <p className="mt-2 text-xs leading-relaxed text-mute">{w.desc}</p>
                  </div>

                  <ul className="space-y-1.5 border-t border-line/60 pt-4 text-[11px] text-ink/80">
                    {w.details.map((d) => (
                      <li key={d} className="flex items-start gap-2">
                        <span className="mt-1.5 size-1 shrink-0 rounded-full bg-ink" />
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-6">
                  {w.isMemberAction ? (
                    <button
                      type="button"
                      onClick={() => setAuthMode("signup")}
                      className={`w-full py-2.5 text-center text-xs font-semibold rounded-xl block transition ${btnPrimary}`}
                    >
                      {w.cta} →
                    </button>
                  ) : (
                    <Link
                      href={w.href}
                      className={`w-full py-2.5 text-center text-xs font-semibold rounded-xl block transition ${
                        w.primary ? btnPrimary : btnGhost
                      }`}
                    >
                      {w.cta} →
                    </Link>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Highlighted Join Member CTA Banner */}
          <div className="rounded-2xl border border-ink bg-ink text-white p-6 md:p-8 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2.5 max-w-2xl">
                <div className="inline-flex flex-wrap items-center gap-2 rounded-full bg-white/15 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-wider text-white">
                  <span>★ Become a Grove District Member</span>
                  <span className="text-white/50">·</span>
                  <span className="text-emerald-300">
                    Avail {settings.memberDiscountPercent}% Off 2 Courts / 2 Hours
                  </span>
                </div>
                <h3 className="text-xl md:text-2xl font-medium tracking-tight text-white">
                  Join the Member Club for Free & Avail 50% Off Up to 2 Courts (2 Hours).
                </h3>
                <p className="text-xs md:text-sm leading-relaxed text-zinc-300">
                  Only registered Members earn loyalty stamps on their bookings. Sign up with your email in 15 seconds—every confirmed court-hour counts as 1 game, and after 10 games your next booking automatically gets{" "}
                  <strong className="text-white font-semibold">
                    {settings.memberDiscountPercent}% off up to 2 courts / 2 hours
                  </strong>
                  !
                </p>
              </div>

              <div className="flex flex-col sm:flex-row md:flex-col lg:flex-row gap-2.5 shrink-0">
                {user ? (
                  <Link
                    href="/member"
                    className="rounded-full bg-white px-5 py-2.5 text-center text-xs font-semibold text-ink hover:bg-zinc-100 transition"
                  >
                    Open My Member Dashboard →
                  </Link>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setAuthMode("signup")}
                      className="rounded-full bg-white px-5 py-2.5 text-center text-xs font-semibold text-ink hover:bg-zinc-100 transition cursor-pointer"
                    >
                      Join as a Member (Free) →
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthMode("signin")}
                      className="rounded-full border border-white/25 bg-white/5 px-5 py-2.5 text-center text-xs font-semibold text-white hover:bg-white/15 transition cursor-pointer"
                    >
                      Member Sign In
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <AuthModal
        isOpen={authMode !== null}
        initialMode={authMode ?? "signup"}
        onClose={() => setAuthMode(null)}
      />
    </section>
  );
}
