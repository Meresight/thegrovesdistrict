import type { Metadata } from "next";
import Link from "next/link";
import { BookingPanel } from "@/components/BookingPanel";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { site } from "@/lib/config";

export const metadata: Metadata = {
  title: "Book a Court",
  description: "Reserve an indoor pickleball court or book the entire Grove District facility for private events.",
};

export default function BookPage() {
  return (
    <div className="mx-auto max-w-[1240px] bg-white min-h-screen flex flex-col justify-between">
      <div>
        <Header />

        <main className="px-6 py-10 md:px-10">
          {/* Breadcrumb & Header */}
          <div className="mb-8">
            <div className="flex items-center gap-2 text-xs text-mute mb-2">
              <Link href="/" className="hover:text-ink">
                Home
              </Link>
              <span>/</span>
              <span className="text-ink">Book a Court</span>
            </div>
            <h1 className="text-3xl font-medium tracking-tight md:text-5xl">
              Court Reservations
            </h1>
            <p className="mt-2 text-xs md:text-sm text-mute leading-relaxed">
              Select a single court for hourly play or lock all 3 courts for a private event / tournament · Strict No-Cancellation Policy.
            </p>
          </div>

          {/* The Focused Booking Panel */}
          <div className="rounded-2xl border border-line bg-white shadow-sm overflow-hidden">
            <BookingPanel />
          </div>
        </main>
      </div>

      <Footer />
    </div>
  );
}
