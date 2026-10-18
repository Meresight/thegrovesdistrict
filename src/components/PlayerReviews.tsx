"use client";

import { useEffect, useState } from "react";
import { eyebrow } from "./ui";

const card = "rounded-2xl border border-line bg-white shadow-2xs";
const h2 = "text-[1.65rem] leading-[1.1] tracking-[-0.03em] md:text-[2.4rem]";

type PublicSurvey = {
  id: string;
  bookingRef: string;
  playerName: string;
  isMember: boolean;
  playDate: string;
  courtLabel: string;
  overall: number;
  hospitality: number;
  courtQuality: number;
  cafeFood: number;
  comment: string;
  createdAt: string;
};

type SurveyStats = {
  count: number;
  avgOverall: number;
  avgHospitality: number;
  avgCourtQuality: number;
  avgCafeFood: number;
};

function renderStars(score: number) {
  const full = Math.round(score);
  return (
    <span className="inline-flex items-center gap-0.5 text-amber-500 text-xs" aria-label={`${score} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={n <= full ? "text-amber-500" : "text-zinc-300"}>
          ★
        </span>
      ))}
    </span>
  );
}

export function PlayerReviews() {
  const [surveys, setSurveys] = useState<PublicSurvey[]>([]);
  const [stats, setStats] = useState<SurveyStats | null>(null);

  useEffect(() => {
    fetch(`/api/surveys?t=${Date.now()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (Array.isArray(d.surveys)) setSurveys(d.surveys);
        if (d.stats) setStats(d.stats);
      })
      .catch(() => {});
  }, []);

  // Only render on the homepage when the owner has approved/featured at least one review in Admin
  if (surveys.length === 0) {
    return null;
  }

  return (
    <section id="reviews" className="scroll-mt-16 border-t border-line bg-zinc-50/40 px-6 py-14 md:px-10 md:py-20">
      <div>
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
          <div className="max-w-xl">
            <p className={eyebrow}>Player Reviews · Verified Post-Game Feedback</p>
            <h2 className={`${h2} mt-3`}>Rated by players after their match.</h2>
            <p className="mt-3 text-sm text-mute leading-relaxed">
              Verified reviews from Club Members and guests rating our hospitality, indoor courts, and Courtside Café after their scheduled games.
            </p>
          </div>

          {stats && stats.count > 0 && (
            <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-white px-5 py-4 shadow-2xs">
              <div className="pr-4 border-r border-line">
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-semibold tracking-tight text-ink">
                    {stats.avgOverall.toFixed(1)}
                  </span>
                  <span className="text-amber-500 text-base">★</span>
                </div>
                <p className="text-[11px] font-mono uppercase tracking-wider text-mute">
                  Featured ({stats.count} {stats.count === 1 ? "review" : "reviews"})
                </p>
              </div>
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div>
                  <p className="text-mute text-[11px]">Hospitality</p>
                  <p className="font-mono font-medium text-ink mt-0.5">{stats.avgHospitality} ★</p>
                </div>
                <div>
                  <p className="text-mute text-[11px]">Courts</p>
                  <p className="font-mono font-medium text-ink mt-0.5">{stats.avgCourtQuality} ★</p>
                </div>
                <div>
                  <p className="text-mute text-[11px]">Café & Food</p>
                  <p className="font-mono font-medium text-ink mt-0.5">{stats.avgCafeFood} ★</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Featured Owner-Curated Reviews Grid */}
        <div className="grid gap-5 md:grid-cols-3">
          {surveys.slice(0, 6).map((item) => (
            <div
              key={item.id}
              className={`${card} p-6 flex flex-col justify-between bg-white`}
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-3">
                  {renderStars(item.overall)}
                  <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-zinc-100 text-zinc-700">
                    {item.isMember ? "Club Member" : "Verified Guest"}
                  </span>
                </div>

                {item.comment ? (
                  <p className="text-sm text-ink leading-relaxed mb-4">
                    &ldquo;{item.comment}&rdquo;
                  </p>
                ) : (
                  <p className="text-sm text-mute italic mb-4">
                    Rated 5 stars across courts, hospitality, and café experience.
                  </p>
                )}
              </div>

              <div className="pt-3 border-t border-line">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-medium text-ink">{item.playerName}</span>
                  <span className="text-[11px] font-mono text-mute">
                    {item.courtLabel} · {item.playDate}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-mono text-mute">
                  <span>Hospitality {item.hospitality}★</span>
                  <span>·</span>
                  <span>Courts {item.courtQuality}★</span>
                  <span>·</span>
                  <span>Café {item.cafeFood}★</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

