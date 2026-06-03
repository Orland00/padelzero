-- ═══════════════════════════════════════════════════════════
-- PadelZero — V5-01 PROFILES RLS POLICIES
-- Adds missing INSERT/UPDATE/SELECT policies so authenticated
-- users can read all profiles and write their own.
-- Run this in Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════

-- Ensure RLS is enabled (idempotent)
alter table public.profiles enable row level security;

-- Drop existing policies if they exist (makes this idempotent)
drop policy if exists "Anyone can read profiles" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

-- SELECT: anyone can read any profile (for rankings, player cards, etc.)
create policy "Anyone can read profiles"
  on public.profiles for select
  using (true);

-- INSERT: users can only create their own profile row (id = auth.uid())
create policy "Users can insert own profile"
  on public.profiles for insert
  with check (id = auth.uid());

-- UPDATE: users can only update their own profile row
create policy "Users can update own profile"
  on public.profiles for update
  using (id = auth.uid())
  with check (id = auth.uid());

