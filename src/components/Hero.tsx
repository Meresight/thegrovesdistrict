import Image from "next/image";
import Link from "next/link";
import { site } from "@/lib/config";
import { btnGhost, btnPrimary, pill } from "./ui";

const photos = [
  {
    src: "/images/court-main.jpg",
    label: "Courts 1 & 2 · Tournament Surface",
    alt: "Indoor pickleball courts with navy surface and red surround",
  },
  {
    src: "/images/court-cafe.jpg",
    label: "Courtside Café & Lounge",
    alt: "Courts seen from the café counter",
  },
  {
    src: "/images/court-wall.jpg",
    label: "Court 3 · Practice & Match Play",
    alt: "A single court beneath the Grove District wall logo",
  },
];

const pad = (n: number) => String(n).padStart(2, "0");

export function Hero() {
  return (
    <section>
      {/* 2-Column Balanced Hero */}
      <div className="grid md:grid-cols-2 items-center">
        {/* Left Column: Bold, Athletic Headline */}
        <div className="rise flex flex-col justify-center p-8 md:p-14 lg:p-16">
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <span className="text-[11px] font-semibold uppercase tracking-[0.2em] text-mute">
              Indoor Pickleball Club · Cebu
            </span>
            <span className="rounded-full bg-zinc-100 border border-line px-2.5 py-0.5 text-[10px] font-mono font-semibold uppercase text-ink">
              3 Regulation Courts
            </span>
          </div>
          <h1 className="text-[clamp(2.5rem,5.5vw,4.5rem)] font-medium leading-[1.02] tracking-[-0.035em] text-ink">
            Cebu’s Home for
            <br />
            <span className="text-navy">Indoor Pickleball.</span>
          </h1>
        </div>

        {/* Right Column: Clear Facility Details & High-Conversion CTAs */}
        <div className="rise rise-2 flex flex-col justify-center border-t border-line p-8 md:border-l md:border-t-0 md:p-14 lg:p-16">
          <p className="max-w-[460px] text-sm md:text-base leading-relaxed text-ink/80">
            Three competition-grade indoor pickleball courts, high-bay glare-free lighting, and a courtside café. Built for open rallies, league matches, and good company — rain or shine.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/book" className={`${btnPrimary} px-6 py-3 text-sm`}>
              Book a Court →
            </Link>
            <a href="#ways-to-play" className={`${btnGhost} px-6 py-3 text-sm`}>
              Ways to Play
            </a>
          </div>

          <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-xs text-mute font-mono">
            <span>8:00 AM – 2:00 AM</span>
            <span className="text-zinc-300">·</span>
            <span>₱450 Off-Peak / ₱550 Peak</span>
            <span className="text-zinc-300">·</span>
            <span className="text-ink font-medium">50% Off Every 10 Games</span>
          </div>
        </div>
      </div>

      {/* Quick Directory Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-t border-line px-6 py-4 md:px-10">
        <div className="flex items-center gap-2">
          <a href="#courts" className={pill}>
            Courts
          </a>
          <a href="#ways-to-play" className={pill}>
            Ways to Play
          </a>
          <a href="#cafe" className={pill}>
            Café
          </a>
          <a href="#events" className={pill}>
            Events
          </a>
        </div>
        <p className="order-last w-full text-center text-[11px] font-semibold uppercase tracking-[0.2em] text-ink/70 md:order-none md:w-auto">
          Tournament Courts · Café · Open Play
        </p>
        <p className="text-xs font-mono font-medium text-mute">
          Daily 8:00 AM – 2:00 AM
        </p>
      </div>

      {/* 3 Photos Strip with Uniform Aspect & Captions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-t border-line p-3 md:p-4 bg-white">
        {photos.map((p, i) => (
          <div
            key={p.src}
            className="group relative aspect-[16/11] overflow-hidden rounded-xl border border-line bg-white shadow-sm"
          >
            <Image
              src={p.src}
              alt={p.alt}
              fill
              priority={i === 0}
              sizes="(min-width: 768px) 33vw, 100vw"
              className="object-cover transition duration-500 group-hover:scale-105"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-3.5 pt-8">
              <p className="text-[11px] font-medium tracking-wide text-white">
                {p.label}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
