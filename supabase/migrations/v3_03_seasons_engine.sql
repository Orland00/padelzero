-- ═══════════════════════════════════════════════════════════
-- PadelZero — V3-03 SEASONS & REWARDS MIGRATION
-- ═══════════════════════════════════════════════════════════

-- 1. Seasons Table
create table if not exists public.seasons (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  start_date timestamptz not null default now(),
  end_date timestamptz not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 2. Season Participants (snapshots at end of season)
create table if not exists public.season_results (
  id uuid default gen_random_uuid() primary key,
  season_id uuid references public.seasons(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete cascade,
  final_elo integer not null,
  final_rank integer,
  reward_medal_id text, -- e.g. 'season_1_top_10'
  created_at timestamptz default now(),
  unique(season_id, profile_id)
);

-- RLS
alter table public.seasons enable row level security;
alter table public.season_results enable row level security;

create policy "Seasons are viewable by everyone" on public.seasons for select using (true);
create policy "Results are viewable by everyone" on public.season_results for select using (true);

-- Enable Realtime
alter publication supabase_realtime add table seasons;

-- 3. Seed Season 1: Pioneer
-- Duration: 3 months
insert into public.seasons (name, end_date)
values ('Temporada 1: Pioneros', now() + interval '90 days')
on conflict do nothing;
