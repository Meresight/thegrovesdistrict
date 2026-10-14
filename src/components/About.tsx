import { eyebrow } from "./ui";

const stats = [
  { n: "03", l: "Indoor Tournament Courts", sub: "Cushioned acrylic surface" },
  { n: "18 hrs", l: "Open Daily (8AM – 2AM)", sub: "Off-peak ₱450 · Peak ₱550" },
  { n: "100%", l: "Indoor & Weatherproof", sub: "No rainouts, zero sun glare" },
  { n: "01", l: "Courtside Café", sub: "Specialty coffee & refreshers" },
];

export function About() {
  return (
    <section id="about" className="scroll-mt-16 border-t border-line">
      <div className="grid md:grid-cols-[1fr_2.2fr]">
        <div className="p-6 md:border-r md:border-line md:p-8">
          <p className={eyebrow}>(01) The Facility</p>
        </div>
        <div className="p-6 md:p-12">
          <p className="max-w-[780px] text-[1.65rem] leading-[1.18] tracking-[-0.025em] md:text-[2.4rem]">
            Built specifically for pickleball.{" "}
            <span className="text-mute">
              Three regulation-dimension courts with tournament perimeter runoff, high-lux overhead LED lighting, climate control, and a courtside café designed for players before, between, and after matches.
            </span>
          </p>
        </div>
      </div>
      <dl className="grid grid-cols-2 md:grid-cols-4 border-t border-line">
        {stats.map((s, i) => (
          <div key={s.l} className={`p-5 md:p-7 ${i > 0 ? "border-l border-line" : ""}`}>
            <dd className="text-2xl md:text-4xl font-medium tracking-[-0.03em]">{s.n}</dd>
            <dt className="mt-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink">{s.l}</dt>
            <p className="mt-1 text-[11px] text-mute">{s.sub}</p>
          </div>
        ))}
      </dl>
    </section>
  );
}
