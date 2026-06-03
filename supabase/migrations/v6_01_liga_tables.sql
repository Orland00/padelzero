-- ═══════════════════════════════════════════════════════════
-- LIGA PROLEAGUE — V6-01 ALL LIGA TABLES
-- Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

-- 1. ligas
CREATE TABLE IF NOT EXISTS public.ligas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  format text NOT NULL DEFAULT 'americano',
  description text,
  created_by uuid REFERENCES public.profiles(id),
  schedule jsonb,
  points_per_win int DEFAULT 3,
  points_per_draw int DEFAULT 1,
  points_per_loss int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 2. liga_members
CREATE TABLE IF NOT EXISTS public.liga_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  liga_id uuid REFERENCES public.ligas(id) ON DELETE CASCADE,
  player_id uuid REFERENCES public.profiles(id),
  role text DEFAULT 'player',
  joined_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true,
  UNIQUE(liga_id, player_id)
);

-- 3. jornadas
CREATE TABLE IF NOT EXISTS public.jornadas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  liga_id uuid REFERENCES public.ligas(id) ON DELETE CASCADE,
  jornada_number int NOT NULL,
  date date NOT NULL,
  status text DEFAULT 'upcoming',
  created_by uuid REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  completed_at timestamptz,
  UNIQUE(liga_id, jornada_number)
);

-- 4. jornada_checkins
CREATE TABLE IF NOT EXISTS public.jornada_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jornada_id uuid REFERENCES public.jornadas(id) ON DELETE CASCADE,
  player_id uuid REFERENCES public.profiles(id),
  checked_in_at timestamptz DEFAULT now(),
  UNIQUE(jornada_id, player_id)
);

-- 5. americano_rounds
CREATE TABLE IF NOT EXISTS public.americano_rounds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  jornada_id uuid REFERENCES public.jornadas(id) ON DELETE CASCADE,
  round_number int NOT NULL,
  status text DEFAULT 'pending',
  created_at timestamptz DEFAULT now(),
  UNIQUE(jornada_id, round_number)
);

-- 6. americano_matches
CREATE TABLE IF NOT EXISTS public.americano_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid REFERENCES public.americano_rounds(id) ON DELETE CASCADE,
  court_number int NOT NULL,
  team_a_player1 uuid REFERENCES public.profiles(id),
  team_a_player2 uuid REFERENCES public.profiles(id),
  team_b_player1 uuid REFERENCES public.profiles(id),
  team_b_player2 uuid REFERENCES public.profiles(id),
  score_team_a int,
  score_team_b int,
  status text DEFAULT 'pending',
  bye_player uuid REFERENCES public.profiles(id),
  completed_at timestamptz
);

-- 7. liga_standings
CREATE TABLE IF NOT EXISTS public.liga_standings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  liga_id uuid REFERENCES public.ligas(id) ON DELETE CASCADE,
  player_id uuid REFERENCES public.profiles(id),
  total_points int DEFAULT 0,
  matches_played int DEFAULT 0,
  matches_won int DEFAULT 0,
  matches_lost int DEFAULT 0,
  jornadas_attended int DEFAULT 0,
  current_streak int DEFAULT 0,
  best_streak int DEFAULT 0,
  has_crown boolean DEFAULT false,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(liga_id, player_id)
);

-- 8. crown_history
CREATE TABLE IF NOT EXISTS public.crown_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  liga_id uuid REFERENCES public.ligas(id),
  player_id uuid REFERENCES public.profiles(id),
  dethroned_id uuid REFERENCES public.profiles(id),
  jornada_id uuid REFERENCES public.jornadas(id),
  crowned_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_liga_members_liga ON public.liga_members(liga_id);
CREATE INDEX IF NOT EXISTS idx_liga_members_player ON public.liga_members(player_id);
CREATE INDEX IF NOT EXISTS idx_jornadas_liga ON public.jornadas(liga_id);
CREATE INDEX IF NOT EXISTS idx_jornada_checkins_jornada ON public.jornada_checkins(jornada_id);
CREATE INDEX IF NOT EXISTS idx_americano_rounds_jornada ON public.americano_rounds(jornada_id);
CREATE INDEX IF NOT EXISTS idx_americano_matches_round ON public.americano_matches(round_id);
CREATE INDEX IF NOT EXISTS idx_liga_standings_liga ON public.liga_standings(liga_id);
CREATE INDEX IF NOT EXISTS idx_liga_standings_points ON public.liga_standings(total_points DESC);
CREATE INDEX IF NOT EXISTS idx_crown_history_liga ON public.crown_history(liga_id);
