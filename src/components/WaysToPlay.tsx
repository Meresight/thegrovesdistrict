import Link from "next/link";
import { eyebrow, btnPrimary, btnGhost } from "./ui";

const ways = [
  {
    tag: "Most Popular",
    title: "Court Rental",
    desc: "Reserve Court 1, 2, or 3 exclusively for your group. Book 1 to 4 hours for private singles or doubles match play.",
    details: ["Up to 8 players per court", "From ₱450/hr (Off-Peak) / ₱550/hr (Peak)", "Non-marking shoes required"],
    cta: "Book a Court",
    href: "/book",
    primary: true,
  },
  {
    tag: "Social Drop-In",
    title: "Open Play",
    desc: "Come solo or with a partner. Put your paddle in the queue, rotate into games, meet local players, and rally all session.",
    details: ["Paddle rotation system", "Beginner & intermediate brackets", "Weekly scheduled sessions"],
    cta: "View Open Play",
    href: "#events",
    primary: false,
  },
  {
    tag: "Private Events",
    title: "Full Facility Buyout",
    desc: "Lock down all 3 courts exclusively for company tournaments, team-building, birthday battles, or private club sessions.",
    details: ["All 3 courts locked", "Café catering & lounge space", "Up to 30+ players"],
    cta: "Reserve Full Facility",
    href: "/book",
    primary: false,
  },
];

export function WaysToPlay() {
  return (
    <section id="ways-to-play" className="scroll-mt-16 border-t border-line">
      <div className="grid md:grid-cols-[1fr_2.2fr]">
        <div className="p-6 md:border-r md:border-line md:p-8">
          <p className={eyebrow}>(02) Ways to Play</p>
        </div>
        <div className="p-6 md:p-12 space-y-8">
          <div>
            <h2 className="text-[1.65rem] leading-[1.1] tracking-[-0.03em] md:text-[2.6rem]">
              Pickleball for every playstyle.
            </h2>
            <p className="mt-3 max-w-[560px] text-[13px] leading-relaxed text-mute">
              Whether you want your own private court with friends, open social rallies to test your dinks, or an all-out corporate tournament buyout.
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {ways.map((w) => (
              <div
                key={w.title}
                className="flex flex-col justify-between rounded-2xl border border-line bg-white p-6 transition hover:border-ink hover:shadow-sm"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase text-ink">
                      {w.tag}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-xl font-medium tracking-tight text-ink">{w.title}</h3>
                    <p className="mt-2 text-xs leading-relaxed text-mute">{w.desc}</p>
                  </div>

                  <ul className="space-y-1.5 border-t border-line/60 pt-4 text-[11px] text-ink/80">
                    {w.details.map((d) => (
                      <li key={d} className="flex items-center gap-2">
                        <span className="size-1 rounded-full bg-ink" />
                        <span>{d}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="pt-6">
                  <Link
                    href={w.href}
                    className={`w-full py-2.5 text-center text-xs font-semibold rounded-xl block transition ${
                      w.primary ? btnPrimary : btnGhost
                    }`}
                  >
                    {w.cta} →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
