import Image from "next/image";
import { eyebrow } from "./ui";

export function Cafe() {
  return (
    <section id="cafe" className="scroll-mt-16 border-t border-line">
      <div className="grid md:grid-cols-2">
        <div className="relative aspect-[4/3] md:aspect-auto md:min-h-[460px]">
          <Image
            src="/images/court-cafe.jpg"
            alt="The café counter beside the courts"
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover"
          />
        </div>
        <div className="flex flex-col justify-between gap-12 p-6 md:border-l md:border-line md:p-10">
          <p className={eyebrow}>(04) Courtside Café</p>
          <div>
            <h2 className="text-[1.65rem] leading-[1.1] tracking-[-0.03em] md:text-[2.4rem]">
              Refuel between games.
            </h2>
            <p className="mt-4 max-w-[440px] text-[13px] leading-relaxed text-mute">
              Situated right beside Court 1 & 2. Grab an iced cold brew before a match, rehydrate with electrolytes during changeovers, or sit at the courtside counter and watch friends battle it out on court.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-[11px] font-mono text-ink/80">
              <span className="rounded-lg bg-zinc-100 border border-line px-2.5 py-1">Espresso & Cold Brew</span>
              <span className="rounded-lg bg-zinc-100 border border-line px-2.5 py-1">Electrolytes & Cold Drinks</span>
              <span className="rounded-lg bg-zinc-100 border border-line px-2.5 py-1">Courtside Match Viewing</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
