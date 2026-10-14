import Image from "next/image";
import Link from "next/link";
import { courts } from "@/lib/config";
import { btnPrimary, eyebrow } from "./ui";

export function Courts() {
  return (
    <section id="courts" className="scroll-mt-16 border-t border-line">
      <div className="grid md:grid-cols-[1fr_2.2fr]">
        <div className="p-6 md:border-r md:border-line md:p-8">
          <p className={eyebrow}>(03) The Courts</p>
        </div>
        <div className="flex flex-col justify-between gap-8 p-6 md:p-12">
          <div>
            <h2 className="text-[1.65rem] leading-[1.1] tracking-[-0.03em] md:text-[2.6rem]">
              Three regulation indoor courts.
            </h2>
            <p className="mt-3 max-w-[560px] text-[13px] leading-relaxed text-mute">
              Engineered for true bounce, quick resets, and low joint impact. High-ceiling climate control keeps you cool during long rallies, completely sheltered from heat and rain.
            </p>
          </div>

          {/* Court Cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            {courts.map((c) => (
              <div key={c.id} className="rounded-2xl border border-line p-5 transition hover:border-ink bg-white">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-medium text-mute uppercase">{c.id}</span>
                  <span className="text-[10px] font-mono uppercase bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded border border-emerald-200">
                    Open for Booking
                  </span>
                </div>
                <h3 className="mt-2 text-lg font-medium">{c.name}</h3>
                <p className="mt-1 text-xs text-mute">{c.note}</p>
                <div className="mt-4 pt-3 border-t border-line/60 flex justify-between items-baseline text-xs">
                  <span className="text-mute font-mono text-[11px]">Rate</span>
                  <span className="font-mono font-semibold text-ink">₱450 – ₱550/hr</span>
                </div>
              </div>
            ))}
          </div>

          {/* Player Court Specs Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 p-4 rounded-2xl border border-line bg-zinc-50/60 text-xs">
            <div>
              <p className="font-mono text-[10px] uppercase text-mute">Dimensions</p>
              <p className="font-semibold text-ink mt-0.5">20′ × 44′ Regulation</p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase text-mute">Surface</p>
              <p className="font-semibold text-ink mt-0.5">Cushioned Acrylic</p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase text-mute">Net Height</p>
              <p className="font-semibold text-ink mt-0.5">36″ Sides · 34″ Center</p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase text-mute">Footwear</p>
              <p className="font-semibold text-ink mt-0.5">Non-Marking Shoes</p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase text-mute">Paddles</p>
              <p className="font-semibold text-ink mt-0.5">Bring Your Own</p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase text-mute">Parking</p>
              <p className="font-semibold text-ink mt-0.5">Free (First-Come Basis)</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-line bg-white p-6">
            <div>
              <h4 className="text-sm font-medium">Ready to reserve a court?</h4>
              <p className="text-xs text-mute mt-0.5">
                Select your court, pick your hours, and confirm in seconds.
              </p>
            </div>
            <Link href="/book" className={btnPrimary}>
              Select Court & Reserve →
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
