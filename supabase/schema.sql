-- ═══════════════════════════════════════════════════════════
-- PadelZero — MASTER SCHEMA v1.0
-- Run ONCE in Supabase SQL Editor
-- All future features are pre-columns (nullable) — no ALTER TABLE ever
-- ═══════════════════════════════════════════════════════════

create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- ───────────────────────────────────────────────────────────
-- COUNTRIES & STATES
-- ───────────────────────────────────────────────────────────
create table public.countries (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null unique,
  code        text not null unique,            -- MX, US, ES
  flag        text,                             -- emoji flag
  active      boolean not null default true,
  created_at  timestamptz default now()
);

create table public.states (
  id          uuid primary key default uuid_generate_v4(),
  country_id  uuid references public.countries(id) on delete cascade,
  name        text not null,
  code        text,                             -- YUC, CDMX
  active      boolean not null default true,
  created_at  timestamptz default now(),
  unique(country_id, name)
);

create table public.cities (
  id          uuid primary key default uuid_generate_v4(),
  state_id    uuid references public.states(id) on delete cascade,
  name        text not null,
  active      boolean not null default true,
  created_at  timestamptz default now(),
  unique(state_id, name)
);

-- ───────────────────────────────────────────────────────────
-- CLUBS (V2 — courts, location, contact)
-- ───────────────────────────────────────────────────────────
create table public.clubs (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  slug            text unique,                  -- mexico_city-padel-club
  country_id      uuid references public.countries(id),
  state_id        uuid references public.states(id),
  city_id         uuid references public.cities(id),
  address         text,
  lat             numeric,
  lng             numeric,
  phone           text,
  email           text,
  website         text,
  instagram       text,
  courts_count    integer default 0,
  verified        boolean default false,
  active          boolean default true,
  logo_url        text,
  cover_url       text,
  -- monetization
  is_sponsor      boolean default false,
  sponsor_tier    text,                         -- bronze, silver, gold
  sponsor_until   timestamptz,
  -- owner
  owner_user_id   uuid references auth.users(id),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ───────────────────────────────────────────────────────────
-- PLAYERS
-- ───────────────────────────────────────────────────────────
create table public.players (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid references auth.users(id) on delete cascade,

  -- identity
  nombre          text not null,
  apellido        text,
  username        text unique,                  -- @handle
  avatar_url      text,
  bio             text,

  -- location
  country_id      uuid references public.countries(id),
  state_id        uuid references public.states(id),
  city_id         uuid references public.cities(id),
  home_club_id    uuid references public.clubs(id),

  -- ELO & stats
  elo             integer not null default 1000,
  elo_peak        integer not null default 1000,
  wins            integer not null default 0,
  losses          integer not null default 0,
  draws           integer not null default 0,
  matches_played  integer not null default 0,
  sets_won        integer not null default 0,
  sets_lost       integer not null default 0,
  games_won       integer not null default 0,
  games_lost      integer not null default 0,
  win_streak      integer not null default 0,
  best_streak     integer not null default 0,

  -- categories
  categoria       text default 'libre',         -- libre, amateur, semi-pro, pro
  sexo            text,                          -- M, F, X
  hand            text,                          -- right, left, both
  position        text,                          -- drive, reves, both

  -- flags
  is_founder      boolean not null default false,
  is_guest        boolean not null default false,
  is_verified     boolean not null default false,
  is_banned       boolean not null default false,
  is_public       boolean not null default true,

  -- V3 power-ups
  active_powerup  text,                          -- fire, lightning, confetti...
  powerups_owned  text[] default '{}',
  powerup_color   text,                          -- custom accent color

  -- socials
  instagram       text,
  phone           text,

  -- metadata
  last_seen_at    timestamptz,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ───────────────────────────────────────────────────────────
-- PROFILES (V5 — Unified User Identity)
-- ───────────────────────────────────────────────────────────
create table public.profiles (
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
  
  -- Stats & ELO
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
  level_self      integer,
  
  -- V3 Power-ups compat
  active_powerup  text,
  showcase_medal_ids text[] default '{}',
  last_title_won_at timestamptz,
  
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table public.profiles enable row level security;
create policy "public read profiles" on public.profiles for select using (true);
create policy "own profile insert"   on public.profiles for insert with check (auth.uid() = id);
create policy "own profile update"   on public.profiles for update using (auth.uid() = id);

create index idx_profiles_elo_rating on public.profiles(elo_rating desc);
alter publication supabase_realtime add table public.profiles;

-- ───────────────────────────────────────────────────────────
-- TEAMS (for doubles/team tournaments)
-- ───────────────────────────────────────────────────────────
create table public.teams (
  id              uuid primary key default uuid_generate_v4(),
  name            text,
  player1_id      uuid references public.players(id) on delete cascade,
  player2_id      uuid references public.players(id) on delete cascade,
  elo             integer not null default 1000,
  wins            integer not null default 0,
  losses          integer not null default 0,
  active          boolean default true,
  created_at      timestamptz default now()
);

-- ───────────────────────────────────────────────────────────
-- TOURNAMENTS
-- ───────────────────────────────────────────────────────────
create table public.tournaments (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  slug            text,

  -- type
  tipo            text not null default 'friendly',  -- friendly, oficial, club, national
  formato         text not null default 'singles',   -- singles, doubles, teams
  bracket_type    text not null default 'single_elimination', -- single_elimination, double_elimination, round_robin

  -- players / teams
  players         uuid[] default '{}',          -- player IDs for singles
  teams           uuid[] default '{}',          -- team IDs for doubles
  bracket         jsonb default '[]',
  max_players     integer,
  min_players     integer default 2,

  -- location
  country_id      uuid references public.countries(id),
  state_id        uuid references public.states(id),
  city_id         uuid references public.cities(id),
  club_id         uuid references public.clubs(id),
  venue           text,

  -- schedule
  starts_at       timestamptz,
  ends_at         timestamptz,
  registration_deadline timestamptz,

  -- results
  champion_id     uuid references public.players(id),
  champion_team_id uuid references public.teams(id),
  runner_up_id    uuid references public.players(id),
  status          text not null default 'draft',  -- draft, open, active, finished, cancelled

  -- prizes
  prize_description text,
  prize_amount    numeric,
  prize_currency  text default 'MXN',

  -- meta
  description     text,
  rules           text,
  cover_url       text,
  is_public       boolean default true,
  requires_approval boolean default false,
  created_by      uuid references auth.users(id),
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- Tournament registrations
create table public.tournament_registrations (
  id              uuid primary key default uuid_generate_v4(),
  tournament_id   uuid references public.tournaments(id) on delete cascade,
  player_id       uuid references public.players(id) on delete cascade,
  team_id         uuid references public.teams(id),
  status          text default 'pending',       -- pending, approved, rejected, withdrawn
  seed            integer,
  registered_at   timestamptz default now(),
  unique(tournament_id, player_id)
);

-- ───────────────────────────────────────────────────────────
-- MATCHES
-- ───────────────────────────────────────────────────────────
create table public.matches (
  id              uuid primary key default uuid_generate_v4(),
  tournament_id   uuid references public.tournaments(id) on delete set null,

  -- participants — supports singles AND doubles
  p1_id           uuid references public.players(id),   -- singles P1
  p2_id           uuid references public.players(id),   -- singles P2
  team1_id        uuid references public.teams(id),     -- doubles team1
  team2_id        uuid references public.teams(id),     -- doubles team2

  -- format
  tipo            text not null default 'friendly',     -- friendly, oficial
  formato         text not null default 'singles',
  best_of         integer not null default 1,

  -- live state (Supabase Realtime)
  sets            jsonb not null default '[]',
  live_state      jsonb default '{"points":{"p1":0,"p2":0},"set_idx":0}',

  -- result
  winner_id       uuid references public.players(id),
  winner_team_id  uuid references public.teams(id),
  finished        boolean not null default false,
  walkover        boolean default false,         -- opponent no-show
  retired         boolean default false,         -- mid-match retirement

  -- ELO impact
  elo_applied     boolean default false,
  p1_elo_before   integer,
  p2_elo_before   integer,
  p1_elo_after    integer,
  p2_elo_after    integer,
  p1_elo_delta    integer,
  p2_elo_delta    integer,

  -- location
  club_id         uuid references public.clubs(id),
  court_number    integer,

  -- V3 streaming
  stream_url      text,
  recording_url   text,
  is_streaming    boolean default false,

  -- meta
  notes           text,
  created_by      uuid references auth.users(id),
  created_at      timestamptz default now(),
  finished_at     timestamptz,
  updated_at      timestamptz default now()
);

-- ───────────────────────────────────────────────────────────
-- BUSINESSES (directory)
-- ───────────────────────────────────────────────────────────
create table public.businesses (
  id              uuid primary key default uuid_generate_v4(),
  player_id       uuid references public.players(id) on delete cascade,

  nombre          text not null,
  giro            text,                          -- category
  descripcion     text,
  link            text,
  instagram       text,
  phone           text,
  logo_url        text,

  -- location
  country_id      uuid references public.countries(id),
  state_id        uuid references public.states(id),
  city_id         uuid references public.cities(id),

  -- listing
  activo          boolean not null default true,
  featured        boolean default false,         -- paid featured slot
  expires_at      timestamptz default (now() + interval '20 days'),
  paid_until      timestamptz,                   -- paid extension
  tier            text default 'free',           -- free, basic, premium

  -- stats
  views           integer default 0,
  clicks          integer default 0,

  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ───────────────────────────────────────────────────────────
-- POWER-UPS (V3 store)
-- ───────────────────────────────────────────────────────────
create table public.powerups (
  id              uuid primary key default uuid_generate_v4(),
  slug            text unique not null,          -- fire, lightning, confetti
  name            text not null,
  description     text,
  icon            text,                          -- emoji
  animation_type  text,                          -- particle, screen, sound
  price_mxn       numeric,
  is_exclusive    boolean default false,         -- true = founder-only, never purchasable
  active          boolean default true,
  created_at      timestamptz default now()
);

create table public.player_powerups (
  id              uuid primary key default uuid_generate_v4(),
  player_id       uuid references public.players(id) on delete cascade,
  powerup_id      uuid references public.powerups(id),
  purchased_at    timestamptz default now(),
  price_paid      numeric,
  unique(player_id, powerup_id)
);

-- ───────────────────────────────────────────────────────────
-- ACHIEVEMENTS / BADGES (V3)
-- ───────────────────────────────────────────────────────────
create table public.achievements (
  id              uuid primary key default uuid_generate_v4(),
  slug            text unique not null,
  name            text not null,
  description     text,
  icon            text,
  condition_type  text,                          -- wins, streak, elo, tournaments
  condition_value integer,
  active          boolean default true
);

create table public.player_achievements (
  id              uuid primary key default uuid_generate_v4(),
  player_id       uuid references public.players(id) on delete cascade,
  achievement_id  uuid references public.achievements(id),
  earned_at       timestamptz default now(),
  unique(player_id, achievement_id)
);

-- ───────────────────────────────────────────────────────────
-- NOTIFICATIONS (V2)
-- ───────────────────────────────────────────────────────────
create table public.notifications (
  id              uuid primary key default uuid_generate_v4(),
  player_id       uuid references public.players(id) on delete cascade,
  type            text not null,                 -- match_invite, tournament_start, elo_change
  title           text,
  body            text,
  data            jsonb,
  read            boolean default false,
  created_at      timestamptz default now()
);

-- ───────────────────────────────────────────────────────────
-- ADS / SPONSORS (V2 media kit)
-- ───────────────────────────────────────────────────────────
create table public.ads (
  id              uuid primary key default uuid_generate_v4(),
  business_id     uuid references public.businesses(id) on delete cascade,
  slot            text not null,                 -- banner_top, banner_bottom, splash, interstitial
  image_url       text,
  link            text,
  active          boolean default true,
  starts_at       timestamptz,
  ends_at         timestamptz,
  impressions     integer default 0,
  clicks          integer default 0,
  price_mxn       numeric,
  created_at      timestamptz default now()
);

-- ───────────────────────────────────────────────────────────
-- SEED DATA
-- ───────────────────────────────────────────────────────────
insert into public.countries (name, code, flag) values
  ('México',        'MX', '🇲🇽'),
  ('Estados Unidos','US', '🇺🇸'),
  ('España',        'ES', '🇪🇸'),
  ('Argentina',     'AR', '🇦🇷'),
  ('Colombia',      'CO', '🇨🇴');

insert into public.states (country_id, name, code) values
  ((select id from countries where code='MX'), 'Yucatán',          'YUC'),
  ((select id from countries where code='MX'), 'Ciudad de México',  'CDMX'),
  ((select id from countries where code='MX'), 'Quintana Roo',      'QROO'),
  ((select id from countries where code='MX'), 'Jalisco',           'JAL'),
  ((select id from countries where code='MX'), 'Nuevo León',        'NL');

insert into public.cities (state_id, name) values
  ((select id from states where code='YUC'),  'Mexico City'),
  ((select id from states where code='YUC'),  'Valladolid'),
  ((select id from states where code='CDMX'), 'Ciudad de México'),
  ((select id from states where code='QROO'), 'Cancún'),
  ((select id from states where code='QROO'), 'Playa del Carmen'),
  ((select id from states where code='JAL'),  'Guadalajara'),
  ((select id from states where code='NL'),   'Monterrey');

insert into public.powerups (slug, name, icon, price_mxn, is_exclusive) values
  ('fire',       'Fuego',      '🔥', null,  true),   -- founder only, never for sale
  ('lightning',  'Rayo',       '⚡', 49,    false),
  ('confetti',   'Confetti',   '🎊', 29,    false),
  ('crown',      'Corona',     '👑', 99,    false),
  ('rocket',     'Cohete',     '🚀', 79,    false);

insert into public.achievements (slug, name, icon, condition_type, condition_value) values
  ('first_win',     'Primera victoria', '🏆', 'wins',       1),
  ('ten_wins',      '10 victorias',     '🌟', 'wins',       10),
  ('fifty_wins',    '50 victorias',     '💎', 'wins',       50),
  ('win_streak_5',  'Racha de 5',       '🔥', 'streak',     5),
  ('win_streak_10', 'Racha de 10',      '💥', 'streak',     10),
  ('elo_1200',      'ELO 1200',         '📈', 'elo',        1200),
  ('elo_1500',      'ELO 1500',         '🏅', 'elo',        1500),
  ('tournament_win','Campeón torneo',   '🎖', 'tournaments', 1);

-- ───────────────────────────────────────────────────────────
-- ELO FUNCTIONS
-- ───────────────────────────────────────────────────────────

-- Singles ELO update
create or replace function update_elo(winner_id uuid, loser_id uuid, k_factor integer default 32)
returns void as $$
declare
  w_elo int; l_elo int; exp_w numeric;
  new_w int; new_l int;
begin
  select elo into w_elo from players where id = winner_id;
  select elo into l_elo from players where id = loser_id;
  exp_w := 1.0 / (1.0 + power(10.0, (l_elo - w_elo) / 400.0));
  new_w := w_elo + round(k_factor * (1 - exp_w));
  new_l := l_elo + round(k_factor * (0 - exp_w));
  update players set
    elo = new_w,
    elo_peak = greatest(elo_peak, new_w),
    wins = wins + 1,
    matches_played = matches_played + 1,
    win_streak = win_streak + 1,
    best_streak = greatest(best_streak, win_streak + 1),
    updated_at = now()
  where id = winner_id;
  update players set
    elo = new_l,
    losses = losses + 1,
    matches_played = matches_played + 1,
    win_streak = 0,
    updated_at = now()
  where id = loser_id;
  -- update match elo columns
  update matches set
    elo_applied = true,
    p1_elo_before = w_elo, p1_elo_after = new_w, p1_elo_delta = new_w - w_elo,
    p2_elo_before = l_elo, p2_elo_after = new_l, p2_elo_delta = new_l - l_elo
  where id = (
    select id from matches
    where ((p1_id = winner_id and p2_id = loser_id) or (p1_id = loser_id and p2_id = winner_id))
    and finished = true and elo_applied = false
    order by finished_at desc limit 1
  );
end;
$$ language plpgsql security definer;

-- Team ELO update
create or replace function update_team_elo(winner_team_id uuid, loser_team_id uuid, k_factor integer default 32)
returns void as $$
declare
  w_elo int; l_elo int; exp_w numeric;
  new_w int; new_l int;
  p1w uuid; p2w uuid; p1l uuid; p2l uuid;
begin
  select elo, player1_id, player2_id into w_elo, p1w, p2w from teams where id = winner_team_id;
  select elo, player1_id, player2_id into l_elo, p1l, p2l from teams where id = loser_team_id;
  exp_w := 1.0 / (1.0 + power(10.0, (l_elo - w_elo) / 400.0));
  new_w := w_elo + round(k_factor * (1 - exp_w));
  new_l := l_elo + round(k_factor * (0 - exp_w));
  -- update team elo
  update teams set elo = new_w, wins = wins + 1 where id = winner_team_id;
  update teams set elo = new_l, losses = losses + 1 where id = loser_team_id;
  -- update individual players (half k-factor for team matches)
  perform update_elo(p1w, p1l, k_factor / 2);
  perform update_elo(p2w, p2l, k_factor / 2);
end;
$$ language plpgsql security definer;

-- Public stats function
create or replace function get_public_stats()
returns json as $$
declare result json;
begin
  select json_build_object(
    'players',     (select count(*) from players where is_banned = false),
    'matches',     (select count(*) from matches where finished = true),
    'tournaments', (select count(*) from tournaments),
    'businesses',  (select count(*) from businesses where activo = true and expires_at > now()),
    'countries',   (select count(*) from countries where active = true),
    'clubs',       (select count(*) from clubs where active = true)
  ) into result;
  return result;
end;
$$ language plpgsql security definer;

-- ───────────────────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ───────────────────────────────────────────────────────────
alter table public.countries             enable row level security;
alter table public.states                enable row level security;
alter table public.cities                enable row level security;
alter table public.clubs                 enable row level security;
alter table public.players               enable row level security;
alter table public.teams                 enable row level security;
alter table public.tournaments           enable row level security;
alter table public.tournament_registrations enable row level security;
alter table public.matches               enable row level security;
alter table public.businesses            enable row level security;
alter table public.powerups              enable row level security;
alter table public.player_powerups       enable row level security;
alter table public.achievements          enable row level security;
alter table public.player_achievements   enable row level security;
alter table public.notifications         enable row level security;
alter table public.ads                   enable row level security;

-- Public read everything
create policy "public read countries"      on public.countries      for select using (true);
create policy "public read states"         on public.states         for select using (true);
create policy "public read cities"         on public.cities         for select using (true);
create policy "public read clubs"          on public.clubs          for select using (active = true);
create policy "public read players"        on public.players        for select using (is_banned = false);
create policy "public read teams"          on public.teams          for select using (active = true);
create policy "public read tournaments"    on public.tournaments    for select using (is_public = true);
create policy "public read t_reg"          on public.tournament_registrations for select using (true);
create policy "public read matches"        on public.matches        for select using (true);
create policy "public read businesses"     on public.businesses     for select using (activo = true);
create policy "public read powerups"       on public.powerups       for select using (active = true);
create policy "public read achievements"   on public.achievements   for select using (active = true);
create policy "public read p_achievements" on public.player_achievements for select using (true);
create policy "public read p_powerups"     on public.player_powerups    for select using (true);

-- Players — own profile
create policy "insert own player"   on public.players for insert with check (auth.uid() = user_id);
create policy "update own player"   on public.players for update using (auth.uid() = user_id);

-- Matches — authenticated create/update
create policy "auth create match"   on public.matches for insert with check (auth.uid() is not null);
create policy "auth update match"   on public.matches for update using (auth.uid() is not null);

-- Tournaments — authenticated create/update
create policy "auth create tournament"  on public.tournaments for insert with check (auth.uid() is not null);
create policy "auth update tournament"  on public.tournaments for update using (auth.uid() = created_by);

-- Tournament registrations
create policy "auth register tournament" on public.tournament_registrations for insert with check (auth.uid() is not null);
create policy "auth update t_reg"        on public.tournament_registrations for update using (auth.uid() is not null);

-- Businesses — own
create policy "own business insert" on public.businesses for insert
  with check (auth.uid() = (select user_id from players where id = player_id));
create policy "own business update" on public.businesses for update
  using (auth.uid() = (select user_id from players where id = player_id));

-- Notifications — own only
create policy "own notifications" on public.notifications for select using (
  auth.uid() = (select user_id from players where id = player_id)
);
create policy "own notifications update" on public.notifications for update using (
  auth.uid() = (select user_id from players where id = player_id)
);

-- Player powerups — own
create policy "own powerups select" on public.player_powerups for select using (true);
create policy "own powerups insert" on public.player_powerups for insert with check (
  auth.uid() = (select user_id from players where id = player_id)
);

-- Clubs — owner manage
create policy "owner manage club" on public.clubs for insert with check (auth.uid() = owner_user_id);
create policy "owner update club" on public.clubs for update using (auth.uid() = owner_user_id);

-- Ads — via business ownership
create policy "own ads select" on public.ads for select using (active = true);

-- Countries/States/Cities — founder only write (via is_founder check)
create policy "founder insert country" on public.countries for insert
  with check (exists (select 1 from players where user_id = auth.uid() and is_founder = true));
create policy "founder insert state" on public.states for insert
  with check (exists (select 1 from players where user_id = auth.uid() and is_founder = true));
create policy "founder insert city" on public.cities for insert
  with check (exists (select 1 from players where user_id = auth.uid() and is_founder = true));

-- ───────────────────────────────────────────────────────────
-- INDEXES — performance at scale
-- ───────────────────────────────────────────────────────────
create index idx_players_elo          on public.players(elo desc);
create index idx_players_user_id      on public.players(user_id);
create index idx_players_city         on public.players(city_id);
create index idx_players_country      on public.players(country_id);
create index idx_players_username     on public.players(username) where username is not null;
create index idx_matches_created      on public.matches(created_at desc);
create index idx_matches_finished     on public.matches(finished, finished_at desc);
create index idx_matches_live         on public.matches(finished) where finished = false;
create index idx_matches_tournament   on public.matches(tournament_id);
create index idx_tournaments_status   on public.tournaments(status);
create index idx_tournaments_city     on public.tournaments(city_id);
create index idx_businesses_active    on public.businesses(activo, expires_at);
create index idx_t_reg_tournament     on public.tournament_registrations(tournament_id);
create index idx_notifications_player on public.notifications(player_id, read);
create index idx_states_country       on public.states(country_id);
create index idx_cities_state         on public.cities(state_id);
create index idx_teams_p1             on public.teams(player1_id);
create index idx_teams_p2             on public.teams(player2_id);

-- ───────────────────────────────────────────────────────────
-- REALTIME — enable change streams
-- ───────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.players;
alter publication supabase_realtime add table public.matches;
alter publication supabase_realtime add table public.tournaments;
alter publication supabase_realtime add table public.businesses;
