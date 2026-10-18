"use client";

import { site } from "@/lib/config";
import { Honeypot, useJsonForm } from "./form-utils";
import { btnGhost, btnPrimary, eyebrow, input, label } from "./ui";

export function Contact() {
  const { status, error, submit, reset } = useJsonForm("/api/contact");

  return (
    <section id="contact" className="scroll-mt-16 border-t border-line">
      <div className="grid md:grid-cols-2">
        <div className="flex flex-col justify-between gap-8 p-6 md:p-10">
          <div>
            <p className={eyebrow}>(07) Location & Contact</p>
            <h2 className="mt-3 text-[1.65rem] leading-[1.1] tracking-[-0.03em] md:text-[2.4rem]">
              Find us & say hello.
            </h2>
            <address className="mt-5 grid gap-1.5 text-[13px] not-italic text-mute">
              {site.address.map((l) => (
                <span key={l} className="text-ink font-medium">
                  {l}
                </span>
              ))}
              <span className="text-emerald-800 font-medium text-xs pt-0.5">
                ✓ Free on-site parking available · Open daily 8:00 AM – 2:00 AM
              </span>
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <a
                  href={site.mapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${btnGhost} inline-flex items-center gap-2`}
                >
                  <svg className="size-3.5 stroke-[1.6]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
                  </svg>
                  <span>Get Directions on Google Maps ↗</span>
                </a>
              </div>
              <div className="grid gap-1 pt-3">
                <a className="text-ink hover:opacity-60" href={`mailto:${site.email}`}>
                  {site.email}
                </a>
                <a className="text-ink hover:opacity-60" href={`tel:${site.phone.replace(/\s/g, "")}`}>
                  {site.phone}
                </a>
                <a className="text-ink hover:opacity-60" href={site.instagram} target="_blank" rel="noopener noreferrer">
                  Instagram ↗
                </a>
              </div>
            </address>
          </div>

          {/* Interactive Google Maps Embed */}
          <div className="overflow-hidden rounded-2xl border border-line bg-zinc-100 shadow-2xs">
            <iframe
              title="Grove District Location — A P Y Cane Inc."
              src={site.mapsEmbedUrl}
              width="100%"
              height="240"
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              className="block w-full border-0"
            />
          </div>
        </div>

        <div className="border-t border-line p-6 md:border-l md:border-t-0 md:p-10">
          {status === "success" ? (
            <div className="flex min-h-[260px] flex-col justify-center gap-4">
              <span className="grid size-10 place-items-center rounded-full bg-lime/30 text-lg">✓</span>
              <h3 className="text-2xl tracking-[-0.02em]">Message sent.</h3>
              <p className="text-sm text-mute">Thanks — we’ll get back to you soon.</p>
              <button onClick={reset} className={`${btnGhost} self-start`}>
                Send another
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="relative space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={label} htmlFor="c-name">Name</label>
                  <input id="c-name" name="name" required minLength={2} maxLength={80} autoComplete="name" className={input} />
                </div>
                <div>
                  <label className={label} htmlFor="c-email">Email</label>
                  <input id="c-email" name="email" type="email" required maxLength={120} autoComplete="email" className={input} />
                </div>
              </div>
              <div>
                <label className={label} htmlFor="c-msg">Message</label>
                <textarea id="c-msg" name="message" required minLength={5} maxLength={1000} rows={5} className={`${input} resize-none`} />
              </div>
              <Honeypot />
              {error && (
                <p role="alert" className="text-[13px] text-wine">
                  {error}
                </p>
              )}
              <button type="submit" disabled={status === "loading"} className={btnPrimary}>
                {status === "loading" ? "Sending…" : "Send message"}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
