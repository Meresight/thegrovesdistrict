"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useClubSettings } from "@/lib/useClubSettings";
import { useMember, getMemberToken } from "@/lib/use-member";
import { loyaltyProgress } from "@/lib/loyalty";
import { AuthModal } from "./AuthModal";
import { eyebrow, btnPrimary, btnGhost } from "./ui";

export function WaysToPlay() {
  const settings = useClubSettings();
  const { user } = useMember();
  const [authMode, setAuthMode] = useState<"signin" | "signup" | null>(null);
  const [confirmedGames, setConfirmedGames] = useState(0);

  useEffect(() => {
    if (!user) {
      setConfirmedGames(0);
      return;
    }
    let active = true;
    getMemberToken().then((token) => {
      if (!token || !active) return;
      fetch("/api/member/bookings", {
        headers: { Authorization: `Bearer ${token}` },
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => {
          if (active && d && typeof d.confirmedCount === "number") {
            setConfirmedGames(d.confirmedCount);
          }
        })
        .catch(() => {});
    });
    return () => {
      active = false;
    };
  }, [user]);

  const loyalty = loyaltyProgress(confirmedGames);

  const steps = [
    {
      num: "01",
      title: "Create Your Free Member Account",
      desc: "Sign up with your email in 15 seconds. No membership fees, no monthly dues, and no commitments.",
    },
    {
      num: "02",
      title: "1 Confirmed Court-Hour = 1 Loyalty Stamp",
      desc: "Every confirmed court-hour you book while signed in automatically adds a stamp to your digital Member Pass.",
    },
    {
      num: "03",
      title: `${settings.memberDiscountPercent}% Off Up to 2 Courts (2 Hours)`,
      desc: `Once you reach 10 confirmed games, your 11th booking automatically unlocks ${settings.memberDiscountPercent}% off up to 2 court-hours at checkout. Repeats every 10 games.`,
    },
  ];

  return (
    <section id="membership" className="scroll-mt-16 border-t border-line bg-zinc-50/40">
      <div id="ways-to-play" className="scroll-mt-16 grid md:grid-cols-[1fr_2.2fr]">
        <div className="p-6 md:border-r md:border-line md:p-8 flex flex-col justify-between">
          <div>
            <p className={eyebrow}>(03) Member Club · Free Sign-Up</p>
            <p className="mt-3 text-xs text-mute leading-relaxed max-w-[240px]">
              Grove District rewards regular players. Join for free to track your court hours and unlock 50% off every 10 games.
            </p>
          </div>
          <div className="hidden md:block pt-8 border-t border-line/60">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-mute">
              Member Reward
            </p>
            <p className="mt-1 font-mono text-xl font-semibold text-ink">
              {settings.memberDiscountPercent}% OFF · 2 HRS
            </p>
          </div>
        </div>

        <div className="p-6 md:p-12 space-y-10 bg-white">
          {/* Editorial Headline & Visual Loyalty Pass */}
          <div className="grid gap-8 lg:grid-cols-[1.15fr_1fr] items-start">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-line bg-zinc-50 px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.16em] text-ink">
                <span className="size-1.5 rounded-full bg-wine" />
                <span>Free Club Membership · {settings.memberDiscountPercent}% Loyalty Perk</span>
              </div>

              <h2 className="text-[1.75rem] leading-[1.08] tracking-[-0.03em] md:text-[2.65rem] text-ink">
                Play 10 hours.
                <br />
                <span className="text-wine">
                  Get {settings.memberDiscountPercent}% off 2 courts (2 hours).
                </span>
              </h2>

              <p className="max-w-[520px] text-[13px] leading-relaxed text-mute">
                Whether you play morning drills or late-night matches, signing up as a Grove District Member is completely free. Book under your member email and your 11th session automatically receives{" "}
                <strong className="text-ink font-medium">
                  {settings.memberDiscountPercent}% off up to 2 courts or 2 hours
                </strong>
                .
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-3">
                {user ? (
                  <>
                    <Link href="/member" className={`${btnPrimary} px-6 py-3 text-xs`}>
                      Open My Member Pass →
                    </Link>
                    <Link href="/book" className={`${btnGhost} px-5 py-3 text-xs`}>
                      Book Court as Member
                    </Link>
                  </>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setAuthMode("signup")}
                      className={`${btnPrimary} px-6 py-3 text-xs cursor-pointer`}
                    >
                      Join as a Member — Free →
                    </button>
                    <button
                      type="button"
                      onClick={() => setAuthMode("signin")}
                      className={`${btnGhost} px-5 py-3 text-xs cursor-pointer`}
                    >
                      Member Sign In
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Architectural 10-Stamp Member Pass Card */}
            <div className="rounded-2xl border border-ink bg-ink text-white p-6 md:p-7 shadow-sm space-y-6">
              <div className="flex items-start justify-between border-b border-white/15 pb-4">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/60">
                    Grove District · Loyalty Pass
                  </p>
                  <h3 className="mt-1 text-lg font-medium tracking-tight text-white">
                    {user ? user.email?.split("@")[0] : "10-Game Member Card"}
                  </h3>
                </div>
                <span className="rounded-full border border-white/20 bg-white/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-wider text-white">
                  {user ? `${loyalty.completed} / 10 Stamps` : "Free Pass"}
                </span>
              </div>

              {/* 10 Stamp Grid */}
              <div className="grid grid-cols-5 gap-2.5">
                {Array.from({ length: 10 }).map((_, idx) => {
                  const num = idx + 1;
                  const active = user ? num <= loyalty.completed : num <= 3;
                  return (
                    <div
                      key={num}
                      className={`aspect-square rounded-xl border flex flex-col items-center justify-center transition ${
                        active
                          ? "border-white bg-white text-ink"
                          : "border-white/15 bg-white/5 text-white/40"
                      }`}
                    >
                      <span className="font-mono text-[10px] font-semibold">
                        {String(num).padStart(2, "0")}
                      </span>
                      <span className="text-[9px] font-mono uppercase tracking-wider mt-0.5">
                        {active ? "Stamped" : "Hour"}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Reward Unlock Bar */}
              <div className="rounded-xl border border-white/15 bg-white/8 p-3.5 flex items-center justify-between gap-3">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-white/60">
                    11th Booking Reward
                  </p>
                  <p className="text-xs font-medium text-white mt-0.5">
                    {settings.memberDiscountPercent}% Off Up to 2 Courts / 2 Hours
                  </p>
                </div>
                <span className="shrink-0 rounded-lg bg-white text-ink px-2.5 py-1 font-mono text-[11px] font-bold">
                  -{settings.memberDiscountPercent}%
                </span>
              </div>
            </div>
          </div>

          {/* 3-Column Architectural Breakdown */}
          <div className="grid gap-4 md:grid-cols-3 border-t border-line pt-8">
            {steps.map((s) => (
              <div
                key={s.num}
                className="rounded-2xl border border-line bg-zinc-50/50 p-5 space-y-2"
              >
                <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.16em] text-wine">
                  Step {s.num}
                </span>
                <h3 className="text-base font-medium tracking-tight text-ink">
                  {s.title}
                </h3>
                <p className="text-xs leading-relaxed text-mute">{s.desc}</p>
              </div>
            ))}
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
