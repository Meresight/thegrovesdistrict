"use client";

import { site } from "@/lib/config";
import { Honeypot, useJsonForm } from "./form-utils";
import { btnGhost, btnPrimary, eyebrow, input, label } from "./ui";

export function Contact() {
  const { status, error, submit, reset } = useJsonForm("/api/contact");

  return (
    <section id="contact" className="scroll-mt-16 border-t border-line">
      <div className="grid md:grid-cols-2">
        <div className="flex flex-col justify-between gap-12 p-6 md:p-10">
          <p className={eyebrow}>(08) Contact</p>
          <div>
            <h2 className="text-[1.65rem] leading-[1.1] tracking-[-0.03em] md:text-[2.4rem]">Say hello.</h2>
            <address className="mt-6 grid gap-1.5 text-[13px] not-italic text-mute">
              {site.address.map((l) => (
                <span key={l}>{l}</span>
              ))}
              <span className="text-ink font-medium text-xs pt-1">
                Free on-site parking available
              </span>
              <a className="mt-2 text-ink hover:opacity-60" href={`mailto:${site.email}`}>
                {site.email}
              </a>
              <a className="text-ink hover:opacity-60" href={`tel:${site.phone.replace(/\s/g, "")}`}>
                {site.phone}
              </a>
              <a className="text-ink hover:opacity-60" href={site.instagram} target="_blank" rel="noopener noreferrer">
                Instagram ↗
              </a>
            </address>
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
