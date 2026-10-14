-- Fix bookings constraint to allow late-night operating hours up to 2:00 AM (start_hour 24 and 25)
-- Run this in your Supabase Dashboard -> SQL Editor -> New Query -> Run

ALTER TABLE public.bookings DROP CONSTRAINT IF EXISTS bookings_start_hour_check;
ALTER TABLE public.bookings ADD CONSTRAINT bookings_start_hour_check CHECK (start_hour BETWEEN 0 AND 25);
