-- ═══════════════════════════════════════════════════════════
-- PadelZero — V3-05 WEEKLY CHALLENGES MIGRATION
-- ═══════════════════════════════════════════════════════════

-- 1. Challenge Definitions
create table if not exists public.weekly_challenges (
  id text primary key, -- e.g. 'weekly_3_matches'
  title text not null,
  description text,
  goal_count integer not null,
  reward_elo integer default 25,
  type text not null, -- 'participation' | 'wins'
  created_at timestamptz default now()
);

-- 2. Player Progress
create table if not exists public.player_challenge_progress (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references public.profiles(id) on delete cascade,
  challenge_id text references public.weekly_challenges(id) on delete cascade,
  current_count integer default 0,
  is_completed boolean default false,
  week_number integer not null default extract(week from now()),
  year_number integer not null default extract(year from now()),
  updated_at timestamptz default now(),
  unique(profile_id, challenge_id, week_number, year_number)
);

-- RLS
alter table public.weekly_challenges enable row level security;
alter table public.player_challenge_progress enable row level security;

create policy "Challenges are viewable by everyone" on public.weekly_challenges for select using (true);
create policy "Progress is viewable by owner" on public.player_challenge_progress for select using (auth.uid() = profile_id);

-- Enable Realtime
alter publication supabase_realtime add table player_challenge_progress;

-- 3. Seed Initial Challenges
insert into public.weekly_challenges (id, title, description, goal_count, reward_elo, type) values
('weekly_participation', 'Jugador Constante', 'Completa 3 partidos esta semana.', 3, 30, 'participation'),
('weekly_wins', 'Ganador Semanal', 'Gana 2 partidos esta semana.', 2, 50, 'wins')
on conflict (id) do update set
  title = excluded.title,
  description = excluded.description,
  goal_count = excluded.goal_count,
  reward_elo = excluded.reward_elo,
  type = excluded.type;
