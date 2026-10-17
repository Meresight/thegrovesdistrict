/**
 * Central site configuration. Edit here — everything else reads from this file.
 * Values marked TODO are placeholders to replace with real club details.
 */
export const site = {
  name: "Grove District",
  tagline: "Play Good Company",
  descriptor: "Pickleball · Café · Community",
  description:
    "Grove District is an indoor pickleball club with a café and a community built around good company. Book a court, join the club, and come play.",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  // Official club details
  email: "grovedistrictcebu@gmail.com",
  phone: "09509979540",
  address: ["A P Y Cane Inc., Cebu", "Philippines"],
  mapsUrl:
    "https://www.google.com/maps/place/A+P+Y+Cane+Inc./@10.3458459,123.9531052,20z/data=!4m6!3m5!1s0x33a99847272547f1:0xb1e6837e67825353!8m2!3d10.3458956!4d123.953386!16s%2Fg%2F1tjwf8m4?entry=tts&g_ep=EgoyMDI2MTAxMy4wIPu8ASoASAFQAw%3D%3D&skid=659013ef-8ffe-4970-a250-a62a57d4a943",
  mapsEmbedUrl: "https://www.google.com/maps?q=10.3458956,123.953386&z=18&output=embed",
  instagram: "https://instagram.com/grovedistrict",
  // IANA timezone used for "today" and past-slot checks.
  timezone: "Asia/Manila",
  // 24h+ clock. Slots run from 8:00 AM (8) up to 2:00 AM (26).
  hours: { open: 8, close: 26 },
} as const;

export const COURT_IDS = ["court-1", "court-2", "court-3"] as const;
export type CourtId = (typeof COURT_IDS)[number];

export const courts: { id: CourtId; name: string; note: string }[] = [
  { id: "court-1", name: "Court 1", note: "Indoor · Doubles" },
  { id: "court-2", name: "Court 2", note: "Indoor · Doubles" },
  { id: "court-3", name: "Court 3", note: "Indoor · Doubles" },
];

export const booking = {
  /** How many days ahead (including today) can be booked. */
  windowDays: 14,
  /** Max consecutive hours per reservation. */
  maxHours: 8,
  maxPlayers: 8,
  /** Pricing structure: Off-Peak (8am–4pm) = ₱450, Peak (4pm–2am) = ₱550 */
  defaultOffPeakRate: 450,
  defaultPeakRate: 550,
  defaultRegularRate: 550,
  defaultMemberDiscountPercent: 50,
  defaultEventRate: 1800,
  currencySymbol: "₱",
} as const;

export const skillLevels = ["Beginner", "Intermediate", "Advanced", "Not sure yet"] as const;

export const faqs = [
  {
    q: "Do I need to bring my own paddle?",
    a: "Yes, please bring your own paddle. Regulation nets and court balls are set up on all courts.",
  },
  {
    q: "Is parking available on-site?",
    a: "Yes, free parking is available on-site on a first-come, first-served basis.",
  },
  {
    q: "What is the cancellation policy?",
    a: "Strict No-Cancellation Policy: All court bookings are final and non-refundable once verified and confirmed. For emergency rescheduling inquiries, please message club staff directly.",
  },
  {
    q: "I've never played pickleball. Is that okay?",
    a: "Absolutely. Most of our members started from zero. Join an open play or a beginner session and we'll get you rallying in minutes.",
  },
  {
    q: "How does booking work?",
    a: "Pick a date, select your court and hours, review the breakdown, and submit your GCash or Maya payment receipt. We verify your booking promptly.",
  },
  {
    q: "Is there food and drink?",
    a: "Yes, the Courtside Café is located right beside the courts, offering specialty espresso, cold brew, electrolytes, and cold drinks.",
  },
  {
    q: "Can I host a private event or tournament buyout?",
    a: "Yes. You can reserve all 3 courts for corporate events, private tournaments, or celebrations directly through our facility buyout option.",
  },
];

/** Shown only when Supabase isn't configured or the events table is empty. */
export const fallbackEvents = [
  { id: "f1", title: "Open Play Night", description: "Drop in, get matched, play.", level: "All levels", startsLabel: "Every Friday · 7 PM" },
  { id: "f2", title: "Beginner Clinic", description: "Fundamentals with a coach.", level: "Beginner", startsLabel: "Every Saturday · 9 AM" },
  { id: "f3", title: "Sunday Round Robin", description: "Rotating partners, friendly stakes.", level: "Intermediate", startsLabel: "Every Sunday · 4 PM" },
];
