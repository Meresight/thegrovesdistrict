-- Grove District — Supabase schema
-- Run in: Supabase Dashboard -> SQL Editor -> New query.

create extension if not exists "pgcrypto";

-- ---------- Club Dynamic Settings (Owner editable from /admin) ----------
create table if not exists public.club_settings (
  id                      int primary key default 1 check (id = 1),
  regular_hourly_rate     numeric not null default 500,
  member_discount_percent int not null default 50,
  event_hourly_rate       numeric not null default 1800,
  currency_symbol         text not null default '₱',
  payment_account_name    text not null default 'Grove District',
  payment_account_number  text not null default '0912 345 6789 (GCash / Bank)',
  payment_qr_url          text default '/images/logo-mark.png',
  waiver_text             text not null default 'By booking a court at Grove District, I agree to the facility rules and release Grove District and its staff from any liability for accidental injury or property loss during play.',
  owner_notification_email text default 'owner@grovedistrict.com',
  updated_at              timestamptz not null default now()
);

-- Insert default single-row settings if not exists
insert into public.club_settings (id)
values (1)
on conflict (id) do nothing;

-- ---------- User Profiles / Membership ----------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  email      text not null,
  full_name  text,
  phone      text,
  role       text not null default 'member' check (role in ('member', 'admin')),
  created_at timestamptz not null default now()
);

-- ---------- Bookings (one row per reserved court-hour) ----------
create table if not exists public.bookings (
  id                  uuid primary key default gen_random_uuid(),
  booking_ref         uuid        not null,
  booking_type        text        not null default 'single' check (booking_type in ('single', 'event_buyout')),
  court_id            text        not null check (court_id in ('court-1','court-2','court-3')),
  play_date           date        not null,
  start_hour          smallint    not null check (start_hour between 0 and 25),
  user_id             uuid        references auth.users(id) on delete set null,
  name                text        not null check (char_length(name) between 2 and 80),
  email               text        not null check (char_length(email) <= 120),
  phone               text        not null check (char_length(phone) <= 20),
  players             smallint    not null check (players between 1 and 30),
  notes               text        check (char_length(notes) <= 300),
  total_price         numeric     not null default 0,
  discount_applied    numeric     not null default 0,
  receipt_url         text,
  waiver_agreed       boolean     not null default true,
  status              text        not null default 'pending_review' check (status in ('pending_review','confirmed','cancelled')),
  created_at          timestamptz not null default now()
);

-- Prevents double-booking even under concurrent requests. Cancelled slots free up automatically.
create unique index if not exists bookings_no_double_book
  on public.bookings (court_id, play_date, start_hour)
  where status <> 'cancelled';

create index if not exists bookings_date_idx on public.bookings (play_date);
create index if not exists bookings_ref_idx on public.bookings (booking_ref);

-- ---------- Member applications ----------
create table if not exists public.member_applications (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 2 and 80),
  email      text not null unique check (char_length(email) <= 120),
  phone      text check (char_length(phone) <= 20),
  level      text not null check (level in ('Beginner','Intermediate','Advanced','Not sure yet')),
  message    text check (char_length(message) <= 500),
  status     text not null default 'new' check (status in ('new','contacted','member')),
  created_at timestamptz not null default now()
);

-- ---------- Contact messages ----------
create table if not exists public.contact_messages (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 2 and 80),
  email      text not null check (char_length(email) <= 120),
  message    text not null check (char_length(message) between 5 and 1000),
  created_at timestamptz not null default now()
);

-- ---------- Events (managed from the Supabase table editor or admin) ----------
create table if not exists public.events (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,
  description text,
  level       text not null default 'All levels',
  starts_at   timestamptz not null,
  published   boolean not null default true,
  created_at  timestamptz not null default now()
);

create index if not exists events_starts_idx on public.events (starts_at) where published;

-- ---------- Row Level Security ----------
alter table public.club_settings       enable row level security;
alter table public.profiles            enable row level security;
alter table public.bookings            enable row level security;
alter table public.member_applications enable row level security;
alter table public.contact_messages    enable row level security;
alter table public.events              enable row level security;

-- Public read for club settings
drop policy if exists "Public can read club settings" on public.club_settings;
create policy "Public can read club settings"
  on public.club_settings for select
  to anon, authenticated
  using (true);

-- Public read for published events
drop policy if exists "Public can read published events" on public.events;
create policy "Public can read published events"
  on public.events for select
  to anon, authenticated
  using (published = true);

-- Authenticated users can read their own profile
drop policy if exists "Users can read own profile" on public.profiles;
create policy "Users can read own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

-- Storage bucket for receipts
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', true)
on conflict (id) do nothing;

drop policy if exists "Anyone can upload receipts" on storage.objects;
create policy "Anyone can upload receipts"
  on storage.objects for insert
  to anon, authenticated
  with check (bucket_id = 'receipts');

drop policy if exists "Anyone can read receipts" on storage.objects;
create policy "Anyone can read receipts"
  on storage.objects for select
  to anon, authenticated
  using (bucket_id = 'receipts');

-- Optional initial events
insert into public.events (title, description, level, starts_at)
select * from (values
  ('Open Play Night',     'Drop in, get matched, play.',          'All levels',   now() + interval '3 days'),
  ('Beginner Clinic',     'Fundamentals with a coach.',           'Beginner',     now() + interval '6 days'),
  ('Sunday Round Robin',  'Rotating partners, friendly stakes.',  'Intermediate', now() + interval '9 days')
) as v(title, description, level, starts_at)
where not exists (select 1 from public.events);
