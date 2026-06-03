-- ═══════════════════════════════════════════════════════════
-- PadelZero — V2-01 TOURNAMENT ENGINE MIGRATION
-- ═══════════════════════════════════════════════════════════

-- 1. Tournaments Table
create table if not exists public.tournaments (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  type text not null default 'single_elimination', -- 'single_elimination', 'round_robin', 'liguilla'
  status text not null default 'draft', -- 'draft', 'registration', 'active', 'finished'
  start_date timestamptz,
  end_date timestamptz,
  club_id uuid references public.clubs(id),
  max_participants integer default 32,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id)
);

-- 2. Tournament Participants
create table if not exists public.tournament_participants (
  id uuid default gen_random_uuid() primary key,
  tournament_id uuid references public.tournaments(id) on delete cascade,
  player_id uuid references public.profiles(id),
  seed integer, -- Optional seeding rank
  created_at timestamptz default now(),
  unique(tournament_id, player_id)
);

-- 3. Tournament Matches (The Bracket)
create table if not exists public.tournament_matches (
  id uuid default gen_random_uuid() primary key,
  tournament_id uuid references public.tournaments(id) on delete cascade,
  match_id uuid references public.matches(id) on delete set null,
  player1_id uuid references public.profiles(id) on delete set null,
  player2_id uuid references public.profiles(id) on delete set null,
  round integer not null, -- 1 = Final, 2 = Semi, 4 = Quarters, 8 = Round of 16, etc.
  bracket_pos integer not null, -- Sequence within the round
  next_match_id uuid references public.tournament_matches(id), -- For bracket advancement
  created_at timestamptz default now()
);

-- RLS Policies
alter table public.tournaments enable row level security;
alter table public.tournament_participants enable row level security;
alter table public.tournament_matches enable row level security;

-- Everyone can read
create policy "Tournaments are viewable by everyone" on public.tournaments for select using (true);
create policy "Participants are viewable by everyone" on public.tournament_participants for select using (true);
create policy "Tournament matches are viewable by everyone" on public.tournament_matches for select using (true);

-- Only authenticated can register (custom logic can be added later for clubs)
create policy "Authenticated can register for tournaments" on public.tournament_participants for insert with check (auth.uid() = player_id);

-- Enable Realtime
alter publication supabase_realtime add table tournaments;
alter publication supabase_realtime add table tournament_participants;
alter publication supabase_realtime add table tournament_matches;
