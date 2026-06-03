-- ═══════════════════════════════════════════════════════════
-- PadelZero — V5-00 CREATE PROFILES TABLE
-- This table is used by the frontend (authStore) for user profiles.
-- It unifies user data, ELO, and stats linked to auth.users.
-- ═══════════════════════════════════════════════════════════

-- Create profiles table
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text unique,
  display_name    text,
  avatar_url      text,
  
  -- Location
  country         text default 'México',
  city            text default 'Mexico City',
  zone            text,
  
  -- Padel Info
  phone           text,
  age             integer,
  gender          text,
  preferred_position text,
  favorite_club   text,
  
  -- Stats & ELO (mirrors players logic but for auth-linked profiles)
  elo_rating      integer not null default 1200,
  elo_peak        integer not null default 1200,
  matches_played  integer not null default 0,
  matches_won     integer not null default 0,
  win_streak      integer not null default 0,
  best_streak     integer not null default 0,
  
  -- Flags
  is_founder      boolean not null default false,
  is_guest        boolean not null default false,
  is_verified     boolean not null default false,
  level_self      integer, -- 1-5 scale for self-assessment
  
  -- V3 Power-ups compat
  active_powerup  text,
  showcase_medal_ids text[] default '{}',
  last_title_won_at timestamptz,
  
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Policies (Basic ones, v5_01 adds more but let's include core here)
drop policy if exists "Public profiles are viewable by everyone" on public.profiles;
create policy "Public profiles are viewable by everyone"
  on public.profiles for select
  using (true);

drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- Create index for ELO ranking
create index if not exists idx_profiles_elo_rating on public.profiles(elo_rating desc);

-- Realtime
alter publication supabase_realtime add table public.profiles;
