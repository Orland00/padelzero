-- ═══════════════════════════════════════════════════════════
-- PadelZero — V3-01 MEDALS & ACHIEVEMENTS MIGRATION
-- ═══════════════════════════════════════════════════════════

-- 1. Medals Master Table
create table if not exists public.medals (
  id text primary key, -- e.g. 'first_win', 'founders_club'
  name text not null,
  description text,
  icon_text text, -- emoji or simple icon
  rarity text not null default 'common', -- 'common', 'rare', 'epic', 'legendary'
  created_at timestamptz default now()
);

-- 2. Profile Medals (Owned)
create table if not exists public.profile_medals (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references public.profiles(id) on delete cascade,
  medal_id text references public.medals(id) on delete cascade,
  awarded_at timestamptz default now(),
  unique(profile_id, medal_id)
);

-- RLS
alter table public.medals enable row level security;
alter table public.profile_medals enable row level security;

create policy "Medals are viewable by everyone" on public.medals for select using (true);
create policy "Profile medals are viewable by everyone" on public.profile_medals for select using (true);

-- Enable Realtime
alter publication supabase_realtime add table profile_medals;

-- 3. Seed Initial Medals
insert into public.medals (id, name, description, icon_text, rarity) values
('first_win', 'Primer Triunfo', 'Ganaste tu primer partido oficial.', '🏸', 'common'),
('ten_matches', 'Veterano', 'Has jugado 10 partidos oficiales.', '🏅', 'rare'),
('local_hero', 'Héroe Local', 'Alcanzaste el Top 3 en tu zona.', '🏠', 'epic'),
('elite_ranking', 'Elite', 'Alcanzaste el Tier Diamante (1800+ ELO).', '💎', 'legendary'),
('founder', 'Fundador', 'Fuiste uno de los primeros jugadores de PadelZero.', '👑', 'legendary')
on conflict (id) do nothing;
