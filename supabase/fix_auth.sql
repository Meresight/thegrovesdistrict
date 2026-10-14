-- FIX AUTH ERROR IN SUPABASE
-- Run this in your Supabase SQL Editor -> New Query -> Run

-- 1. Remove the manually inserted rows from auth.users that had missing GoTrue fields:
DELETE FROM public.profiles WHERE email IN ('admin@grovedistrict.com', 'member@grovedistrict.com');
DELETE FROM public.bookings WHERE email IN ('admin@grovedistrict.com', 'member@grovedistrict.com');
DELETE FROM auth.users WHERE email IN ('admin@grovedistrict.com', 'member@grovedistrict.com');

-- 2. Verify auth schema is clean:
SELECT id, email, created_at FROM auth.users;
