import Link from "next/link";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import {
  WAIVER_TITLE,
  WAIVER_PREAMBLE,
  WAIVER_SECTIONS,
  WAIVER_CONFIRMATION_TEXT,
  parseWaiverSections,
} from "@/lib/waiver";
import { getPublicClient } from "@/lib/supabase-public";

export const revalidate = 60;

export const metadata = {
  title: "Rules & Safety Waiver — Grove District",
  description:
    "Official Waiver, Release of Liability, and Facility Rules for Grove District Pickleball Club & Café.",
};

async function getWaiverData() {
  const db = getPublicClient();
  if (!db) return WAIVER_SECTIONS;
  const { data } = await db.from("club_settings").select("waiver_text").eq("id", 1).maybeSingle();
  let text = data?.waiver_text;
  if (text && text.trim().startsWith("{")) {
    try {
      const parsed = JSON.parse(text);
      text = parsed.text;
    } catch {}
  }
  return parseWaiverSections(text);
}

export default async function WaiverPage() {
  const sections = await getWaiverData();

  return (
    <div className="min-h-screen bg-bg text-ink flex flex-col">
      <Header />

      <main className="flex-1 max-w-4xl mx-auto px-6 py-12 md:py-16 space-y-8">
        {/* Page Header */}
        <div className="space-y-3 border-b border-line pb-6">
          <Link
            href="/"
            className="text-xs font-mono text-mute hover:text-ink transition inline-flex items-center gap-1.5"
          >
            ← Back to Club Home
          </Link>
          <div className="pt-2">
            <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-wine font-semibold">
              Official Agreement & Policies
            </span>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-ink mt-1">
              {WAIVER_TITLE}
            </h1>
          </div>
          <p className="text-xs md:text-sm text-mute leading-relaxed">
            {WAIVER_PREAMBLE}
          </p>
        </div>

        {/* Dynamic Waiver Sections */}
        <div className="space-y-4">
          {sections.map((s) => (
            <div
              key={s.num}
              className="rounded-2xl border border-line bg-white p-5 md:p-6 shadow-2xs space-y-2"
            >
              <h2 className="text-sm md:text-base font-semibold text-ink flex items-baseline gap-2">
                <span className="font-mono text-xs text-wine font-bold">{s.num}.</span>
                <span>{s.title}</span>
              </h2>
              <p className="text-xs md:text-sm text-ink/80 leading-relaxed">
                {s.text}
              </p>
            </div>
          ))}
        </div>

        {/* Bottom Acknowledgment Notice */}
        <div className="rounded-2xl border border-line bg-zinc-50 p-6 md:p-8 space-y-4">
          <h3 className="text-xs font-mono uppercase tracking-wider text-mute font-semibold">
            Player Confirmation & Representation
          </h3>
          <p className="text-xs md:text-sm text-ink leading-relaxed font-medium">
            &ldquo;{WAIVER_CONFIRMATION_TEXT}&rdquo;
          </p>
          <div className="pt-2 flex flex-wrap items-center gap-3">
            <Link
              href="/book"
              className="rounded-full bg-ink text-white px-6 py-2.5 text-xs font-semibold hover:bg-black transition shadow-xs"
            >
              Book a Court →
            </Link>
            <Link
              href="/"
              className="rounded-full border border-line px-5 py-2.5 text-xs font-medium text-ink hover:bg-white transition"
            >
              Return Home
            </Link>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
