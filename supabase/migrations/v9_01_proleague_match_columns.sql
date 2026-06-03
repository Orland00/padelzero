-- ═══════════════════════════════════════════════════════════
-- V9-01: ADD PROLEAGUE 2V2 COLUMNS TO LIGA_MATCHES
-- ═══════════════════════════════════════════════════════════

-- 1. Add 2v2 player columns to liga_matches
ALTER TABLE public.liga_matches
ADD COLUMN IF NOT EXISTS team_a_player1_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.liga_matches
ADD COLUMN IF NOT EXISTS team_a_player2_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.liga_matches
ADD COLUMN IF NOT EXISTS team_b_player1_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.liga_matches
ADD COLUMN IF NOT EXISTS team_b_player2_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

-- 2. Add score columns for 2v2 matches
ALTER TABLE public.liga_matches
ADD COLUMN IF NOT EXISTS score_team_a INT DEFAULT 0;

ALTER TABLE public.liga_matches
ADD COLUMN IF NOT EXISTS score_team_b INT DEFAULT 0;

-- 3. Add recorded_by to track who recorded the match
ALTER TABLE public.liga_matches
ADD COLUMN IF NOT EXISTS recorded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL;

-- 4. Add played_at timestamp for match time
ALTER TABLE public.liga_matches
ADD COLUMN IF NOT EXISTS played_at TIMESTAMPTZ DEFAULT NOW();

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_liga_matches_team_a_p1 ON public.liga_matches(team_a_player1_id);
CREATE INDEX IF NOT EXISTS idx_liga_matches_team_a_p2 ON public.liga_matches(team_a_player2_id);
CREATE INDEX IF NOT EXISTS idx_liga_matches_team_b_p1 ON public.liga_matches(team_b_player1_id);
CREATE INDEX IF NOT EXISTS idx_liga_matches_team_b_p2 ON public.liga_matches(team_b_player2_id);
CREATE INDEX IF NOT EXISTS idx_liga_matches_jornada ON public.liga_matches(jornada_id);
CREATE INDEX IF NOT EXISTS idx_liga_matches_recorded_by ON public.liga_matches(recorded_by);

-- 6. Update RLS for liga_matches to allow ProLeague match inserts
-- Players in a liga can insert matches for that liga
DROP POLICY IF EXISTS "Authenticated users can insert matches" ON public.liga_matches;
CREATE POLICY "Authenticated users can insert matches"
  ON public.liga_matches FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM liga_members
      WHERE liga_id = liga_matches.liga_id
      AND player_id = auth.uid()
    )
  );
