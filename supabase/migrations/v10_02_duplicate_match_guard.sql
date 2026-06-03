-- ═══════════════════════════════════════════════════════════
-- PadelZero — V10-02 DUPLICATE MATCH GUARD
-- Prevents recording identical matches within 5 minutes
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION check_duplicate_liga_match()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM liga_matches
    WHERE liga_id = NEW.liga_id
      AND team_a_player1 = NEW.team_a_player1
      AND team_a_player2 = NEW.team_a_player2
      AND team_b_player1 = NEW.team_b_player1
      AND team_b_player2 = NEW.team_b_player2
      AND score_team_a = NEW.score_team_a
      AND score_team_b = NEW.score_team_b
      AND created_at > NOW() - INTERVAL '5 minutes'
      AND id != NEW.id
  ) THEN
    RAISE EXCEPTION 'DUPLICATE_MATCH: Identical match recorded within 5 minutes';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop if exists to avoid errors on re-run
DROP TRIGGER IF EXISTS prevent_duplicate_liga_match ON liga_matches;

CREATE TRIGGER prevent_duplicate_liga_match
  BEFORE INSERT ON liga_matches
  FOR EACH ROW EXECUTE FUNCTION check_duplicate_liga_match();
