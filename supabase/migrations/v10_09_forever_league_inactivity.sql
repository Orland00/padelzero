-- Forever League: -5 points inactivity penalty per week
-- Run this as a Supabase cron job (pg_cron) every Monday at 00:00 UTC
-- Or call it manually via supabase.rpc('apply_forever_league_inactivity')

CREATE OR REPLACE FUNCTION apply_forever_league_inactivity()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_forever_id uuid := '00000000-0000-4000-8000-000000000010';
  v_penalty integer := 5;
  v_one_week_ago timestamptz := NOW() - INTERVAL '7 days';
  v_affected integer := 0;
BEGIN
  -- Find all active Forever League members who did NOT play in the last 7 days
  -- A player "played" if they appear in any liga_match for this liga in the last week
  UPDATE liga_standings
  SET
    total_points = GREATEST(0, total_points - v_penalty),
    period_points_delta = COALESCE(period_points_delta, 0) - v_penalty,
    updated_at = NOW()
  WHERE liga_id = v_forever_id
    AND player_id NOT IN (
      -- Players who played at least one match this week
      SELECT DISTINCT unnest(ARRAY[
        team_a_player1_id, team_a_player2_id,
        team_b_player1_id, team_b_player2_id
      ])
      FROM liga_matches
      WHERE liga_id = v_forever_id
        AND created_at > v_one_week_ago
    );

  GET DIAGNOSTICS v_affected = ROW_COUNT;

  RETURN jsonb_build_object(
    'success', true,
    'players_penalized', v_affected,
    'penalty_points', v_penalty,
    'cutoff_date', v_one_week_ago
  );
END;
$$;

GRANT EXECUTE ON FUNCTION apply_forever_league_inactivity TO authenticated;

-- Optional: set up pg_cron to run every Monday at midnight UTC
-- Uncomment if pg_cron extension is enabled:
-- SELECT cron.schedule(
--   'forever-league-inactivity',
--   '0 0 * * 1',  -- Every Monday at 00:00 UTC
--   $$SELECT apply_forever_league_inactivity()$$
-- );
