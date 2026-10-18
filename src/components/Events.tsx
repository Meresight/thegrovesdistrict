import Link from "next/link";
import { fallbackEvents, site } from "@/lib/config";
import { getPublicClient } from "@/lib/supabase-public";
import { eyebrow } from "./ui";

type EventItem = { id: string; title: string; description: string | null; level: string; when: string };

const dateFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: site.timezone,
  weekday: "short",
  month: "short",
  day: "numeric",
});
const timeFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: site.timezone,
  hour: "numeric",
  minute: "2-digit",
});
const formatWhen = (iso: string) => {
  const d = new Date(iso);
  return `${dateFmt.format(d)} · ${timeFmt.format(d)}`;
};

async function loadEvents(): Promise<EventItem[]> {
  const db = getPublicClient();
  if (db) {
    const { data, error } = await db
      .from("events")
      .select("id,title,description,level,starts_at")
      .eq("published", true)
      .gte("starts_at", new Date().toISOString())
      .order("starts_at", { ascending: true })
      .limit(6);
    if (!error && data?.length) {
      return data.map((e) => ({
        id: e.id,
        title: e.title,
        description: e.description,
        level: e.level,
        when: formatWhen(e.starts_at),
      }));
    }
  }
  return fallbackEvents.map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    level: e.level,
    when: e.startsLabel,
  }));
}

export async function Events() {
  const events = await loadEvents();
  return (
    <section id="events" className="scroll-mt-16 border-t border-line">
      <div className="grid md:grid-cols-[1fr_2.2fr]">
        <div className="p-6 md:border-r md:border-line md:p-8">
          <p className={eyebrow}>(05) Open Play & Events</p>
        </div>
        <div className="p-6 md:p-12 md:pb-8">
          <h2 className="text-[1.65rem] leading-[1.1] tracking-[-0.03em] md:text-[2.4rem]">Weekly rallies & tournaments.</h2>
        </div>
      </div>
      <ul className="border-t border-line">
        {events.map((e) => (
          <li
            key={e.id}
            className="grid items-baseline gap-1 border-b border-line px-6 py-5 last:border-b-0 md:grid-cols-[1fr_2fr_auto] md:gap-6 md:px-8 md:py-6"
          >
            <span className="text-xs tabular-nums text-mute">{e.when}</span>
            <div>
              <p className="text-lg tracking-[-0.02em]">{e.title}</p>
              {e.description && <p className="text-[13px] text-mute">{e.description}</p>}
            </div>
            <div className="flex items-center gap-2.5 mt-2 md:mt-0 justify-end">
              <span className="w-fit rounded-full px-3 py-1 text-[11px] shadow-[0_0_0_1px_var(--color-line)]">
                {e.level}
              </span>
              <Link
                href="/book"
                className="rounded-full bg-ink text-white px-3.5 py-1 text-[11px] font-semibold hover:bg-black transition whitespace-nowrap shadow-2xs"
              >
                Book Court →
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
