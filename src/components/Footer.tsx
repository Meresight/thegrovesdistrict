import Image from "next/image";
import Link from "next/link";
import { site } from "@/lib/config";

export function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="flex flex-col items-center gap-4 px-6 py-10 text-center">
        <Image
          src="/images/logo.jpg"
          alt={`${site.name} — ${site.descriptor}`}
          width={220}
          height={220}
          className="size-[160px] mix-blend-multiply md:size-[190px]"
        />
        <nav className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs text-mute pt-2">
          <Link href="/book" className="hover:text-ink transition">
            Book a Court
          </Link>
          <Link href="/survey" className="hover:text-ink transition">
            Post-Game Survey
          </Link>
          <Link href="/waiver" className="hover:text-ink transition">
            Rules & Safety Waiver
          </Link>
          <Link href="/member" className="hover:text-ink transition">
            Member Portal
          </Link>
          <a
            href={site.mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-ink transition"
          >
            Google Maps Location ↗
          </a>
        </nav>
      </div>
      <div className="flex flex-col items-center justify-between gap-2 border-t border-line px-6 py-5 text-[11px] text-mute md:flex-row md:px-8">
        <p>
          © {new Date().getFullYear()} {site.name}. All rights reserved.
        </p>
        <p className="uppercase tracking-[0.16em]">{site.descriptor}</p>
      </div>
    </footer>
  );
}
