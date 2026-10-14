-- Grove District: Test Users & Admin Seed Script
-- Run this in your Supabase Dashboard -> SQL Editor -> Run

-- 1. Create the Auth Users in Supabase auth.users (if not already existing)
-- NOTE: In Supabase, you can create them via the Authentication -> Users UI, 
-- or run the helper block below to insert them with pre-hashed bcrypt passwords:

DO $$
DECLARE
  v_admin_id uuid := 'a0000000-0000-0000-0000-000000000001';
  v_member_id uuid := 'b0000000-0000-0000-0000-000000000002';
BEGIN
  -- Insert Admin User into auth.users (Password: admin123456)
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@grovedistrict.com') THEN
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      role,
      aud
    ) VALUES (
      v_admin_id,
      '00000000-0000-0000-0000-000000000000',
      'admin@grovedistrict.com',
      crypt('admin123456', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Club Owner"}',
      now(),
      now(),
      'authenticated',
      'authenticated'
    );
  END IF;

  -- Insert Member User into auth.users (Password: member123456)
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'member@grovedistrict.com') THEN
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      role,
      aud
    ) VALUES (
      v_member_id,
      '00000000-0000-0000-0000-000000000000',
      'member@grovedistrict.com',
      crypt('member123456', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{"full_name":"Alex Santos"}',
      now(),
      now(),
      'authenticated',
      'authenticated'
    );
  END IF;
END $$;

-- 2. Populate public.profiles with correct roles
INSERT INTO public.profiles (id, email, full_name, role)
SELECT id, email, (raw_user_meta_data->>'full_name'), 'admin'
FROM auth.users
WHERE email = 'admin@grovedistrict.com'
ON CONFLICT (id) DO UPDATE SET role = 'admin';

INSERT INTO public.profiles (id, email, full_name, role)
SELECT id, email, (raw_user_meta_data->>'full_name'), 'member'
FROM auth.users
WHERE email = 'member@grovedistrict.com'
ON CONFLICT (id) DO UPDATE SET role = 'member';

-- 3. Set the Owner Alert Email in club_settings
UPDATE public.club_settings
SET owner_notification_email = 'admin@grovedistrict.com'
WHERE id = 1;

-- 4. Seed sample test bookings for member@grovedistrict.com so loyalty perks can be verified immediately
INSERT INTO public.bookings (
  booking_ref,
  booking_type,
  court_id,
  play_date,
  start_hour,
  user_id,
  name,
  email,
  phone,
  players,
  total_price,
  status
)
SELECT
  gen_random_uuid(),
  'single',
  'court-1',
  CURRENT_DATE - (i || ' days')::interval,
  18,
  u.id,
  'Alex Santos',
  'member@grovedistrict.com',
  '0917 123 4567',
  4,
  550,
  'confirmed'
FROM auth.users u, generate_series(1, 9) i
WHERE u.email = 'member@grovedistrict.com'
ON CONFLICT DO NOTHING;
