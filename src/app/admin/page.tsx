"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-browser";
import { booking, courts, site, type CourtId } from "@/lib/config";
import { formatDateLabel, formatHour, nowInClubTz } from "@/lib/time";
import { btnGhost, btnPrimary, eyebrow, input, label } from "@/components/ui";
import {
  WAIVER_SECTIONS,
  WAIVER_TITLE,
  DEFAULT_FULL_WAIVER_TEXT,
  parseWaiverSections,
} from "@/lib/waiver";

const SLOTS = Array.from({ length: site.hours.close - site.hours.open }, (_, i) => site.hours.open + i);

type BookingRow = {
  id: string;
  booking_ref: string;
  booking_type: string;
  court_id: string;
  play_date: string;
  start_hour: number;
  name: string;
  email: string;
  phone: string;
  players: number;
  notes: string | null;
  total_price: number;
  discount_applied: number;
  receipt_url: string | null;
  status: "pending_review" | "confirmed" | "cancelled";
  created_at: string;
};

type ClubSettings = {
  regularHourlyRate: number;
  offPeakHourlyRate?: number;
  memberDiscountPercent: number;
  eventHourlyRate: number;
  currencySymbol: string;
  paymentAccountName: string;
  paymentAccountNumber: string;
  paymentQrUrl: string;
  waiverText: string;
  ownerNotificationEmail: string;
  announcement?: string;
};

type AdminView = "overview" | "queue" | "schedule" | "pricing" | "waiver";

export default function AdminPage() {
  const [session, setSession] = useState<{ access_token: string; user: { email: string } } | null>(null);
  const [loading, setLoading] = useState(true);

  // Login form
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);

  // Dashboard layout navigation
  const [activeView, setActiveView] = useState<AdminView>("queue");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending_review" | "today" | "confirmed" | "archived">("all");
  const [courtFilter, setCourtFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [resendingRef, setResendingRef] = useState<string | null>(null);
  const [resendStatus, setResendStatus] = useState<Record<string, string>>({});
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [selectedReceipt, setSelectedReceipt] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Walk-in / Block Court modal state
  const [showWalkInModal, setShowWalkInModal] = useState(false);
  const [walkInSubmitting, setWalkInSubmitting] = useState(false);
  const [walkInError, setWalkInError] = useState<string | null>(null);
  const [walkInForm, setWalkInForm] = useState({
    name: "Walk-in Guest",
    email: "walkin@grovedistrict.com",
    phone: "09000000000",
    date: nowInClubTz().date,
    courtId: "court-1" as CourtId,
    hours: [nowInClubTz().hour < 25 ? Math.max(8, nowInClubTz().hour) : 8],
    totalPrice: 450,
    bookingType: "single" as "single" | "event_buyout",
    notes: "Walk-in counter payment / Cash",
  });

  // Decline Reason modal state
  const [declineTargetRef, setDeclineTargetRef] = useState<string | null>(null);
  const [declineReason, setDeclineReason] = useState("Payment receipt unverified or unreadable");
  const [customDeclineNote, setCustomDeclineNote] = useState("");
  const [declineSubmitting, setDeclineSubmitting] = useState(false);

  // Settings form
  const [settings, setSettings] = useState<ClubSettings>({
    regularHourlyRate: 550,
    offPeakHourlyRate: 450,
    memberDiscountPercent: 50,
    eventHourlyRate: 1800,
    currencySymbol: "₱",
    paymentAccountName: "Grove District",
    paymentAccountNumber: "09509979540 (GCash / Maya)",
    paymentQrUrl: "/images/logo-mark.png",
    waiverText:
      "By booking a court at Grove District, I agree to the facility rules and release Grove District from liability.",
    ownerNotificationEmail: "grovedistrictcebu@gmail.com",
    announcement: "",
  });
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsMsg, setSettingsMsg] = useState<string | null>(null);
  const [qrFile, setQrFile] = useState<File | null>(null);
  const [showWaiverClauses, setShowWaiverClauses] = useState(false);

  useEffect(() => {
    if (supabase) {
      supabase.auth.getSession().then(({ data }) => {
        if (data.session) {
          setSession({
            access_token: data.session.access_token,
            user: { email: data.session.user.email || "" },
          });
        }
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!session) return;
    loadBookings();
    loadSettings();
  }, [session]);

  async function loadBookings() {
    setLoadingBookings(true);
    try {
      const res = await fetch("/api/admin/bookings", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json();
      if (data.bookings) setBookings(data.bookings);
    } catch {}
    setLoadingBookings(false);
  }

  async function loadSettings() {
    try {
      const res = await fetch("/api/settings");
      const data = await res.json();
      if (data.settings) {
        setSettings((prev) => ({
          ...prev,
          ...data.settings,
          waiverText:
            data.settings.waiverText && data.settings.waiverText.includes("1. ")
              ? data.settings.waiverText
              : DEFAULT_FULL_WAIVER_TEXT,
        }));
      }
    } catch {}
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);

    // Dev test account bypass
    if (email === "admin@grovedistrict.com" && password === "admin123456") {
      setSession({
        access_token: "dev-test-admin-token",
        user: { email: "admin@grovedistrict.com" },
      });
      return;
    }

    if (!supabase) {
      setLoginError("Invalid credentials or Supabase not connected.");
      return;
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setLoginError(error.message);
    } else if (data.session) {
      setSession({
        access_token: data.session.access_token,
        user: { email: data.session.user.email || "" },
      });
    }
  }

  async function updateBooking(
    ref: string,
    patch: { status?: "confirmed" | "cancelled" | "pending_review"; playDate?: string; courtId?: string; startHour?: number; notes?: string }
  ) {
    try {
      const res = await fetch("/api/admin/bookings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ bookingRef: ref, ...patch }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to update booking");
        return;
      }
      loadBookings();
    } catch {
      alert("Network error updating booking");
    }
  }

  async function handleToggleArchive(ref: string, currentNotes: string | null) {
    const raw = currentNotes || "";
    let nextNotes = "";
    if (raw.includes("[ARCHIVED]")) {
      nextNotes = raw.replace(/\[ARCHIVED\]\s*/g, "").trim();
    } else {
      nextNotes = `[ARCHIVED] ${raw}`.trim();
    }
    await updateBooking(ref, { notes: nextNotes });
  }

  async function handleResendEmail(ref: string) {
    setResendingRef(ref);
    try {
      const res = await fetch("/api/admin/bookings/resend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ bookingRef: ref }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        setResendStatus((prev) => ({ ...prev, [ref]: "sent" }));
        setTimeout(() => {
          setResendStatus((prev) => {
            const next = { ...prev };
            delete next[ref];
            return next;
          });
        }, 4000);
      } else {
        alert(data.error || "Failed to resend confirmation email");
      }
    } catch {
      alert("Network error resending email");
    } finally {
      setResendingRef(null);
    }
  }

  async function handleCreateWalkIn(e: React.FormEvent) {
    e.preventDefault();
    setWalkInSubmitting(true);
    setWalkInError(null);
    try {
      const res = await fetch("/api/admin/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(walkInForm),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to create booking");
      }
      setShowWalkInModal(false);
      loadBookings();
    } catch (err: any) {
      setWalkInError(err?.message || "Failed to create booking");
    } finally {
      setWalkInSubmitting(false);
    }
  }

  async function handleConfirmDecline() {
    if (!declineTargetRef) return;
    setDeclineSubmitting(true);
    const finalNote = customDeclineNote.trim()
      ? `Declined: ${declineReason} - ${customDeclineNote.trim()}`
      : `Declined: ${declineReason}`;
    await updateBooking(declineTargetRef, {
      status: "cancelled",
      notes: finalNote,
    });
    setDeclineSubmitting(false);
    setDeclineTargetRef(null);
    setCustomDeclineNote("");
  }

  async function saveSettings(e: React.FormEvent) {
    e.preventDefault();
    setSavingSettings(true);
    setSettingsMsg(null);
    try {
      let finalQrUrl = settings.paymentQrUrl;
      if (qrFile && supabase) {
        const ext = qrFile.name.split(".").pop();
        const path = `qr-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("receipts").upload(path, qrFile);
        if (!upErr) {
          const { data: pubData } = supabase.storage.from("receipts").getPublicUrl(path);
          finalQrUrl = pubData.publicUrl;
        }
      }

      const res = await fetch("/api/admin/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          ...settings,
          paymentQrUrl: finalQrUrl,
        }),
      });

      if (res.ok) {
        setSettingsMsg("Settings saved successfully!");
        setSettings((prev) => ({ ...prev, paymentQrUrl: finalQrUrl }));
      } else {
        setSettingsMsg("Error saving settings.");
      }
    } catch {
      setSettingsMsg("Network error.");
    } finally {
      setSavingSettings(false);
    }
  }

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-zinc-50 text-xs font-mono text-mute">
        Loading Owner Dashboard…
      </div>
    );
  }

  // Admin Login Screen
  if (!session) {
    return (
      <div className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-4 py-12">
        <div className="rounded-2xl border border-line bg-white p-8 shadow-sm">
          <Link href="/" className="text-xs text-mute hover:text-ink">
            ← Back to Grove District
          </Link>
          <div className="mt-4">
            <p className={eyebrow}>Grove District</p>
            <h1 className="text-2xl font-medium tracking-tight">Owner & Staff Portal</h1>
            <p className="mt-1 text-xs text-mute leading-relaxed">
              Sign in to verify customer payments, manage schedules, and update court rates.
            </p>
          </div>

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            <div>
              <label className={label}>Owner Email</label>
              <input
                type="email"
                required
                className={input}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@email.com"
              />
            </div>
            <div>
              <label className={label}>Password</label>
              <input
                type="password"
                required
                className={input}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
            </div>
            {loginError && <p className="text-xs text-rose-600">{loginError}</p>}
            <button type="submit" className={`${btnPrimary} w-full py-3 text-xs`}>
              Access Dashboard
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Helper to check if a booking is archived (past game, cancelled, flagged [ARCHIVED], or unreviewed after 25m)
  function isBookingArchived(first: BookingRow, todayStr: string): boolean {
    if (first.notes && first.notes.includes("[ARCHIVED]")) return true;
    if (first.status === "cancelled") return true;
    if (first.play_date < todayStr) return true;
    if (first.status === "pending_review") {
      const ageMs = Date.now() - new Date(first.created_at).getTime();
      if (ageMs >= 25 * 60 * 1000) return true;
    }
    return false;
  }

  // Group bookings by booking_ref
  const groupedBookings = bookings.reduce((acc, row) => {
    acc[row.booking_ref] = acc[row.booking_ref] || [];
    acc[row.booking_ref].push(row);
    return acc;
  }, {} as Record<string, BookingRow[]>);

  const todayDate = nowInClubTz().date;
  const allRefs = Object.keys(groupedBookings);

  const pendingCount = allRefs.filter((ref) => {
    const first = groupedBookings[ref][0];
    return !isBookingArchived(first, todayDate) && first.status === "pending_review";
  }).length;

  const todayCount = allRefs.filter((ref) => {
    const first = groupedBookings[ref][0];
    return !isBookingArchived(first, todayDate) && first.play_date === todayDate && first.status !== "cancelled";
  }).length;

  const confirmedCount = allRefs.filter((ref) => {
    const first = groupedBookings[ref][0];
    return !isBookingArchived(first, todayDate) && first.status === "confirmed";
  }).length;

  const archivedCount = allRefs.filter((ref) => {
    const first = groupedBookings[ref][0];
    return isBookingArchived(first, todayDate);
  }).length;

  const totalRevenue = allRefs
    .filter((ref) => groupedBookings[ref][0].status === "confirmed")
    .reduce((sum, ref) => sum + (groupedBookings[ref][0].total_price || 0), 0);

  const filteredRefs = allRefs.filter((ref) => {
    const first = groupedBookings[ref][0];
    const isArchived = isBookingArchived(first, todayDate);

    if (statusFilter === "pending_review") {
      if (isArchived || first.status !== "pending_review") return false;
    } else if (statusFilter === "today") {
      if (isArchived || first.play_date !== todayDate || first.status === "cancelled") return false;
    } else if (statusFilter === "confirmed") {
      if (isArchived || first.status !== "confirmed") return false;
    } else if (statusFilter === "archived") {
      if (!isArchived) return false;
    }
    // "all" shows everything

    // Court filter
    if (courtFilter !== "all") {
      if (courtFilter === "buyout" && first.booking_type !== "event_buyout") return false;
      if (courtFilter !== "buyout" && !groupedBookings[ref].some((r) => r.court_id === courtFilter)) return false;
    }

    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      const matchName = first.name?.toLowerCase().includes(q);
      const matchEmail = first.email?.toLowerCase().includes(q);
      const matchPhone = first.phone?.toLowerCase().includes(q);
      const matchRef = ref.toLowerCase().includes(q);
      if (!matchName && !matchEmail && !matchPhone && !matchRef) return false;
    }

    return true;
  });

  return (
    <div className="min-h-screen bg-zinc-50 flex flex-col md:flex-row">
      {/* Industry Standard Admin Sidebar */}
      <aside className="w-full md:w-64 border-b md:border-b-0 md:border-r border-line bg-white flex flex-col justify-between shrink-0">
        <div>
          {/* Brand header */}
          <div className="h-16 px-6 flex items-center justify-between border-b border-line">
            <Link href="/" className="flex items-center gap-2.5">
              <Image
                src="/images/logo-mark.png"
                alt="Grove District"
                width={28}
                height={28}
                className="size-7 mix-blend-multiply"
              />
              <span className="font-semibold uppercase tracking-wider text-xs">
                <span className="text-wine">Grove</span> <span className="text-navy">District</span>
              </span>
            </Link>
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="md:hidden text-xs text-mute"
            >
              {sidebarOpen ? "✕" : "☰"}
            </button>
          </div>

          {/* Navigation Links */}
          <nav className={`p-4 space-y-1 ${sidebarOpen ? "block" : "hidden md:block"}`}>
            <button
              onClick={() => {
                setActiveView("queue");
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                activeView === "queue"
                  ? "bg-ink text-white shadow-xs"
                  : "text-ink/80 hover:bg-zinc-100"
              }`}
            >
              <span>Booking Queue</span>
              {pendingCount > 0 && (
                <span
                  className={`size-5 rounded-full text-[10px] flex items-center justify-center font-bold ${
                    activeView === "queue" ? "bg-amber-400 text-ink" : "bg-amber-500 text-white"
                  }`}
                >
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setActiveView("overview");
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                activeView === "overview"
                  ? "bg-ink text-white shadow-xs"
                  : "text-ink/80 hover:bg-zinc-100"
              }`}
            >
              Analytics & Stats
            </button>

            <button
              onClick={() => {
                setActiveView("pricing");
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                activeView === "pricing"
                  ? "bg-ink text-white shadow-xs"
                  : "text-ink/80 hover:bg-zinc-100"
              }`}
            >
              Club Rates & Info
            </button>

            <button
              onClick={() => {
                setActiveView("waiver");
                setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition ${
                activeView === "waiver"
                  ? "bg-ink text-white shadow-xs"
                  : "text-ink/80 hover:bg-zinc-100"
              }`}
            >
              Rules & Waiver
            </button>

            <div className="pt-4 border-t border-line/60 my-2">
              <Link
                href="/book"
                target="_blank"
                className="w-full flex items-center justify-between px-3.5 py-2 text-xs text-mute hover:text-ink font-medium"
              >
                <span>Live Court Matrix</span>
                <span>↗</span>
              </Link>
            </div>
          </nav>
        </div>

        {/* Sidebar Footer with user badge */}
        <div className="p-4 border-t border-line bg-zinc-50/50">
          <div className="flex items-center justify-between">
            <div className="truncate mr-2">
              <p className="text-[10px] font-mono uppercase text-mute">Admin User</p>
              <p className="text-xs font-medium text-ink truncate">{session.user.email}</p>
            </div>
            <button
              onClick={() => {
                supabase?.auth.signOut();
                setSession(null);
              }}
              className="text-xs text-rose-600 hover:underline font-semibold"
            >
              Log Out
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <header className="h-16 border-b border-line bg-white px-6 md:px-8 flex items-center justify-between shrink-0">
          <div>
            <h1 className="text-base font-semibold text-ink capitalize">
              {activeView === "queue" && "Customer Booking Queue"}
              {activeView === "overview" && "Club Performance & Revenue"}
              {activeView === "pricing" && "Court Pricing & GCash Details"}
              {activeView === "waiver" && "Player Waiver & Club Rules"}
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={loadBookings} className={`${btnGhost} text-xs py-1.5 px-3`}>
              ↻ Refresh Live
            </button>
            <button
              onClick={() => {
                supabase?.auth.signOut();
                setSession(null);
              }}
              className="rounded-xl border border-line bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:border-rose-200 transition"
            >
              Log Out
            </button>
          </div>
        </header>

        {/* Dynamic Body based on Sidebar View */}
        <main className="p-6 md:p-8 space-y-6 overflow-y-auto">
          {/* VIEW 1: BOOKING QUEUE */}
          {activeView === "queue" && (
            <div className="space-y-5">
              {/* Top Action Bar: Search input + Court select + Add Walk-in button */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 max-w-xl">
                  <div className="relative flex-1">
                    <input
                      type="text"
                      placeholder="Search player name, phone, email, or #ref…"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full rounded-xl border border-line bg-white px-3.5 py-2 text-xs text-ink placeholder:text-zinc-400 outline-none focus:border-ink shadow-2xs font-mono"
                    />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm("")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-mute hover:text-ink"
                      >
                        ✕
                      </button>
                    )}
                  </div>

                  <select
                    value={courtFilter}
                    onChange={(e) => setCourtFilter(e.target.value)}
                    className="rounded-xl border border-line bg-white px-3 py-2 text-xs text-ink font-medium shadow-2xs outline-none focus:border-ink"
                  >
                    <option value="all">All Courts</option>
                    <option value="court-1">Court 1 (Apex)</option>
                    <option value="court-2">Court 2 (Baseline)</option>
                    <option value="court-3">Court 3 (Kitchen)</option>
                    <option value="buyout">Whole Buyout</option>
                  </select>
                </div>

                <button
                  onClick={() => setShowWalkInModal(true)}
                  className="rounded-xl bg-ink text-white px-4 py-2 text-xs font-semibold hover:bg-black transition shadow-xs flex items-center justify-center gap-1.5 shrink-0"
                >
                  <span className="text-base leading-none">+</span> Add Walk-In / Block Court
                </button>
              </div>

              {/* Smart Filter Pills */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setStatusFilter("pending_review")}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition flex items-center gap-1.5 ${
                      statusFilter === "pending_review"
                        ? "bg-amber-600 text-white shadow-xs"
                        : pendingCount > 0
                        ? "bg-amber-50 border border-amber-300 text-amber-900 font-semibold"
                        : "bg-white border border-line text-mute hover:text-ink"
                    }`}
                  >
                    <span>Needs Verification</span>
                    <span className="font-mono text-[11px] px-1 rounded-full bg-black/10">
                      {pendingCount}
                    </span>
                  </button>
                  <button
                    onClick={() => setStatusFilter("today")}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition flex items-center gap-1.5 ${
                      statusFilter === "today"
                        ? "bg-wine text-white shadow-xs"
                        : "bg-white border border-line text-wine hover:border-wine/40"
                    }`}
                  >
                    <span>Today&apos;s Schedule</span>
                    <span className="font-mono text-[11px] px-1 rounded-full bg-black/10">
                      {todayCount}
                    </span>
                  </button>
                  <button
                    onClick={() => setStatusFilter("confirmed")}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition flex items-center gap-1.5 ${
                      statusFilter === "confirmed"
                        ? "bg-emerald-700 text-white shadow-xs"
                        : "bg-white border border-line text-emerald-800 hover:border-emerald-300"
                    }`}
                  >
                    <span>Upcoming Confirmed</span>
                    <span className="font-mono text-[11px] px-1 rounded-full bg-black/10">
                      {confirmedCount}
                    </span>
                  </button>
                  <button
                    onClick={() => setStatusFilter("archived")}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition flex items-center gap-1.5 ${
                      statusFilter === "archived"
                        ? "bg-zinc-800 text-white shadow-xs"
                        : "bg-white border border-line text-mute hover:text-ink"
                    }`}
                  >
                    <span>Past & Archived</span>
                    <span className="font-mono text-[11px] px-1 rounded-full bg-black/10">
                      {archivedCount}
                    </span>
                  </button>
                  <button
                    onClick={() => setStatusFilter("all")}
                    className={`rounded-full px-3 py-1 text-xs font-medium transition flex items-center gap-1.5 ${
                      statusFilter === "all"
                        ? "bg-ink text-white shadow-xs"
                        : "bg-white border border-line text-mute hover:text-ink"
                    }`}
                  >
                    <span>All Bookings</span>
                    <span className="font-mono text-[11px] px-1 rounded-full bg-black/10">
                      {allRefs.length}
                    </span>
                  </button>
                </div>

                <span className="text-xs font-mono text-mute">{filteredRefs.length} item(s)</span>
              </div>

              {loadingBookings ? (
                <div className="p-12 text-center text-xs text-mute font-mono">Loading reservations queue…</div>
              ) : filteredRefs.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-line bg-white p-12 text-center text-xs text-mute space-y-1">
                  <p className="font-medium text-ink">No bookings found for this filter</p>
                  <p>Customer reservations will appear here in real-time as they book.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredRefs.map((ref) => {
                    const rows = groupedBookings[ref];
                    const first = rows[0];
                    const isEvent = first.booking_type === "event_buyout";
                    const distinctCourts = [...new Set(rows.map((r) => courts.find((c) => c.id === r.court_id)?.name || r.court_id))];
                    const courtDisplay = isEvent
                      ? "Whole Facility Buyout (All Courts)"
                      : distinctCourts.join(", ");
                    const distinctHours = [...new Set(rows.map((r) => r.start_hour))].sort((a, b) => a - b);
                    const hours = distinctHours.map((h) => formatHour(h)).join(", ");
                    const totalSlots = rows.length;
                    const isArchived = isBookingArchived(first, todayDate);
                    const isPast = first.play_date < todayDate;
                    const hasArchivedNote = first.notes?.includes("[ARCHIVED]");

                    return (
                      <div
                        key={ref}
                        className={`rounded-2xl border bg-white p-5 shadow-xs transition space-y-4 ${
                          isArchived ? "border-line/70 opacity-90" : "border-line hover:border-ink/60"
                        }`}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="space-y-1.5">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-xs font-bold text-ink">
                                #{ref.slice(0, 8).toUpperCase()}
                              </span>

                              {first.status === "confirmed" && (
                                <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 uppercase">
                                  ✓ Confirmed & Paid
                                </span>
                              )}
                              {first.status === "pending_review" && (() => {
                                const ageMs = Date.now() - new Date(first.created_at).getTime();
                                const isExpired = ageMs >= 25 * 60 * 1000;
                                const minsLeft = Math.max(0, Math.ceil((25 * 60 * 1000 - ageMs) / 60000));
                                if (isExpired) {
                                  return (
                                    <span className="rounded-full bg-zinc-100 border border-zinc-300 px-2.5 py-0.5 text-[10px] font-bold text-zinc-600 uppercase">
                                      ⏱ Auto-Released (25m Unverified)
                                    </span>
                                  );
                                }
                                return (
                                  <span className="rounded-full bg-amber-50 border border-amber-300 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 uppercase animate-pulse">
                                    ⏳ Pending ({minsLeft}m hold)
                                  </span>
                                );
                              })()}
                              {first.status === "cancelled" && (
                                <span className="rounded-full bg-rose-50 border border-rose-200 px-2.5 py-0.5 text-[10px] font-bold text-rose-700 uppercase">
                                  ✕ Declined
                                </span>
                              )}

                              {isEvent && (
                                <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-mono text-white">
                                  BUYOUT
                                </span>
                              )}

                              {hasArchivedNote ? (
                                <span className="rounded-full bg-zinc-100 border border-zinc-300 px-2 py-0.5 text-[10px] font-mono text-zinc-600">
                                  📦 Archived
                                </span>
                              ) : isPast ? (
                                <span className="rounded-full bg-zinc-100 border border-zinc-200 px-2 py-0.5 text-[10px] font-mono text-zinc-500">
                                  ⏱ Past Game
                                </span>
                              ) : null}
                            </div>

                            <h3 className="text-base font-semibold text-ink">{first.name}</h3>
                            <p className="text-xs text-mute font-mono">
                              {first.email} · {first.phone} · {first.players} players
                            </p>

                            <div className="pt-1 text-xs text-ink/80 flex flex-wrap items-center gap-x-3 gap-y-1">
                              <span className="font-semibold text-ink">{courtDisplay}</span>
                              <span>·</span>
                              <span>{formatDateLabel(first.play_date, { weekday: "short", month: "short", day: "numeric" })}</span>
                              <span>·</span>
                              <span className="font-mono text-ink font-medium">{hours}</span>
                              <span className="text-[10px] font-mono font-medium text-zinc-600 bg-zinc-100 border border-zinc-200 px-2 py-0.5 rounded-full">
                                {totalSlots} Court-Hour{totalSlots > 1 ? "s" : ""}
                              </span>
                            </div>

                            {first.notes && (
                              <p className="text-xs text-mute italic bg-zinc-50 p-2 rounded-lg border border-line">
                                Note: {first.notes.replace(/\[ARCHIVED\]\s*/g, "")}
                              </p>
                            )}
                          </div>

                          {/* Price & Action Panel */}
                          <div className="flex flex-col items-end gap-3">
                            <div className="text-right">
                              <span className="text-[11px] text-mute block">Total Charged</span>
                              <span className="text-xl font-bold font-mono text-ink">
                                ₱{first.total_price}
                              </span>
                              {first.discount_applied > 0 && (
                                <span className="text-[10px] text-emerald-600 block">
                                  (Saved ₱{first.discount_applied} loyalty perk discount)
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              {first.receipt_url ? (
                                <button
                                  onClick={() => setSelectedReceipt(first.receipt_url)}
                                  className="rounded-xl border border-line bg-white px-3 py-1.5 text-xs text-ink hover:border-ink font-semibold flex items-center gap-1.5 shadow-2xs"
                                >
                                  <span>🧾</span> View Payment Receipt
                                </button>
                              ) : (
                                <span className="text-[11px] text-mute italic px-2">No receipt attached</span>
                              )}

                              {/* Reschedule inline tool */}
                              <div className="flex items-center gap-1 text-xs bg-zinc-50 border border-line px-2 py-1 rounded-xl">
                                <span className="text-[10px] font-mono text-mute uppercase">Move Date:</span>
                                <input
                                  type="date"
                                  defaultValue={first.play_date}
                                  onChange={(e) => updateBooking(ref, { playDate: e.target.value })}
                                  className="bg-transparent text-xs text-ink font-mono outline-none cursor-pointer"
                                />
                              </div>

                              {first.status === "pending_review" && (
                                <>
                                  <button
                                    onClick={() => updateBooking(ref, { status: "confirmed" })}
                                    className="rounded-xl bg-ink px-4 py-1.5 text-xs font-semibold text-white hover:bg-black transition shadow-xs"
                                  >
                                    ✓ Approve
                                  </button>
                                  <button
                                    onClick={() => {
                                      setDeclineTargetRef(ref);
                                      setDeclineReason("Payment receipt unverified or unreadable");
                                      setCustomDeclineNote("");
                                    }}
                                    className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition"
                                  >
                                    Decline
                                  </button>
                                </>
                              )}

                              {first.status === "confirmed" && (
                                <>
                                  <button
                                    onClick={() => handleResendEmail(ref)}
                                    disabled={resendingRef === ref}
                                    className={`rounded-xl border border-line px-3 py-1.5 text-xs font-semibold transition ${
                                      resendStatus[ref] === "sent"
                                        ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                                        : "bg-white text-ink hover:border-ink shadow-2xs"
                                    }`}
                                    title="Resend email confirmation to player and owner"
                                  >
                                    {resendingRef === ref
                                      ? "Sending…"
                                      : resendStatus[ref] === "sent"
                                      ? "✓ Email Sent!"
                                      : "✉ Resend Email"}
                                  </button>
                                  <button
                                    onClick={() => {
                                      setDeclineTargetRef(ref);
                                      setDeclineReason("Emergency maintenance or slot cancellation");
                                      setCustomDeclineNote("");
                                    }}
                                    className="rounded-xl border border-line px-2.5 py-1 text-[11px] text-mute hover:text-rose-600"
                                  >
                                    Cancel
                                  </button>
                                </>
                              )}

                              {first.status === "cancelled" && (
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => updateBooking(ref, { status: "pending_review", notes: "Restored to review by admin" })}
                                    className="rounded-xl border border-line bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold text-ink hover:bg-zinc-100 transition shadow-2xs"
                                    title="Restore this booking back to review"
                                  >
                                    ↩ Restore
                                  </button>
                                  <button
                                    onClick={() => updateBooking(ref, { status: "confirmed", notes: "Re-approved by admin" })}
                                    className="rounded-xl bg-ink text-white px-2.5 py-1 text-[11px] font-semibold hover:bg-black transition shadow-2xs"
                                    title="Re-approve this booking directly"
                                  >
                                    ✓ Re-Approve
                                  </button>
                                </div>
                              )}

                              {/* Archive / Unarchive Button */}
                              <button
                                onClick={() => handleToggleArchive(ref, first.notes)}
                                className={`rounded-xl border px-2.5 py-1 text-[11px] font-medium transition ${
                                  hasArchivedNote
                                    ? "bg-zinc-100 border-zinc-300 text-zinc-700 hover:bg-zinc-200"
                                    : "bg-white border-line text-mute hover:text-ink hover:border-ink shadow-2xs"
                                }`}
                                title={hasArchivedNote ? "Remove from archived queue" : "Archive and hide from active queue"}
                              >
                                {hasArchivedNote ? "Unarchive" : "Archive"}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* VIEW 2: OVERVIEW & ANALYTICS */}
          {activeView === "overview" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="rounded-2xl border border-line bg-white p-5 space-y-1 shadow-xs">
                  <p className="text-[11px] uppercase font-mono tracking-wider text-mute">Action Required</p>
                  <p className="text-3xl font-bold font-mono text-amber-600">{pendingCount}</p>
                  <p className="text-[11px] text-mute">Pending verifications</p>
                </div>
                <div className="rounded-2xl border border-line bg-white p-5 space-y-1 shadow-xs">
                  <p className="text-[11px] uppercase font-mono tracking-wider text-mute">Confirmed Bookings</p>
                  <p className="text-3xl font-bold font-mono text-emerald-700">{confirmedCount}</p>
                  <p className="text-[11px] text-mute">Locked court hours</p>
                </div>
                <div className="rounded-2xl border border-line bg-white p-5 space-y-1 shadow-xs">
                  <p className="text-[11px] uppercase font-mono tracking-wider text-mute">Verified Revenue</p>
                  <p className="text-3xl font-bold font-mono text-ink">₱{totalRevenue.toLocaleString()}</p>
                  <p className="text-[11px] text-mute">Approved payments total</p>
                </div>
                <div className="rounded-2xl border border-line bg-white p-5 space-y-1 shadow-xs">
                  <p className="text-[11px] uppercase font-mono tracking-wider text-mute">Total Volume</p>
                  <p className="text-3xl font-bold font-mono text-ink">{allRefs.length}</p>
                  <p className="text-[11px] text-mute">All customer bookings</p>
                </div>
              </div>

              <div className="rounded-2xl border border-line bg-white p-6 space-y-4">
                <h3 className="text-base font-semibold text-ink">Club Operating Summary</h3>
                <div className="grid sm:grid-cols-3 gap-4 text-xs">
                  <div className="p-4 rounded-xl bg-zinc-50 border border-line space-y-1">
                    <p className="font-semibold text-ink">Operating Schedule</p>
                    <p className="text-mute">Daily 8:00 AM – 2:00 AM (18 Hours)</p>
                  </div>
                  <div className="p-4 rounded-xl bg-zinc-50 border border-line space-y-1">
                    <p className="font-semibold text-ink">Hourly Rates</p>
                    <p className="text-mute">Off-Peak (8am–4pm): ₱450 · Peak: ₱550</p>
                  </div>
                  <div className="p-4 rounded-xl bg-zinc-50 border border-line space-y-1">
                    <p className="font-semibold text-ink">Loyalty Mechanic</p>
                    <p className="text-mute">50% discount on 10th game for 1 court</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* VIEW 3: PRICING & SETTINGS */}
          {activeView === "pricing" && (
            <div className="rounded-2xl border border-line bg-white p-6 md:p-8 max-w-3xl space-y-6">
              <div>
                <h2 className="text-lg font-semibold text-ink">Live Rates & Payment Accounts</h2>
                <p className="text-xs text-mute mt-0.5">
                  Changes updated here reflect across the court booking schedule immediately.
                </p>
              </div>

              <form onSubmit={saveSettings} className="space-y-6">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={label}>Off-Peak Hourly Rate (8AM – 4PM)</label>
                    <input
                      type="number"
                      required
                      min={0}
                      className={input}
                      value={settings.offPeakHourlyRate ?? 450}
                      onChange={(e) =>
                        setSettings({ ...settings, offPeakHourlyRate: Number(e.target.value) })
                      }
                    />
                    <span className="text-[10px] text-mute">Daytime rate per court (default ₱450).</span>
                  </div>

                  <div>
                    <label className={label}>Peak Hourly Rate (4PM – 2AM)</label>
                    <input
                      type="number"
                      required
                      min={0}
                      className={input}
                      value={settings.regularHourlyRate}
                      onChange={(e) =>
                        setSettings({ ...settings, regularHourlyRate: Number(e.target.value) })
                      }
                    />
                    <span className="text-[10px] text-mute">Standard evening rate per court (default ₱550).</span>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={label}>Full Facility Buyout Rate (All 3 Courts/Hour)</label>
                    <input
                      type="number"
                      required
                      min={0}
                      className={input}
                      value={settings.eventHourlyRate}
                      onChange={(e) =>
                        setSettings({ ...settings, eventHourlyRate: Number(e.target.value) })
                      }
                    />
                    <span className="text-[10px] text-mute">Rate per hour when booking all 3 courts together (default ₱1,800).</span>
                  </div>

                  <div>
                    <label className={label}>10th Game Loyalty Discount (%)</label>
                    <input
                      type="number"
                      required
                      min={0}
                      max={100}
                      className={input}
                      value={settings.memberDiscountPercent}
                      onChange={(e) =>
                        setSettings({ ...settings, memberDiscountPercent: Number(e.target.value) })
                      }
                    />
                    <span className="text-[10px] text-mute">Applies to 1 court slot on player&apos;s 10th game (50% off).</span>
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className={label}>Currency Symbol</label>
                    <input
                      type="text"
                      required
                      className={input}
                      value={settings.currencySymbol}
                      onChange={(e) =>
                        setSettings({ ...settings, currencySymbol: e.target.value })
                      }
                    />
                  </div>
                </div>

                <div className="border-t border-line pt-4 space-y-2">
                  <label className={label}>Urgent Announcement Notice (Optional)</label>
                  <textarea
                    rows={2}
                    placeholder="e.g. Club tournament this Saturday 2PM–6PM. Court 1 & 2 closed for private event."
                    className={`${input} resize-none`}
                    value={settings.announcement ?? ""}
                    onChange={(e) =>
                      setSettings({ ...settings, announcement: e.target.value })
                    }
                  />
                  <span className="text-[10px] text-mute block">
                    When filled, an alert banner appears prominently at the top of the customer booking calendar. Leave empty to hide.
                  </span>
                </div>

                <div className="border-t border-line pt-4 space-y-4">
                  <h3 className="text-sm font-semibold text-ink">Payment Account Information</h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className={label}>Account Name</label>
                      <input
                        type="text"
                        required
                        className={input}
                        value={settings.paymentAccountName}
                        onChange={(e) =>
                          setSettings({ ...settings, paymentAccountName: e.target.value })
                        }
                      />
                    </div>
                    <div>
                      <label className={label}>Payment Number (GCash / Maya / Bank)</label>
                      <input
                        type="text"
                        required
                        className={input}
                        value={settings.paymentAccountNumber}
                        onChange={(e) =>
                          setSettings({ ...settings, paymentAccountNumber: e.target.value })
                        }
                      />
                    </div>
                  </div>

                  <div>
                    <label className={label}>Upload New QR Ph / GCash Image</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setQrFile(e.target.files?.[0] || null)}
                      className="text-xs text-mute file:mr-3 file:rounded-xl file:border-0 file:bg-ink file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white"
                    />
                    {settings.paymentQrUrl && (
                      <div className="mt-3 flex items-center gap-3">
                        <div className="relative size-20 rounded-xl border border-line overflow-hidden bg-white p-1">
                          <Image src={settings.paymentQrUrl} alt="Payment QR" fill className="object-contain" />
                        </div>
                        <span className="text-xs text-mute font-mono">Current active QR code</span>
                      </div>
                    )}
                  </div>
                </div>

                {settingsMsg && (
                  <p className="text-xs font-semibold text-emerald-700 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                    ✓ {settingsMsg}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={savingSettings}
                  className={`${btnPrimary} px-6 py-2.5 text-xs`}
                >
                  {savingSettings ? "Saving Settings…" : "Save Changes"}
                </button>
              </form>
            </div>
          )}

          {/* VIEW 4: WAIVER & RULES */}
          {activeView === "waiver" && (() => {
            const parsedSections = parseWaiverSections(settings.waiverText);
            return (
              <div className="rounded-2xl border border-line bg-white p-6 md:p-8 max-w-3xl space-y-6">
                <div className="border-b border-line pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-lg font-semibold text-ink">Player Safety Waiver & Club Rules</h2>
                      <span className="rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 text-[10px] font-mono font-bold">
                        {parsedSections.length} Sections Live
                      </span>
                    </div>
                    <p className="text-xs text-mute mt-0.5">
                      Full control over legal clauses, house rules, and terms presented to customers at checkout.
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Link
                      href="/waiver"
                      target="_blank"
                      className="text-xs font-mono text-navy underline hover:opacity-80"
                    >
                      Public Waiver Page ↗
                    </Link>
                    <Link
                      href="/book"
                      target="_blank"
                      className="text-xs font-mono text-mute hover:text-ink underline"
                    >
                      Test Checkout ↗
                    </Link>
                  </div>
                </div>

                <form onSubmit={saveSettings} className="space-y-5">
                  <div>
                    <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
                      <div>
                        <label className={label}>Full Editable Waiver & Facility Rules Text</label>
                        <span className="text-[11px] text-mute block">
                          Format each section as &ldquo;1. Title&rdquo; followed by description text.
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (
                            confirm(
                              "Reset waiver to the official 16-point Grove District legal agreement? Any custom edits will be replaced."
                            )
                          ) {
                            setSettings({ ...settings, waiverText: DEFAULT_FULL_WAIVER_TEXT });
                          }
                        }}
                        className="rounded-lg border border-line bg-zinc-50 px-2.5 py-1 text-[11px] font-semibold text-ink hover:bg-zinc-100 transition shadow-2xs"
                      >
                        ↺ Reset to Official 16-Point Legal Text
                      </button>
                    </div>

                    <textarea
                      rows={16}
                      className="w-full rounded-xl border border-line bg-white p-3.5 font-mono text-[11px] leading-relaxed text-ink focus:border-ink outline-none resize-y shadow-2xs"
                      value={settings.waiverText}
                      onChange={(e) => setSettings({ ...settings, waiverText: e.target.value })}
                      placeholder="1. Assumption of Risk&#10;Text here...&#10;&#10;2. Release of Liability&#10;Text here..."
                    />
                  </div>

                  {/* Live Customer Preview Accordion */}
                  <div className="rounded-xl border border-line bg-zinc-50 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="size-2 rounded-full bg-emerald-500"></span>
                        <span className="text-xs font-semibold text-ink">
                          Live Player Preview ({parsedSections.length} Formatted Clauses)
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowWaiverClauses(!showWaiverClauses)}
                        className="text-[11px] font-mono font-medium text-navy hover:underline"
                      >
                        {showWaiverClauses ? "Hide Preview ↑" : "Inspect Customer Preview ↓"}
                      </button>
                    </div>
                    <p className="text-[11px] text-mute leading-relaxed">
                      This is exactly how your clauses are structured and displayed inside the customer checkout drawer and on the public agreement page.
                    </p>

                    {showWaiverClauses && (
                      <div className="pt-2 border-t border-line space-y-2.5 max-h-80 overflow-y-auto pr-1">
                        {parsedSections.map((s) => (
                          <div key={s.num} className="text-xs bg-white p-3 rounded-lg border border-line space-y-1">
                            <p className="font-bold text-ink text-[11px] uppercase tracking-wide">
                              {s.num}. {s.title}
                            </p>
                            <p className="text-mute text-[11px] leading-relaxed whitespace-pre-line">
                              {s.text}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className={label}>Owner Notification Email</label>
                    <input
                      type="email"
                      required
                      className={input}
                      value={settings.ownerNotificationEmail}
                      onChange={(e) =>
                        setSettings({ ...settings, ownerNotificationEmail: e.target.value })
                      }
                    />
                    <span className="text-[10px] text-mute">Alert address for new booking submissions.</span>
                  </div>

                  {settingsMsg && (
                    <p className="text-xs font-semibold text-emerald-700 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                      ✓ {settingsMsg}
                    </p>
                  )}

                  <div className="flex items-center gap-3 pt-2">
                    <button
                      type="submit"
                      disabled={savingSettings}
                      className={`${btnPrimary} px-6 py-2.5 text-xs`}
                    >
                      {savingSettings ? "Saving Live Waiver…" : "Save & Publish Live Waiver"}
                    </button>
                    <span className="text-[11px] text-mute">
                      Updates customer checkout & waiver page instantly.
                    </span>
                  </div>
                </form>
              </div>
            );
          })()}
        </main>
      </div>

      {/* Payment Receipt Full Preview Modal */}
      {selectedReceipt && (() => {
        const proxySrc = selectedReceipt.startsWith("/api/receipt")
          ? selectedReceipt
          : `/api/receipt?url=${encodeURIComponent(selectedReceipt)}`;

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <div className="relative max-w-lg w-full rounded-2xl bg-white p-5 shadow-2xl space-y-3">
              <div className="flex items-center justify-between pb-2 border-b border-line">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-semibold text-ink">Payment Screenshot Verification</h3>
                  <a
                    href={proxySrc}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-navy font-medium underline hover:opacity-80"
                  >
                    Open in New Tab ↗
                  </a>
                </div>
                <button
                  onClick={() => setSelectedReceipt(null)}
                  className="size-7 rounded-full flex items-center justify-center text-xs text-mute hover:bg-zinc-100 hover:text-ink"
                  aria-label="Close"
                >
                  ✕
                </button>
              </div>
              <div className="relative w-full h-[500px] bg-zinc-50 rounded-xl overflow-hidden border border-line flex items-center justify-center p-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={proxySrc}
                  alt="Payment Receipt"
                  className="max-w-full max-h-full object-contain rounded-lg shadow-2xs"
                  onError={(e) => {
                    if (e.currentTarget.src !== selectedReceipt) {
                      e.currentTarget.src = selectedReceipt;
                    }
                  }}
                />
              </div>
              <div className="flex justify-between items-center text-xs text-mute pt-1">
                <span>Inspect GCash / Maya reference number & amount</span>
                <button
                  onClick={() => setSelectedReceipt(null)}
                  className={`${btnPrimary} text-xs py-1.5 px-4`}
                >
                  Done Reviewing
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Walk-In / Block Court Modal */}
      {showWalkInModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
          <div className="relative max-w-lg w-full rounded-2xl bg-white p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-line">
              <div>
                <h3 className="text-base font-semibold text-ink">
                  {walkInForm.notes.includes("Maintenance") ? "Block Court / Maintenance" : "New Walk-In Reservation"}
                </h3>
                <p className="text-xs text-mute mt-0.5">Directly locks court slots in the club database</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowWalkInModal(false);
                  setWalkInError(null);
                }}
                className="size-7 rounded-full flex items-center justify-center text-xs text-mute hover:bg-zinc-100 hover:text-ink"
              >
                ✕
              </button>
            </div>

            {walkInError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700">
                {walkInError}
              </div>
            )}

            <form onSubmit={handleCreateWalkIn} className="space-y-4">
              {/* Type Switcher */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setWalkInForm((prev) => ({
                      ...prev,
                      name: "Walk-in Guest",
                      notes: "Walk-in counter payment / Cash",
                      totalPrice: 450,
                    }));
                  }}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold transition ${
                    !walkInForm.notes.includes("Maintenance")
                      ? "border-ink bg-ink text-white"
                      : "border-line bg-zinc-50 text-mute hover:text-ink"
                  }`}
                >
                  Player Walk-In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setWalkInForm((prev) => ({
                      ...prev,
                      name: "Club Maintenance / Block",
                      notes: "Internal Court Maintenance Block",
                      totalPrice: 0,
                    }));
                  }}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold transition ${
                    walkInForm.notes.includes("Maintenance")
                      ? "border-ink bg-ink text-white"
                      : "border-line bg-zinc-50 text-mute hover:text-ink"
                  }`}
                >
                  Block Court (Maintenance)
                </button>
              </div>

              {/* Player details */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={label}>Name / Label</label>
                  <input
                    type="text"
                    required
                    className={input}
                    value={walkInForm.name}
                    onChange={(e) => setWalkInForm({ ...walkInForm, name: e.target.value })}
                  />
                </div>
                <div>
                  <label className={label}>Contact Phone</label>
                  <input
                    type="tel"
                    required
                    className={input}
                    value={walkInForm.phone}
                    onChange={(e) => setWalkInForm({ ...walkInForm, phone: e.target.value })}
                  />
                </div>
              </div>

              {/* Date & Court selection */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={label}>Date</label>
                  <input
                    type="date"
                    required
                    className={input}
                    value={walkInForm.date}
                    onChange={(e) => setWalkInForm({ ...walkInForm, date: e.target.value })}
                  />
                </div>
                <div>
                  <label className={label}>Court</label>
                  <select
                    className={input}
                    value={walkInForm.bookingType === "event_buyout" ? "all" : walkInForm.courtId}
                    onChange={(e) => {
                      if (e.target.value === "all") {
                        setWalkInForm({
                          ...walkInForm,
                          bookingType: "event_buyout",
                          courtId: "court-1",
                          totalPrice: 1800 * walkInForm.hours.length,
                        });
                      } else {
                        setWalkInForm({
                          ...walkInForm,
                          bookingType: "single",
                          courtId: e.target.value as CourtId,
                          totalPrice: 450 * walkInForm.hours.length,
                        });
                      }
                    }}
                  >
                    <option value="court-1">Court 1 (Apex)</option>
                    <option value="court-2">Court 2 (Baseline)</option>
                    <option value="court-3">Court 3 (Kitchen)</option>
                    <option value="all">All 3 Courts (Facility Buyout)</option>
                  </select>
                </div>
              </div>

              {/* Time selection */}
              <div>
                <label className={label}>Play Hour(s)</label>
                <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 pt-1">
                  {SLOTS.map((h) => {
                    const isSelected = walkInForm.hours.includes(h);
                    const isBooked = bookings.some(
                      (b) =>
                        b.play_date === walkInForm.date &&
                        b.status !== "cancelled" &&
                        b.start_hour === h &&
                        (walkInForm.bookingType === "event_buyout" ||
                          b.booking_type === "event_buyout" ||
                          b.court_id === walkInForm.courtId)
                    );
                    return (
                      <button
                        key={h}
                        type="button"
                        disabled={isBooked}
                        onClick={() => {
                          if (isBooked) return;
                          const nextHours = isSelected
                            ? walkInForm.hours.filter((x) => x !== h)
                            : [...walkInForm.hours, h].sort((a, b) => a - b);
                          if (nextHours.length === 0) return;
                          const hourlyBase =
                            walkInForm.bookingType === "event_buyout"
                              ? settings.eventHourlyRate
                              : (settings.offPeakHourlyRate ?? 450);
                          setWalkInForm({
                            ...walkInForm,
                            hours: nextHours,
                            totalPrice: hourlyBase * nextHours.length,
                          });
                        }}
                        className={`py-1.5 rounded-lg border text-[11px] font-mono font-medium transition ${
                          isBooked
                            ? "border-dashed border-line bg-zinc-100 text-zinc-300 cursor-not-allowed line-through"
                            : isSelected
                            ? "border-ink bg-ink text-white"
                            : "border-line bg-zinc-50 text-mute hover:border-ink hover:text-ink"
                        }`}
                        title={isBooked ? "Slot already reserved" : ""}
                      >
                        {formatHour(h)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Price & Notes */}
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <label className={label}>Total Amount Charged (₱)</label>
                  <input
                    type="number"
                    min={0}
                    required
                    className={input}
                    value={walkInForm.totalPrice}
                    onChange={(e) =>
                      setWalkInForm({ ...walkInForm, totalPrice: Number(e.target.value) })
                    }
                  />
                </div>
                <div>
                  <label className={label}>Internal Notes</label>
                  <input
                    type="text"
                    className={input}
                    value={walkInForm.notes}
                    onChange={(e) => setWalkInForm({ ...walkInForm, notes: e.target.value })}
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setShowWalkInModal(false)}
                  className="rounded-xl border border-line px-4 py-2 text-xs font-semibold text-ink hover:bg-zinc-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={walkInSubmitting}
                  className={`${btnPrimary} px-5 py-2 text-xs`}
                >
                  {walkInSubmitting ? "Locking Slot…" : "Confirm & Lock Slot"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Decline Reason Dialog */}
      {declineTargetRef && (() => {
        const rows = groupedBookings[declineTargetRef] || [];
        const first = rows[0];
        if (!first) return null;

        const presetReasons = [
          "Payment receipt unverified or unreadable",
          "Incorrect payment amount / reference mismatch",
          "Court slot unavailable / emergency maintenance",
          "Customer requested cancellation",
        ];

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
            <div className="relative max-w-md w-full rounded-2xl bg-white p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-line">
                <div>
                  <h3 className="text-base font-semibold text-rose-700">Decline Reservation</h3>
                  <p className="text-xs text-mute mt-0.5">
                    Reference #{declineTargetRef.slice(0, 8).toUpperCase()} · {first.name}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setDeclineTargetRef(null)}
                  className="size-7 rounded-full flex items-center justify-center text-xs text-mute hover:bg-zinc-100 hover:text-ink"
                >
                  ✕
                </button>
              </div>

              <div className="p-3 bg-zinc-50 rounded-xl border border-line text-xs space-y-1">
                <div className="flex justify-between">
                  <span className="text-mute">Player</span>
                  <span className="font-semibold text-ink">{first.name} ({first.phone})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-mute">Schedule</span>
                  <span className="font-medium text-ink">
                    {formatDateLabel(first.play_date, { month: "short", day: "numeric" })} · {rows.map((r) => formatHour(r.start_hour)).join(", ")}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-mute">Amount</span>
                  <span className="font-mono font-bold text-ink">₱{first.total_price}</span>
                </div>
              </div>

              <div className="space-y-2">
                <label className={label}>Select Decline Reason</label>
                <div className="space-y-1.5">
                  {presetReasons.map((reason) => (
                    <label
                      key={reason}
                      className={`flex items-center gap-2 p-2 rounded-xl border text-xs cursor-pointer transition ${
                        declineReason === reason
                          ? "border-rose-300 bg-rose-50/60 text-rose-950 font-medium"
                          : "border-line bg-white text-ink/80 hover:bg-zinc-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="decline-reason"
                        checked={declineReason === reason}
                        onChange={() => setDeclineReason(reason)}
                        className="accent-rose-600"
                      />
                      <span>{reason}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className={label}>Optional Custom Note</label>
                <input
                  type="text"
                  placeholder="e.g. Please re-upload receipt via email"
                  value={customDeclineNote}
                  onChange={(e) => setCustomDeclineNote(e.target.value)}
                  className={input}
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-3 border-t border-line">
                <button
                  type="button"
                  onClick={() => setDeclineTargetRef(null)}
                  className="rounded-xl border border-line px-4 py-2 text-xs font-semibold text-ink hover:bg-zinc-50"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={declineSubmitting}
                  onClick={handleConfirmDecline}
                  className="rounded-xl bg-rose-600 text-white px-5 py-2 text-xs font-semibold hover:bg-rose-700 transition"
                >
                  {declineSubmitting ? "Declining…" : "Confirm Decline"}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
