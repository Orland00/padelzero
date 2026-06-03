-- ═══════════════════════════════════════════════════════════
-- V7-01: Liga Matches (direct recording) + ELO + Pair Stats
-- Already executed
-- ═══════════════════════════════════════════════════════════

-- 1. liga_matches - direct match recording (outside americano/jornada)
CREATE TABLE IF NOT EXISTS public.liga_matches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  liga_id uuid REFERENCES public.ligas(id) ON DELETE CASCADE,
  team_a_player1 uuid REFERENCES public.profiles(id),
  team_a_player2 uuid REFERENCES public.profiles(id),
  team_b_player1 uuid REFERENCES public.profiles(id),
  team_b_player2 uuid REFERENCES public.profiles(id),
  score_team_a int NOT NULL,
  score_team_b int NOT NULL,
  recorded_by uuid REFERENCES public.profiles(id),
  played_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

-- 2. Add elo_rating to liga_standings
ALTER TABLE public.liga_standings ADD COLUMN IF NOT EXISTS elo_rating int DEFAULT 1200;

-- 3. liga_pair_stats - track pair performance
CREATE TABLE IF NOT EXISTS public.liga_pair_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  liga_id uuid REFERENCES public.ligas(id) ON DELETE CASCADE,
  player1_id uuid REFERENCES public.profiles(id),
  player2_id uuid REFERENCES public.profiles(id),
  matches_played int DEFAULT 0,
  matches_won int DEFAULT 0,
  total_score_for int DEFAULT 0,
  total_score_against int DEFAULT 0,
  updated_at timestamptz DEFAULT now(),
  UNIQUE(liga_id, player1_id, player2_id)
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_liga_matches_liga ON public.liga_matches(liga_id);
CREATE INDEX IF NOT EXISTS idx_liga_matches_played_at ON public.liga_matches(played_at DESC);
CREATE INDEX IF NOT EXISTS idx_liga_pair_stats_liga ON public.liga_pair_stats(liga_id);

-- 5. RLS
ALTER TABLE public.liga_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liga_pair_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "liga_matches_select" ON public.liga_matches
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "liga_matches_insert" ON public.liga_matches
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.liga_members
      WHERE liga_members.liga_id = liga_matches.liga_id
      AND liga_members.player_id = auth.uid()
    )
  );

CREATE POLICY "liga_pair_stats_select" ON public.liga_pair_stats
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "liga_pair_stats_insert" ON public.liga_pair_stats
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.liga_members
      WHERE liga_members.liga_id = liga_pair_stats.liga_id
      AND liga_members.player_id = auth.uid()
    )
  );

CREATE POLICY "liga_pair_stats_update" ON public.liga_pair_stats
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.liga_members
      WHERE liga_members.liga_id = liga_pair_stats.liga_id
      AND liga_members.player_id = auth.uid()
    )
  );
