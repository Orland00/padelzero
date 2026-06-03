-- ═══════════════════════════════════════════════════════════
-- v15_03 — ATOMIC MATCH CONFIRMATION + ELO UPDATE RPC
-- Replaces the non-atomic finish_match edge function.
-- Known issue from CLAUDE.md: "finish_match edge fn updates 4 players
-- in a non-atomic loop — partial state possible on mid-loop disconnect."
-- This RPC fixes that with a single transaction + row locks.
--
-- ELO params: K=40 (<20 matches), K=32 (>=20 matches), floor=800
-- Matches src/utils/eloEngine.js constants exactly.
-- Updated: 2026-05-07
-- DOWN: DROP FUNCTION IF EXISTS public.confirm_match_and_update_ratings(uuid);
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.confirm_match_and_update_ratings(p_match_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_match           record;
  v_p1_id           uuid;
  v_p2_id           uuid;
  v_p1b_id          uuid;
  v_p2b_id          uuid;
  v_winner_side     text;  -- 'p1' or 'p2'
  v_team_a_avg      numeric;
  v_team_b_avg      numeric;
  v_expected_a      numeric;
  v_expected_b      numeric;
  v_actual_a        numeric;
  v_player          record;
  v_k               integer;
  v_delta           integer;
  v_new_elo         integer;
  v_new_level       numeric(3,2);
  v_team            text;
BEGIN
  -- Lock and fetch match
  SELECT * INTO v_match
  FROM public.matches
  WHERE id = p_match_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Match % not found', p_match_id;
  END IF;

  IF v_match.confirmation_status != 'pending' THEN
    RAISE EXCEPTION 'Match % is not pending (status: %)',
      p_match_id, v_match.confirmation_status;
  END IF;

  -- Resolve player IDs from actual matches schema
  -- Uses p1_id, p1b_id, p2_id, p2b_id columns (per matchStore.js)
  v_p1_id  := v_match.p1_id;
  v_p2_id  := v_match.p2_id;
  v_p1b_id := COALESCE(v_match.p1b_id, v_match.p1_id);
  v_p2b_id := COALESCE(v_match.p2b_id, v_match.p2_id);

  -- Determine winner from winner column
  v_winner_side := CASE
    WHEN v_match.winner = 'team_a' OR v_match.winner = 'p1' THEN 'p1'
    WHEN v_match.winner = 'team_b' OR v_match.winner = 'p2' THEN 'p2'
    ELSE NULL
  END;

  IF v_winner_side IS NULL THEN
    RAISE EXCEPTION 'Match % has no winner set', p_match_id;
  END IF;

  -- Verify opponent confirmation
  IF v_winner_side = 'p1' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.match_confirmations
      WHERE match_id = p_match_id
        AND decision = 'confirm'
        AND player_id IN (v_p2_id, v_p2b_id)
    ) THEN
      RAISE EXCEPTION 'Match % needs confirmation from losing team', p_match_id;
    END IF;
  ELSE
    IF NOT EXISTS (
      SELECT 1 FROM public.match_confirmations
      WHERE match_id = p_match_id
        AND decision = 'confirm'
        AND player_id IN (v_p1_id, v_p1b_id)
    ) THEN
      RAISE EXCEPTION 'Match % needs confirmation from losing team', p_match_id;
    END IF;
  END IF;

  -- Calculate team average ELOs (lock rows)
  SELECT AVG(elo_rating) INTO v_team_a_avg
  FROM public.profiles
  WHERE id IN (v_p1_id, v_p1b_id)
  FOR UPDATE;

  SELECT AVG(elo_rating) INTO v_team_b_avg
  FROM public.profiles
  WHERE id IN (v_p2_id, v_p2b_id)
  FOR UPDATE;

  -- Standard ELO expected score formula
  v_expected_a := 1.0 / (1 + POWER(10, (v_team_b_avg - v_team_a_avg) / 400.0));
  v_expected_b := 1.0 - v_expected_a;
  v_actual_a   := CASE WHEN v_winner_side = 'p1' THEN 1.0 ELSE 0.0 END;

  -- Update each player's ELO atomically
  FOR v_player IN
    SELECT id, elo_rating, level, matches_played
    FROM public.profiles
    WHERE id IN (v_p1_id, v_p1b_id, v_p2_id, v_p2b_id)
  LOOP
    -- K-factor: 40 for new players (<20 matches), 32 for established
    v_k := CASE WHEN v_player.matches_played < 20 THEN 40 ELSE 32 END;

    v_team := CASE
      WHEN v_player.id IN (v_p1_id, v_p1b_id) THEN 'a'
      ELSE 'b'
    END;

    v_delta := ROUND(v_k * (
      CASE WHEN v_team = 'a'
        THEN v_actual_a - v_expected_a
        ELSE (1 - v_actual_a) - v_expected_b
      END
    ));

    -- Apply floor of 800 and ceiling of 3000
    v_new_elo := GREATEST(800, LEAST(3000, v_player.elo_rating + v_delta));

    v_new_level := ROUND(
      GREATEST(0, LEAST(7, (v_new_elo - 800) / 1600.0 * 7))::numeric, 2
    );

    -- Write rating history BEFORE updating profile
    INSERT INTO public.player_rating_history
      (player_id, match_id, elo_before, elo_after, level_before, level_after, delta_elo)
    VALUES
      (v_player.id, p_match_id,
       v_player.elo_rating, v_new_elo,
       v_player.level, v_new_level,
       v_delta);

    -- Update profile (trigger will also recompute level)
    UPDATE public.profiles
    SET
      elo_rating    = v_new_elo,
      matches_played = matches_played + 1,
      matches_won   = matches_won + CASE
        WHEN (v_team = 'a' AND v_winner_side = 'p1')
          OR (v_team = 'b' AND v_winner_side = 'p2')
        THEN 1 ELSE 0
      END,
      updated_at    = now()
    WHERE id = v_player.id;
  END LOOP;

  -- Finalize match
  UPDATE public.matches
  SET
    confirmation_status = 'confirmed',
    confirmed_at        = now()
  WHERE id = p_match_id;

END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.confirm_match_and_update_ratings(uuid)
  TO authenticated;
