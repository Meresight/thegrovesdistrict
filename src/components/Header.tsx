"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-browser";
import { AuthModal } from "./AuthModal";
import { useMember, signOutMember } from "@/lib/use-member";

export function Header() {
  const [open, setOpen] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const { user } = useMember();

  const linkCls = "text-[13px] text-ink transition hover:opacity-60";

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-line bg-white/90 backdrop-blur-md">
        <div className="grid h-[64px] grid-cols-[1fr_auto_1fr] items-center px-6 md:px-10">
          {/* Left: Essential navigation only (Courts & Café) */}
          <nav className="hidden items-center gap-8 md:flex" aria-label="Primary">
            <Link href="/#courts" className={linkCls}>
              Courts
            </Link>
            <Link href="/#cafe" className={linkCls}>
              Café
            </Link>
          </nav>

          <button
            className="justify-self-start size-9 rounded-lg flex flex-col items-center justify-center gap-1.5 md:hidden text-ink hover:bg-zinc-100 transition"
            aria-expanded={open}
            aria-label="Toggle navigation menu"
            aria-controls="mobile-menu"
            onClick={() => setOpen((o) => !o)}
          >
            {open ? (
              <span className="text-base font-light leading-none">✕</span>
            ) : (
              <div className="flex flex-col justify-between w-4 h-3">
                <span className="w-full h-0.5 bg-ink rounded-full"></span>
                <span className="w-full h-0.5 bg-ink rounded-full"></span>
                <span className="w-full h-0.5 bg-ink rounded-full"></span>
              </div>
            )}
          </button>

          {/* Center: Brand & Logo */}
          <Link href="/" aria-label="Grove District home" className="flex items-center gap-2.5 justify-self-center">
            <Image
              src="/images/logo-mark.png"
              alt="Grove District"
              width={34}
              height={34}
              priority
              className="size-[32px] mix-blend-multiply md:size-[36px]"
            />
            <span className="hidden text-[13px] font-semibold uppercase tracking-[0.22em] sm:inline">
              <span className="text-wine">Grove</span> <span className="text-navy">District</span>
            </span>
          </Link>

          {/* Right: Log In & Book a Court CTA */}
          <div className="flex items-center gap-3 justify-self-end">
            {user ? (
              <div className="flex items-center gap-2">
                <Link
                  href="/member"
                  className="hidden text-xs text-mute hover:text-ink sm:inline font-mono"
                >
                  {user.email?.split("@")[0]} <span className="text-[10px] text-lime font-medium bg-ink px-1.5 py-0.5 rounded ml-1">MEMBER</span>
                </Link>
                <Link
                  href="/member"
                  className="rounded-full border border-line bg-white px-3 py-1 text-xs text-ink hover:border-ink transition"
                >
                  My Games
                </Link>
                <button
                  type="button"
                  onClick={async () => {
                    await signOutMember();
                  }}
                  className="hidden sm:inline text-xs text-mute hover:text-ink transition px-1.5 py-1"
                  title="Sign out of member account"
                >
                  Sign Out
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowAuth(true)}
                className="text-xs font-semibold text-ink transition hover:opacity-70 px-2 py-1"
              >
                Log In
              </button>
            )}

            <Link
              href="/book"
              className="rounded-full bg-ink px-3.5 py-1.5 md:px-4 md:py-2 text-xs font-medium text-white transition hover:bg-black/80"
            >
              Book Court
            </Link>
          </div>
        </div>

        {/* Mobile slide menu with customer-only links */}
        {open && (
          <nav
            id="mobile-menu"
            className="grid gap-1 border-t border-line px-6 py-4 md:hidden bg-white animate-in slide-in-from-top-2 duration-150"
            aria-label="Mobile"
          >
            <Link href="/#courts" onClick={() => setOpen(false)} className="py-2.5 text-sm text-ink font-medium">
              Courts
            </Link>
            <Link href="/#ways-to-play" onClick={() => setOpen(false)} className="py-2.5 text-sm text-ink font-medium">
              Ways to Play
            </Link>
            <Link href="/#cafe" onClick={() => setOpen(false)} className="py-2.5 text-sm text-ink font-medium">
              Café
            </Link>
            <Link href="/#events" onClick={() => setOpen(false)} className="py-2.5 text-sm text-ink font-medium">
              Events
            </Link>
            <Link href="/#faq" onClick={() => setOpen(false)} className="py-2.5 text-sm text-ink font-medium">
              FAQ
            </Link>
            <Link href="/#contact" onClick={() => setOpen(false)} className="py-2.5 text-sm text-ink font-medium">
              Contact
            </Link>
            <div className="pt-3 border-t border-line/60 flex flex-col gap-2">
              {!user ? (
                <button
                  onClick={() => {
                    setOpen(false);
                    setShowAuth(true);
                  }}
                  className="py-2.5 text-left text-sm font-semibold text-ink"
                >
                  Log In to Member Account →
                </button>
              ) : (
                <div className="flex items-center justify-between py-2 text-xs text-mute">
                  <Link
                    href="/member"
                    onClick={() => setOpen(false)}
                    className="font-medium text-ink underline"
                  >
                    View My Member Dashboard →
                  </Link>
                  <button
                    type="button"
                    onClick={async () => {
                      setOpen(false);
                      await signOutMember();
                    }}
                    className="font-medium text-rose-600 hover:underline"
                  >
                    Sign Out
                  </button>
                </div>
              )}
            </div>
          </nav>
        )}
      </header>

      <AuthModal isOpen={showAuth} onClose={() => setShowAuth(false)} />
    </>
  );
}
