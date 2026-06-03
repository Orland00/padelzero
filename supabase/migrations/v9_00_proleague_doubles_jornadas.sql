-- ═══════════════════════════════════════════════════════════
-- V9-00: PROLEAGUE 2v2 DOUBLES + WEEKLY JORNADAS + TEAM NAMING
-- ═══════════════════════════════════════════════════════════

-- 1. Add team_name to liga_members (each player names their team)
ALTER TABLE public.liga_members
ADD COLUMN IF NOT EXISTS team_name VARCHAR(100) DEFAULT '';

-- 2. Add status column if missing (some members may only have is_active)
ALTER TABLE public.liga_members
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';

-- 3. Add elo_rating to liga_standings if missing
ALTER TABLE public.liga_standings
ADD COLUMN IF NOT EXISTS elo_rating INT DEFAULT 1200;

-- 4. Add penalty_points to liga_standings (tracks accumulated penalties)
ALTER TABLE public.liga_standings
ADD COLUMN IF NOT EXISTS penalty_points INT DEFAULT 0;

-- 5. Add jornada_id to liga_matches (link match to a jornada)
ALTER TABLE public.liga_matches
ADD COLUMN IF NOT EXISTS jornada_id UUID REFERENCES public.jornadas(id) ON DELETE SET NULL;

-- 6. Create jornada_participants table (track who played in each jornada)
CREATE TABLE IF NOT EXISTS public.jornada_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  jornada_id UUID NOT NULL REFERENCES public.jornadas(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  played BOOLEAN DEFAULT false,
  penalty_applied BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(jornada_id, player_id)
);

-- 7. Create liga_team_stats table (track team ELO for pairs)
CREATE TABLE IF NOT EXISTS public.liga_team_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  liga_id UUID NOT NULL REFERENCES public.ligas(id) ON DELETE CASCADE,
  player1_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  player2_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  team_name VARCHAR(100) DEFAULT '',
  team_elo INT DEFAULT 1200,
  matches_played INT DEFAULT 0,
  matches_won INT DEFAULT 0,
  matches_lost INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(liga_id, player1_id, player2_id)
);

-- 8. Indexes
CREATE INDEX IF NOT EXISTS idx_jornada_participants_jornada ON public.jornada_participants(jornada_id);
CREATE INDEX IF NOT EXISTS idx_jornada_participants_player ON public.jornada_participants(player_id);
CREATE INDEX IF NOT EXISTS idx_liga_matches_jornada ON public.liga_matches(jornada_id);
CREATE INDEX IF NOT EXISTS idx_liga_team_stats_liga ON public.liga_team_stats(liga_id);
CREATE INDEX IF NOT EXISTS idx_liga_team_stats_players ON public.liga_team_stats(player1_id, player2_id);

-- 9. RLS for jornada_participants
ALTER TABLE public.jornada_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read jornada participants"
  ON public.jornada_participants FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert jornada participants"
  ON public.jornada_participants FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update jornada participants"
  ON public.jornada_participants FOR UPDATE
  TO authenticated
  USING (true);

-- 10. RLS for liga_team_stats
ALTER TABLE public.liga_team_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read team stats"
  ON public.liga_team_stats FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert team stats"
  ON public.liga_team_stats FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update team stats"
  ON public.liga_team_stats FOR UPDATE
  TO authenticated
  USING (true);

-- 11. Allow players to update ONLY their own team_name in liga_members
-- Drop existing update policy if it exists, then create restricted one
DO $$
BEGIN
  -- Try to drop existing broad update policy
  BEGIN
    DROP POLICY IF EXISTS "Members can update own team name" ON public.liga_members;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
END $$;

CREATE POLICY "Members can update own team name"
  ON public.liga_members FOR UPDATE
  TO authenticated
  USING (player_id = auth.uid())
  WITH CHECK (player_id = auth.uid());

-- 12. Trigger: auto-update updated_at on liga_team_stats
CREATE OR REPLACE FUNCTION update_liga_team_stats_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_liga_team_stats_updated ON public.liga_team_stats;
CREATE TRIGGER trg_liga_team_stats_updated
  BEFORE UPDATE ON public.liga_team_stats
  FOR EACH ROW
  EXECUTE FUNCTION update_liga_team_stats_timestamp();

-- 13. Function: Apply jornada penalties (-5 points for no-shows)
CREATE OR REPLACE FUNCTION apply_jornada_penalties(p_jornada_id UUID)
RETURNS void AS $$
DECLARE
  v_liga_id UUID;
  rec RECORD;
BEGIN
  -- Get the liga_id for this jornada
  SELECT liga_id INTO v_liga_id FROM jornadas WHERE id = p_jornada_id;

  -- For each participant who didn't play
  FOR rec IN
    SELECT jp.player_id
    FROM jornada_participants jp
    WHERE jp.jornada_id = p_jornada_id
      AND jp.played = false
      AND jp.penalty_applied = false
  LOOP
    -- Deduct 5 points from liga_standings
    UPDATE liga_standings
    SET total_points = total_points - 5,
        penalty_points = COALESCE(penalty_points, 0) + 5,
        updated_at = NOW()
    WHERE liga_id = v_liga_id
      AND player_id = rec.player_id;

    -- Mark penalty as applied
    UPDATE jornada_participants
    SET penalty_applied = true
    WHERE jornada_id = p_jornada_id
      AND player_id = rec.player_id;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
