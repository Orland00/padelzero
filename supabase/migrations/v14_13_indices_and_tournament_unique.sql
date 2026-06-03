-- ═══════════════════════════════════════════════════════════
-- v14_13 — H6+H7 missing indices + H8 tournament_participants unique
-- ═══════════════════════════════════════════════════════════
-- 03_architecture_audit.md:
--   H6 matches: only PK index → seq scan on any filter
--   H7 session_matches/session_teams: only PK indices
--   H8 tournament_participants: no UNIQUE on (tournament_id, p1_id) →
--       same player can register twice (verified zero current dupes)

BEGIN;

-- H6: matches table — filterable by participants, club, finished status, time
CREATE INDEX IF NOT EXISTS idx_matches_p1_id ON public.matches(p1_id) WHERE p1_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_matches_p2_id ON public.matches(p2_id) WHERE p2_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_matches_club_id ON public.matches(club_id) WHERE club_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_matches_finished_created ON public.matches(finished, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_matches_winner_id ON public.matches(winner_id) WHERE winner_id IS NOT NULL;

-- H7: session_matches — FK'd columns for joins
CREATE INDEX IF NOT EXISTS idx_session_matches_session_id ON public.session_matches(session_id);
CREATE INDEX IF NOT EXISTS idx_session_matches_status ON public.session_matches(status) WHERE status IS NOT NULL;

-- H7: session_teams — session_id for joins; (p1_id,p2_id) for lookup
CREATE INDEX IF NOT EXISTS idx_session_teams_session_id ON public.session_teams(session_id);
CREATE INDEX IF NOT EXISTS idx_session_teams_p1_id ON public.session_teams(p1_id) WHERE p1_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_session_teams_p2_id ON public.session_teams(p2_id) WHERE p2_id IS NOT NULL;

-- H8: tournament_participants — prevent same player registering twice for one tournament
-- Partial unique: p1_id is NOT NULL per schema; p2_id nullable so separate partial
ALTER TABLE public.tournament_participants
  ADD CONSTRAINT tournament_participants_unique_p1
  UNIQUE (tournament_id, p1_id);

-- For doubles, also prevent same p2 from registering twice in same tournament
CREATE UNIQUE INDEX IF NOT EXISTS idx_tournament_participants_unique_p2
  ON public.tournament_participants(tournament_id, p2_id)
  WHERE p2_id IS NOT NULL;

COMMIT;

-- Rollback:
--   DROP INDEX IF EXISTS idx_matches_p1_id, idx_matches_p2_id, idx_matches_club_id,
--     idx_matches_finished_created, idx_matches_winner_id,
--     idx_session_matches_session_id, idx_session_matches_status,
--     idx_session_teams_session_id, idx_session_teams_p1_id, idx_session_teams_p2_id,
--     idx_tournament_participants_unique_p2;
--   ALTER TABLE public.tournament_participants DROP CONSTRAINT tournament_participants_unique_p1;
