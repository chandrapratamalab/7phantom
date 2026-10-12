-- =============================================================================
-- Seed data — LOCAL DEVELOPMENT ONLY
-- -----------------------------------------------------------------------------
-- Runs automatically after `npm run db:local:reset` (see `[db.seed]` in
-- `supabase/config.toml`). It is never applied to the linked hosted project.
--
-- Demo account (sign in at /en/login):
--   email:    demo@example.com
--   password: password123
--
-- The script is idempotent — it uses fixed ids and `on conflict do nothing`, so
-- running it again is safe.
-- =============================================================================

begin;

-- -----------------------------------------------------------------------------
-- 1. Demo user
-- -----------------------------------------------------------------------------
-- Inserting straight into auth.users requires two things, or sign-in breaks:
--   • the token columns below MUST be '' and not NULL — they have no default, and
--     GoTrue scans them as `string`, so a NULL makes password login return
--     HTTP 500 (`converting NULL to string is unsupported`);
--   • the companion auth.identities row in step 2.
-- The `on_auth_user_created` trigger creates the matching public.profiles row.
-- The password is stored as a bcrypt hash via pgcrypto, exactly like GoTrue.
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  confirmation_token,
  recovery_token,
  email_change,
  email_change_token_new,
  email_change_token_current,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  '00000000-0000-0000-0000-000000000000',
  '00000000-0000-0000-0000-000000000001',
  'authenticated',
  'authenticated',
  'demo@example.com',
  crypt('password123', gen_salt('bf')),
  now(),
  '',
  '',
  '',
  '',
  '',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"Demo User","locale":"en"}'::jsonb,
  now(),
  now()
)
on conflict (id) do nothing;

-- -----------------------------------------------------------------------------
-- 2. Email/password identity (required for signInWithPassword)
-- -----------------------------------------------------------------------------
insert into auth.identities (
  id,
  provider_id,
  user_id,
  identity_data,
  provider,
  last_sign_in_at,
  created_at,
  updated_at
)
values (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000001',
  '{"sub":"00000000-0000-0000-0000-000000000001","email":"demo@example.com","email_verified":true,"phone_verified":false}'::jsonb,
  'email',
  now(),
  now(),
  now()
)
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- 3. Profile
-- -----------------------------------------------------------------------------
-- Created by the step-1 trigger; set name/locale deterministically in case the
-- row already existed.
update public.profiles
set full_name = 'Demo User',
    locale = 'en'
where id = '00000000-0000-0000-0000-000000000001';

-- -----------------------------------------------------------------------------
-- 4. Example notes (the dashboard lists these newest-first)
-- -----------------------------------------------------------------------------
insert into public.notes (id, user_id, title, body, is_pinned)
values
  (
    '11111111-1111-1111-1111-111111111111',
    '00000000-0000-0000-0000-000000000001',
    'Welcome to 7phantom',
    'This row was created by supabase/seed.sql. Edit or delete it freely.',
    true
  ),
  (
    '22222222-2222-2222-2222-222222222222',
    '00000000-0000-0000-0000-000000000001',
    'Try the API',
    'Call GET /api/me with an "Authorization: Bearer <access_token>" header to see a server-verified response.',
    false
  )
on conflict (id) do nothing;

commit;
