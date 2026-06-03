-- Atomic server-side liga match recording
-- Moves ELO calculation, match insert, profile updates, standings updates,
-- pair stats, and team stats into a single transactional RPC.
-- Fixes: client-side ELO trust boundary violation + non-atomic writes.

CREATE OR REPLACE FUNCTION record_liga_match(
  p_liga_id uuid,
  p_team_a_player1 uuid,
  p_team_a_player2 uuid,
  p_team_b_player1 uuid,
  p_team_b_player2 uuid,
  p_score_team_a integer,
  p_score_team_b integer,
  p_jornada_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_match_id uuid;
  v_team_a_won boolean;
  v_team_b_won boolean;
  v_is_draw boolean;
  -- ELO variables
  v_elo_a1 integer; v_elo_a2 integer; v_elo_b1 integer; v_elo_b2 integer;
  v_mp_a1 integer; v_mp_a2 integer; v_mp_b1 integer; v_mp_b2 integer;
  v_mw_a1 integer; v_mw_a2 integer; v_mw_b1 integer; v_mw_b2 integer;
  v_team_a_rating numeric; v_team_b_rating numeric;
  v_expected_a numeric; v_expected_b numeric;
  v_k integer;
  v_delta_a1 integer; v_delta_a2 integer; v_delta_b1 integer; v_delta_b2 integer;
  v_new_elo_a1 integer; v_new_elo_a2 integer; v_new_elo_b1 integer; v_new_elo_b2 integer;
  -- Team ELO
  v_team_a_elo integer; v_team_b_elo integer;
  v_team_a_expected numeric; v_team_a_delta integer; v_new_team_a_elo integer;
  v_team_b_delta integer; v_new_team_b_elo integer;
  -- Pair/team stat IDs
  v_pair_a_key text; v_pair_b_key text;
  v_player_ids uuid[];
  v_result jsonb;
BEGIN
  -- Validate caller is a member of the liga
  IF NOT EXISTS (
    SELECT 1 FROM liga_members
    WHERE liga_id = p_liga_id AND player_id = v_user_id
      AND (is_active = true OR status = 'active')
  ) THEN
    RAISE EXCEPTION 'Not an active member of this liga';
  END IF;

  -- Validate scores
  IF p_score_team_a < 0 OR p_score_team_b < 0 THEN
    RAISE EXCEPTION 'Scores must be non-negative';
  END IF;

  v_team_a_won := p_score_team_a > p_score_team_b;
  v_team_b_won := p_score_team_b > p_score_team_a;
  v_is_draw := p_score_team_a = p_score_team_b;
  v_player_ids := ARRAY[p_team_a_player1, p_team_a_player2, p_team_b_player1, p_team_b_player2];

  -- ========== 1. Read current ELO data for all 4 players ==========
  SELECT elo_rating, matches_played, matches_won INTO v_elo_a1, v_mp_a1, v_mw_a1
    FROM profiles WHERE id = p_team_a_player1;
  SELECT elo_rating, matches_played, matches_won INTO v_elo_a2, v_mp_a2, v_mw_a2
    FROM profiles WHERE id = p_team_a_player2;
  SELECT elo_rating, matches_played, matches_won INTO v_elo_b1, v_mp_b1, v_mw_b1
    FROM profiles WHERE id = p_team_b_player1;
  SELECT elo_rating, matches_played, matches_won INTO v_elo_b2, v_mp_b2, v_mw_b2
    FROM profiles WHERE id = p_team_b_player2;

  -- Default to 1200 if NULL
  v_elo_a1 := COALESCE(v_elo_a1, 1200);
  v_elo_a2 := COALESCE(v_elo_a2, 1200);
  v_elo_b1 := COALESCE(v_elo_b1, 1200);
  v_elo_b2 := COALESCE(v_elo_b2, 1200);
  v_mp_a1 := COALESCE(v_mp_a1, 0); v_mp_a2 := COALESCE(v_mp_a2, 0);
  v_mp_b1 := COALESCE(v_mp_b1, 0); v_mp_b2 := COALESCE(v_mp_b2, 0);
  v_mw_a1 := COALESCE(v_mw_a1, 0); v_mw_a2 := COALESCE(v_mw_a2, 0);
  v_mw_b1 := COALESCE(v_mw_b1, 0); v_mw_b2 := COALESCE(v_mw_b2, 0);

  -- ========== 2. Calculate ELO changes ==========
  IF v_is_draw THEN
    v_delta_a1 := 0; v_delta_a2 := 0; v_delta_b1 := 0; v_delta_b2 := 0;
  ELSE
    v_team_a_rating := (v_elo_a1 + v_elo_a2)::numeric / 2;
    v_team_b_rating := (v_elo_b1 + v_elo_b2)::numeric / 2;

    -- Expected scores
    v_expected_a := 1.0 / (1.0 + power(10, (v_team_b_rating - v_team_a_rating) / 400.0));
    v_expected_b := 1.0 - v_expected_a;

    -- K-factors (40 for new players < 20 matches, 32 for established)
    -- Team A player 1
    v_k := CASE WHEN v_mp_a1 < 20 THEN 40 ELSE 32 END;
    v_delta_a1 := round(v_k * (CASE WHEN v_team_a_won THEN 1 ELSE 0 END - v_expected_a));
    -- Team A player 2
    v_k := CASE WHEN v_mp_a2 < 20 THEN 40 ELSE 32 END;
    v_delta_a2 := round(v_k * (CASE WHEN v_team_a_won THEN 1 ELSE 0 END - v_expected_a));
    -- Team B player 1
    v_k := CASE WHEN v_mp_b1 < 20 THEN 40 ELSE 32 END;
    v_delta_b1 := round(v_k * (CASE WHEN v_team_b_won THEN 1 ELSE 0 END - v_expected_b));
    -- Team B player 2
    v_k := CASE WHEN v_mp_b2 < 20 THEN 40 ELSE 32 END;
    v_delta_b2 := round(v_k * (CASE WHEN v_team_b_won THEN 1 ELSE 0 END - v_expected_b));
  END IF;

  v_new_elo_a1 := GREATEST(800, v_elo_a1 + v_delta_a1);
  v_new_elo_a2 := GREATEST(800, v_elo_a2 + v_delta_a2);
  v_new_elo_b1 := GREATEST(800, v_elo_b1 + v_delta_b1);
  v_new_elo_b2 := GREATEST(800, v_elo_b2 + v_delta_b2);

  -- ========== 3. Insert match with stored deltas ==========
  INSERT INTO liga_matches (
    liga_id,
    team_a_player1, team_a_player2, team_b_player1, team_b_player2,
    team_a_player1_id, team_a_player2_id, team_b_player1_id, team_b_player2_id,
    score_team_a, score_team_b,
    recorded_by, jornada_id,
    elo_delta_a1, elo_delta_a2, elo_delta_b1, elo_delta_b2
  ) VALUES (
    p_liga_id,
    p_team_a_player1, p_team_a_player2, p_team_b_player1, p_team_b_player2,
    p_team_a_player1, p_team_a_player2, p_team_b_player1, p_team_b_player2,
    p_score_team_a, p_score_team_b,
    v_user_id, p_jornada_id,
    v_delta_a1, v_delta_a2, v_delta_b1, v_delta_b2
  ) RETURNING id INTO v_match_id;

  -- ========== 4. Update profiles (ELO, matches_played, matches_won, elo_peak) ==========
  UPDATE profiles SET
    elo_rating = v_new_elo_a1,
    elo_peak = GREATEST(COALESCE(elo_peak, 1200), v_new_elo_a1),
    matches_played = v_mp_a1 + 1,
    matches_won = v_mw_a1 + CASE WHEN v_team_a_won THEN 1 ELSE 0 END
  WHERE id = p_team_a_player1;

  UPDATE profiles SET
    elo_rating = v_new_elo_a2,
    elo_peak = GREATEST(COALESCE(elo_peak, 1200), v_new_elo_a2),
    matches_played = v_mp_a2 + 1,
    matches_won = v_mw_a2 + CASE WHEN v_team_a_won THEN 1 ELSE 0 END
  WHERE id = p_team_a_player2;

  UPDATE profiles SET
    elo_rating = v_new_elo_b1,
    elo_peak = GREATEST(COALESCE(elo_peak, 1200), v_new_elo_b1),
    matches_played = v_mp_b1 + 1,
    matches_won = v_mw_b1 + CASE WHEN v_team_b_won THEN 1 ELSE 0 END
  WHERE id = p_team_b_player1;

  UPDATE profiles SET
    elo_rating = v_new_elo_b2,
    elo_peak = GREATEST(COALESCE(elo_peak, 1200), v_new_elo_b2),
    matches_played = v_mp_b2 + 1,
    matches_won = v_mw_b2 + CASE WHEN v_team_b_won THEN 1 ELSE 0 END
  WHERE id = p_team_b_player2;

  -- ========== 5. Upsert liga_standings for all 4 players ==========
  INSERT INTO liga_standings (liga_id, player_id, total_points, matches_played, matches_won, matches_lost, elo_rating, period_elo_delta, period_points_delta)
  VALUES
    (p_liga_id, p_team_a_player1, CASE WHEN v_team_a_won THEN 3 ELSE 0 END, 1, CASE WHEN v_team_a_won THEN 1 ELSE 0 END, CASE WHEN v_team_a_won THEN 0 ELSE 1 END, v_new_elo_a1, v_delta_a1, CASE WHEN v_team_a_won THEN 3 ELSE 0 END),
    (p_liga_id, p_team_a_player2, CASE WHEN v_team_a_won THEN 3 ELSE 0 END, 1, CASE WHEN v_team_a_won THEN 1 ELSE 0 END, CASE WHEN v_team_a_won THEN 0 ELSE 1 END, v_new_elo_a2, v_delta_a2, CASE WHEN v_team_a_won THEN 3 ELSE 0 END),
    (p_liga_id, p_team_b_player1, CASE WHEN v_team_b_won THEN 3 ELSE 0 END, 1, CASE WHEN v_team_b_won THEN 1 ELSE 0 END, CASE WHEN v_team_b_won THEN 0 ELSE 1 END, v_new_elo_b1, v_delta_b1, CASE WHEN v_team_b_won THEN 3 ELSE 0 END),
    (p_liga_id, p_team_b_player2, CASE WHEN v_team_b_won THEN 3 ELSE 0 END, 1, CASE WHEN v_team_b_won THEN 1 ELSE 0 END, CASE WHEN v_team_b_won THEN 0 ELSE 1 END, v_new_elo_b2, v_delta_b2, CASE WHEN v_team_b_won THEN 3 ELSE 0 END)
  ON CONFLICT (liga_id, player_id) DO UPDATE SET
    total_points = liga_standings.total_points + EXCLUDED.total_points,
    matches_played = liga_standings.matches_played + 1,
    matches_won = liga_standings.matches_won + EXCLUDED.matches_won,
    matches_lost = liga_standings.matches_lost + EXCLUDED.matches_lost,
    elo_rating = EXCLUDED.elo_rating,
    period_elo_delta = COALESCE(liga_standings.period_elo_delta, 0) + EXCLUDED.period_elo_delta,
    period_points_delta = COALESCE(liga_standings.period_points_delta, 0) + EXCLUDED.period_points_delta,
    updated_at = now();

  -- ========== 6. Upsert pair stats for both teams ==========
  -- Team A pair
  INSERT INTO liga_pair_stats (liga_id, player1_id, player2_id, matches_played, matches_won, total_score_for, total_score_against)
  VALUES (
    p_liga_id,
    LEAST(p_team_a_player1, p_team_a_player2),
    GREATEST(p_team_a_player1, p_team_a_player2),
    1, CASE WHEN v_team_a_won THEN 1 ELSE 0 END, p_score_team_a, p_score_team_b
  )
  ON CONFLICT (liga_id, player1_id, player2_id) DO UPDATE SET
    matches_played = liga_pair_stats.matches_played + 1,
    matches_won = liga_pair_stats.matches_won + EXCLUDED.matches_won,
    total_score_for = liga_pair_stats.total_score_for + EXCLUDED.total_score_for,
    total_score_against = liga_pair_stats.total_score_against + EXCLUDED.total_score_against,
    updated_at = now();

  -- Team B pair
  INSERT INTO liga_pair_stats (liga_id, player1_id, player2_id, matches_played, matches_won, total_score_for, total_score_against)
  VALUES (
    p_liga_id,
    LEAST(p_team_b_player1, p_team_b_player2),
    GREATEST(p_team_b_player1, p_team_b_player2),
    1, CASE WHEN v_team_b_won THEN 1 ELSE 0 END, p_score_team_b, p_score_team_a
  )
  ON CONFLICT (liga_id, player1_id, player2_id) DO UPDATE SET
    matches_played = liga_pair_stats.matches_played + 1,
    matches_won = liga_pair_stats.matches_won + EXCLUDED.matches_won,
    total_score_for = liga_pair_stats.total_score_for + EXCLUDED.total_score_for,
    total_score_against = liga_pair_stats.total_score_against + EXCLUDED.total_score_against,
    updated_at = now();

  -- ========== 7. Upsert team stats (with team ELO) ==========
  -- Read existing team ELOs
  SELECT COALESCE(team_elo, 1200) INTO v_team_a_elo FROM liga_team_stats
    WHERE liga_id = p_liga_id
      AND player1_id = LEAST(p_team_a_player1, p_team_a_player2)
      AND player2_id = GREATEST(p_team_a_player1, p_team_a_player2);
  v_team_a_elo := COALESCE(v_team_a_elo, 1200);

  SELECT COALESCE(team_elo, 1200) INTO v_team_b_elo FROM liga_team_stats
    WHERE liga_id = p_liga_id
      AND player1_id = LEAST(p_team_b_player1, p_team_b_player2)
      AND player2_id = GREATEST(p_team_b_player1, p_team_b_player2);
  v_team_b_elo := COALESCE(v_team_b_elo, 1200);

  -- Calculate team ELO deltas
  v_team_a_expected := 1.0 / (1.0 + power(10, (v_team_b_elo - v_team_a_elo)::numeric / 400.0));
  v_team_a_delta := round(32 * (CASE WHEN v_team_a_won THEN 1 ELSE 0 END - v_team_a_expected));
  v_new_team_a_elo := GREATEST(100, v_team_a_elo + v_team_a_delta);
  v_team_b_delta := round(32 * (CASE WHEN v_team_b_won THEN 1 ELSE 0 END - (1.0 - v_team_a_expected)));
  v_new_team_b_elo := GREATEST(100, v_team_b_elo + v_team_b_delta);

  -- Team A stats
  INSERT INTO liga_team_stats (liga_id, player1_id, player2_id, team_elo, matches_played, matches_won, matches_lost, period_elo_delta)
  VALUES (
    p_liga_id,
    LEAST(p_team_a_player1, p_team_a_player2),
    GREATEST(p_team_a_player1, p_team_a_player2),
    v_new_team_a_elo, 1,
    CASE WHEN v_team_a_won THEN 1 ELSE 0 END,
    CASE WHEN v_team_a_won THEN 0 ELSE 1 END,
    v_team_a_delta
  )
  ON CONFLICT (liga_id, player1_id, player2_id) DO UPDATE SET
    team_elo = v_new_team_a_elo,
    matches_played = liga_team_stats.matches_played + 1,
    matches_won = liga_team_stats.matches_won + EXCLUDED.matches_won,
    matches_lost = liga_team_stats.matches_lost + EXCLUDED.matches_lost,
    period_elo_delta = COALESCE(liga_team_stats.period_elo_delta, 0) + v_team_a_delta;

  -- Team B stats
  INSERT INTO liga_team_stats (liga_id, player1_id, player2_id, team_elo, matches_played, matches_won, matches_lost, period_elo_delta)
  VALUES (
    p_liga_id,
    LEAST(p_team_b_player1, p_team_b_player2),
    GREATEST(p_team_b_player1, p_team_b_player2),
    v_new_team_b_elo, 1,
    CASE WHEN v_team_b_won THEN 1 ELSE 0 END,
    CASE WHEN v_team_b_won THEN 0 ELSE 1 END,
    v_team_b_delta
  )
  ON CONFLICT (liga_id, player1_id, player2_id) DO UPDATE SET
    team_elo = v_new_team_b_elo,
    matches_played = liga_team_stats.matches_played + 1,
    matches_won = liga_team_stats.matches_won + EXCLUDED.matches_won,
    matches_lost = liga_team_stats.matches_lost + EXCLUDED.matches_lost,
    period_elo_delta = COALESCE(liga_team_stats.period_elo_delta, 0) + v_team_b_delta;

  -- ========== 8. Jornada participants ==========
  IF p_jornada_id IS NOT NULL THEN
    INSERT INTO jornada_participants (jornada_id, player_id, played)
    VALUES
      (p_jornada_id, p_team_a_player1, true),
      (p_jornada_id, p_team_a_player2, true),
      (p_jornada_id, p_team_b_player1, true),
      (p_jornada_id, p_team_b_player2, true)
    ON CONFLICT (jornada_id, player_id) DO UPDATE SET played = true;
  END IF;

  -- ========== 9. Write ELO history ==========
  INSERT INTO elo_history (player_id, match_id, elo_before, elo_after, delta, reason)
  VALUES
    (p_team_a_player1, v_match_id, v_elo_a1, v_new_elo_a1, v_delta_a1, 'liga_match'),
    (p_team_a_player2, v_match_id, v_elo_a2, v_new_elo_a2, v_delta_a2, 'liga_match'),
    (p_team_b_player1, v_match_id, v_elo_b1, v_new_elo_b1, v_delta_b1, 'liga_match'),
    (p_team_b_player2, v_match_id, v_elo_b2, v_new_elo_b2, v_delta_b2, 'liga_match');

  -- ========== 10. Build result ==========
  v_result := jsonb_build_object(
    'match_id', v_match_id,
    'elo_changes', jsonb_build_array(
      jsonb_build_object('playerId', p_team_a_player1, 'oldElo', v_elo_a1, 'newElo', v_new_elo_a1, 'delta', v_delta_a1),
      jsonb_build_object('playerId', p_team_a_player2, 'oldElo', v_elo_a2, 'newElo', v_new_elo_a2, 'delta', v_delta_a2),
      jsonb_build_object('playerId', p_team_b_player1, 'oldElo', v_elo_b1, 'newElo', v_new_elo_b1, 'delta', v_delta_b1),
      jsonb_build_object('playerId', p_team_b_player2, 'oldElo', v_elo_b2, 'newElo', v_new_elo_b2, 'delta', v_delta_b2)
    ),
    'team_elo_changes', jsonb_build_array(
      jsonb_build_object('player1', LEAST(p_team_a_player1, p_team_a_player2), 'player2', GREATEST(p_team_a_player1, p_team_a_player2), 'oldElo', v_team_a_elo, 'newElo', v_new_team_a_elo, 'delta', v_team_a_delta),
      jsonb_build_object('player1', LEAST(p_team_b_player1, p_team_b_player2), 'player2', GREATEST(p_team_b_player1, p_team_b_player2), 'oldElo', v_team_b_elo, 'newElo', v_new_team_b_elo, 'delta', v_team_b_delta)
    )
  );

  RETURN v_result;
END;
$$;

-- Grant execute to authenticated users (RLS is checked inside the function)
GRANT EXECUTE ON FUNCTION record_liga_match TO authenticated;
