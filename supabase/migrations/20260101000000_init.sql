-- =============================================================================
-- 7phantom — initial schema
-- -----------------------------------------------------------------------------
-- Apply with:  supabase db push         (hosted)
--              supabase db reset        (local, re-runs every migration)
--
-- Conventions used here (see docs/ARCHITECTURE.md > Database):
--   • Every tenant-owned row carries `user_id uuid references auth.users(id)`.
--   • RLS is ENABLED on every table, with explicit policies per operation.
--   • `(select auth.uid())` is wrapped in a sub-select so Postgres evaluates it
--     once (initplan) instead of once per row — a large perf win on big scans.
--   • Foreign keys get an index; RLS predicates scan better with one.
--   • `updated_at` is maintained by a trigger, never by the client.
--   • `security definer` functions pin `search_path = ''` to avoid hijacking.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. profiles — 1:1 projection of auth.users that the app can read/write
-- -----------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  avatar_url text,
  -- Preferred interface language; mirrors `locales` in src/i18n/config.ts.
  locale text not null default 'en' check (locale in ('en', 'id')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Public profile data for each authenticated user.';

alter table public.profiles enable row level security;

-- A user may read and edit only their own profile. Inserts happen through the
-- auth trigger below (which runs as the table owner), so no insert policy is
-- strictly required — but we allow self-insert to keep local seeding simple.
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  to authenticated
  with check ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- -----------------------------------------------------------------------------
-- 2. notes — example user-owned resource (copy this shape for real features)
-- -----------------------------------------------------------------------------
create table if not exists public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  body text,
  is_pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.notes is 'Example user-owned records; extend or replace per the PRD.';

-- Supports the dashboard listing: newest first, filtered by owner.
create index if not exists notes_user_id_created_at_idx
  on public.notes (user_id, created_at desc);

alter table public.notes enable row level security;

drop policy if exists "notes_select_own" on public.notes;
create policy "notes_select_own"
  on public.notes for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "notes_insert_own" on public.notes;
create policy "notes_insert_own"
  on public.notes for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "notes_update_own" on public.notes;
create policy "notes_update_own"
  on public.notes for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "notes_delete_own" on public.notes;
create policy "notes_delete_own"
  on public.notes for delete
  to authenticated
  using ((select auth.uid()) = user_id);

-- -----------------------------------------------------------------------------
-- 3. Shared helpers
-- -----------------------------------------------------------------------------

-- Keep `updated_at` honest without trusting the client.
create or replace function public.set_updated_at()
  returns trigger
  language plpgsql
  set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists set_notes_updated_at on public.notes;
create trigger set_notes_updated_at
  before update on public.notes
  for each row execute function public.set_updated_at();

-- Create the profile row automatically after sign-up.
-- `security definer` is required to write into public.profiles from the auth
-- schema; an empty `search_path` prevents privilege escalation via shadowing.
create or replace function public.handle_new_user()

  returns trigger
  language plpgsql
  security definer
  set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url, locale)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'full_name', ''),
    nullif(new.raw_user_meta_data ->> 'avatar_url', ''),
    coalesce(nullif(new.raw_user_meta_data ->> 'locale', ''), 'en')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
