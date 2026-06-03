-- ═══════════════════════════════════════════════════════════
-- PadelZero — V5-02 FULL SCHEMA REPAIR
-- Adds all missing columns and tables required by the frontend.
-- Run this in Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════

-- 1. REPAIR PROFILES
-- Ensure the table exists first (if v5_00 didn't run or failed)
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade
);

-- Add all missing columns to profiles
alter table public.profiles 
  add column if not exists email text unique,
  add column if not exists display_name text,
  add column if not exists username text unique,
  add column if not exists avatar_url text,
  add column if not exists country text default 'México',
  add column if not exists city text default 'Mexico City',
  add column if not exists zone text,
  add column if not exists phone text,
  add column if not exists age integer,
  add column if not exists gender text,
  add column if not exists preferred_position text,
  add column if not exists favorite_club text,
  add column if not exists elo_rating integer default 1200,
  add column if not exists elo_peak integer default 1200,
  add column if not exists matches_played integer default 0,
  add column if not exists matches_won integer default 0,
  add column if not exists win_streak integer default 0,
  add column if not exists best_streak integer default 0,
  add column if not exists current_streak integer default 0, -- Added for streak logic
  add column if not exists is_founder boolean default false,
  add column if not exists is_guest boolean default false,
  add column if not exists level_self integer default 3,
  add column if not exists active_powerup text,
  add column if not exists showcase_medal_ids text[] default '{}',
  add column if not exists availability_days text[] default '{}',
  add column if not exists availability_times text[] default '{}',
  add column if not exists last_title_won_at timestamptz,
  add column if not exists updated_at timestamptz default now(),
  add column if not exists created_at timestamptz default now();

-- 2. REPAIR MATCHES
alter table public.matches
  add column if not exists p1b_id uuid references public.profiles(id),
  add column if not exists p2b_id uuid references public.profiles(id);

-- 3. CREATE MISSING TABLES
create table if not exists public.friendships (
  id uuid primary key default uuid_generate_v4(),
  requester_id uuid references public.profiles(id) on delete cascade,
  addressee_id uuid references public.profiles(id) on delete cascade,
  status text not null default 'pending', -- pending, accepted, rejected
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(requester_id, addressee_id)
);

create table if not exists public.elo_history (
  id uuid primary key default uuid_generate_v4(),
  player_id uuid references public.profiles(id) on delete cascade,
  match_id uuid references public.matches(id) on delete cascade,
  elo_before integer not null,
  elo_after integer not null,
  delta integer not null,
  created_at timestamptz default now()
);

create table if not exists public.seasons (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  start_date timestamptz not null,
  end_date timestamptz not null,
  is_active boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.medals (
  id text primary key, -- e.g. 'founder', 'first_win'
  name text not null,
  description text,
  icon_text text,
  rarity text default 'common', -- common, rare, epic, legendary
  created_at timestamptz default now()
);

create table if not exists public.profile_medals (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid references public.profiles(id) on delete cascade,
  medal_id text references public.medals(id) on delete cascade,
  awarded_at timestamptz default now(),
  unique(profile_id, medal_id)
);

-- 4. ENABLE RLS & POLICIES
alter table public.friendships enable row level security;
alter table public.elo_history enable row level security;
alter table public.seasons enable row level security;
alter table public.medals enable row level security;
alter table public.profile_medals enable row level security;

-- Public read for all these (Basic)
create policy if not exists "Public read friendships" on public.friendships for select using (true);
create policy if not exists "Public read elo_history" on public.elo_history for select using (true);
create policy if not exists "Public read seasons" on public.seasons for select using (true);
create policy if not exists "Public read medals" on public.medals for select using (true);
create policy if not exists "Public read profile_medals" on public.profile_medals for select using (true);

-- Auth write for friendships
create policy if not exists "Users can manage own friendships" on public.friendships
  for all using (auth.uid() = requester_id or auth.uid() = addressee_id);

-- 5. REPAIR RPCs (Simplified example for finish_match)
create or replace function public.finish_match(
  match_id uuid,
  winner_id uuid,
  p1_pts integer,
  p2_pts integer,
  scores jsonb
) returns void as $$
begin
  update public.matches set
    finished = true,
    winner_id = winner_id,
    finished_at = now(),
    sets = scores,
    live_state = jsonb_build_object('p1_points', p1_pts, 'p2_points', p2_pts)
  where id = match_id;
  -- Add ELO update logic here if needed, or trigger
end;
$$ language plpgsql security definer;
