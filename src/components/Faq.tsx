import { faqs } from "@/lib/config";
import { eyebrow } from "./ui";

export function Faq() {
  return (
    <section id="faq" className="scroll-mt-16 border-t border-line">
      <div className="grid md:grid-cols-[1fr_2.2fr]">
        <div className="p-6 md:border-r md:border-line md:p-8">
          <p className={eyebrow}>(07) FAQ</p>
        </div>
        <div>
          {faqs.map((f) => (
            <details key={f.q} className="group border-b border-line last:border-b-0">
              <summary className="flex cursor-pointer items-center justify-between gap-6 px-6 py-5 text-lg tracking-[-0.02em] md:px-12">
                {f.q}
                <span className="faq-plus grid size-7 shrink-0 place-items-center rounded-full text-base shadow-[0_0_0_1px_var(--color-line)] transition-transform duration-300">
                  +
                </span>
              </summary>
              <p className="max-w-[620px] px-6 pb-6 text-[13px] leading-relaxed text-mute md:px-12">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
