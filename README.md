# Grove District

Minimal, modern site for **Grove District** — Pickleball · Café · Community.

**Stack:** Next.js 15 (App Router) · TypeScript · Tailwind CSS v4 · Supabase (Postgres + RLS) · Upstash Redis (rate limiting) · Vercel

## Features

- Framed-card, hairline-border design inspired by the reference, using the logo's wine / navy / lime palette
- Live court booking (date → court → up to 3 consecutive hours) with double-booking protection at the database level
- Join-the-club applications, contact form, events list managed from Supabase
- SEO: metadata, Open Graph, JSON-LD, `robots.txt`, `sitemap.xml`; Vercel Analytics

## Security & abuse protection

| Layer | What it does |
| --- | --- |
| Edge middleware | Global 60 req/min per IP on `/api/*` |
| Per-route limits | Bookings 5 / 10 min / IP + 6 / day / email · Join 4 / h / IP + 2 / day / email · Contact 4 / h / IP + 5 / day / email · Availability 40 / min |
| Origin check | POSTs must come from the site's own origin (CSRF) |
| Validation | Zod schemas on every payload; 10 KB body cap; JSON only |
| Honeypot | Hidden field silently drops most bots |
| Business rules | Date window, hours range, past slots and contiguity re-checked server-side |
| Supabase RLS | All tables locked; `anon` can only read published `events`. Writes use the service-role key **server-side only** |
| DB constraint | Partial unique index on `(court, date, hour)` stops double bookings under races |
| Headers | CSP, HSTS, X-Frame-Options, Referrer-Policy, Permissions-Policy |

## Setup

```bash
npm install
cp .env.example .env.local   # fill in values
npm run dev
```

1. **Supabase** – create a project, open *SQL Editor*, run [`supabase/schema.sql`](supabase/schema.sql).
   Copy the project URL, anon key and service-role key (*Project Settings → API*) into `.env.local`.
2. **Upstash** – create a Redis database (free tier is fine) and copy the REST URL + token.
   On Vercel you can add it in one click from *Storage / Marketplace → Upstash*.
   Without it the app falls back to an in-memory limiter (OK locally, not reliable on serverless).
3. **Content** – edit [`src/lib/config.ts`](src/lib/config.ts): address, phone, email, Instagram, hours, courts, timezone, FAQs.
   Everything marked `TODO` is a placeholder.

## Deploy to Vercel

1. Push this folder to GitHub and import the repo in Vercel (framework auto-detected).
2. Add the env vars from `.env.example` (Production + Preview). Set `NEXT_PUBLIC_SITE_URL` to your real domain.
3. Deploy. Add your custom domain under *Settings → Domains*.

## Managing data

Use the Supabase **Table Editor**:

- `bookings` – set `status` to `confirmed` / `cancelled` (cancelled slots re-open automatically)
- `member_applications`, `contact_messages` – inbox
- `events` – add rows; only `published = true` and future events show on the site

## Next steps worth considering

- Email/SMS confirmations (e.g. Resend) via a Supabase Database Webhook on `bookings` inserts
- Online payments (Stripe) once pricing is set
- An admin dashboard behind Supabase Auth
- Replace the 3D renders with real photos once the courts are built (the renders are low-res)
