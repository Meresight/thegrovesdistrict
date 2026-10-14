"use client";

import { skillLevels } from "@/lib/config";
import { Honeypot, useJsonForm } from "./form-utils";
import { btnGhost, btnPrimary, eyebrow, input, label } from "./ui";

const perks = [
  "50% Off Every 10 Games (Loyalty Perk)",
  "Priority court booking & reservations",
  "Open play & round robin brackets",
  "Member-only tournaments & clinics",
  "Courtside café community perks",
];

export function Join() {
  const { status, error, submit, reset } = useJsonForm("/api/join");

  return (
    <section id="join" className="scroll-mt-16 border-t border-line">
      <div className="grid md:grid-cols-2">
        <div className="flex flex-col justify-between gap-12 p-6 md:p-10">
          <p className={eyebrow}>(06) Player Community</p>
          <div>
            <h2 className="text-[2rem] leading-[1.05] tracking-[-0.035em] md:text-[3.2rem]">
              Join the club.
              <br />
              <span className="text-mute">Play good company.</span>
            </h2>
            <ul className="mt-8 grid gap-2.5 text-[13px]">
              {perks.map((p) => (
                <li key={p} className="flex items-center gap-3">
                  <i className="size-1.5 rounded-full bg-lime" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-line bg-white p-6 md:border-l md:border-t-0 md:p-10">
          {status === "success" ? (
            <div className="flex min-h-[320px] flex-col justify-center gap-4">
              <span className="grid size-10 place-items-center rounded-full bg-lime/30 text-lg">✓</span>
              <h3 className="text-2xl tracking-[-0.02em]">You’re on the list.</h3>
              <p className="text-sm text-mute">We’ll be in touch soon with next steps. See you on court.</p>
              <button onClick={reset} className={`${btnGhost} self-start`}>
                Send another
              </button>
            </div>
          ) : (
            <form onSubmit={submit} className="relative space-y-4">
              <div>
                <label className={label} htmlFor="j-name">Full name</label>
                <input id="j-name" name="name" required minLength={2} maxLength={80} autoComplete="name" className={input} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className={label} htmlFor="j-email">Email</label>
                  <input id="j-email" name="email" type="email" required maxLength={120} autoComplete="email" className={input} />
                </div>
                <div>
                  <label className={label} htmlFor="j-phone">Phone (optional)</label>
                  <input id="j-phone" name="phone" type="tel" maxLength={20} autoComplete="tel" className={input} />
                </div>
              </div>
              <div>
                <label className={label} htmlFor="j-level">Skill level</label>
                <select id="j-level" name="level" defaultValue={skillLevels[3]} className={input}>
                  {skillLevels.map((l) => (
                    <option key={l}>{l}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={label} htmlFor="j-msg">Anything we should know? (optional)</label>
                <textarea id="j-msg" name="message" rows={3} maxLength={500} className={`${input} resize-none`} />
              </div>
              <Honeypot />
              {error && (
                <p role="alert" className="text-[13px] text-wine">
                  {error}
                </p>
              )}
              <button type="submit" disabled={status === "loading"} className={`${btnPrimary} w-full py-3`}>
                {status === "loading" ? "Sending…" : "Join the Club"}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
