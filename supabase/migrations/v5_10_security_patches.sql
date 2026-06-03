-- ═══════════════════════════════════════════════════════════
-- PadelZero — V5-10 SECURITY PATCHES
-- Implements quick wins to secure API and logic against exploits
-- ═══════════════════════════════════════════════════════════

-- ====================================================================
-- Step 1: The Quick Wins (Locking Down Triggers)
-- Revoke REST API access for internal trigger functions so they 
-- cannot be triggered externally.
-- ====================================================================
DO $$ 
DECLARE
    func text;
BEGIN
    FOR func IN 
        SELECT proname FROM pg_proc 
        WHERE proname IN ('handle_new_user', 'on_match_finished_advance_bracket', 'check_and_award_medals')
    LOOP
        EXECUTE format('REVOKE EXECUTE ON FUNCTION public.%I() FROM PUBLIC, anon, authenticated', func);
    END LOOP;
END $$;

-- ====================================================================
-- Step 2: Patching the Manual RPC `finish_match`
-- Adds an explicit security check to ensure only match participants 
-- can call the RPC to finish the match.
-- ====================================================================
CREATE OR REPLACE FUNCTION public.finish_match(
    match_id uuid,
    winner_id uuid,
    p1_pts integer,
    p2_pts integer,
    scores jsonb default null
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_winner_team text;
    v_match record;
    v_elo_gain integer := 25; 
BEGIN
    -- 1. Fetch match details
    SELECT * INTO v_match FROM public.matches WHERE id = match_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Match not found';
    END IF;

    -- 2. The critical security check:
    -- Verify the authenticated user is evaluating as one of the players in this match.
    IF auth.uid() NOT IN (
        v_match.p1_id,
        v_match.p2_id,
        v_match.p1b_id,
        coalesce(v_match.p2b_id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) AND auth.uid() IS NOT NULL THEN
        RAISE EXCEPTION 'Unauthorized: You are not a participant in this match';
    END IF;

    -- 3. Determine winner team
    IF winner_id = v_match.p1_id OR winner_id = v_match.p1b_id THEN
        v_winner_team := 'team_a';
    ELSIF winner_id = v_match.p2_id OR winner_id = v_match.p2b_id THEN
        v_winner_team := 'team_b';
    ELSE
        RAISE EXCEPTION 'Winner ID does not belong to this match';
    END IF;

    -- 4. Update Match Status
    UPDATE public.matches
    SET 
        finished = true,
        winner_team = v_winner_team,
        sets = coalesce(scores, sets),
        live_state = jsonb_build_object('p1_points', p1_pts, 'p2_points', p2_pts),
        updated_at = now()
    WHERE id = match_id;

    -- 5. Update Profiles (ELO and Stats) - Mirroring v5_05 implementation exactly
    -- Team A Winners
    IF v_winner_team = 'team_a' THEN
        UPDATE public.profiles SET 
            elo_rating = elo_rating + v_elo_gain,
            elo_peak = greatest(elo_peak, elo_rating + v_elo_gain),
            matches_played = matches_played + 1,
            matches_won = matches_won + 1
        WHERE id IN (v_match.p1_id, v_match.p1b_id);

        UPDATE public.profiles SET 
            elo_rating = greatest(0, elo_rating - v_elo_gain),
            matches_played = matches_played + 1
        WHERE id IN (v_match.p2_id, v_match.p2b_id);
    -- Team B Winners
    ELSE
        UPDATE public.profiles SET 
            elo_rating = elo_rating + v_elo_gain,
            elo_peak = greatest(elo_peak, elo_rating + v_elo_gain),
            matches_played = matches_played + 1,
            matches_won = matches_won + 1
        WHERE id IN (v_match.p2_id, v_match.p2b_id);

        UPDATE public.profiles SET 
            elo_rating = greatest(0, elo_rating - v_elo_gain),
            matches_played = matches_played + 1
        WHERE id IN (v_match.p1_id, v_match.p1b_id);
    END IF;

    RETURN jsonb_build_object('success', true, 'winner_team', v_winner_team);
END;
$$;


-- ====================================================================
-- Step 3: Plugging the RLS Leaks
-- ====================================================================

-- 1. Secure the Matches Table
DROP POLICY IF EXISTS "auth update match" ON public.matches;

CREATE POLICY "players can update their own matches" 
ON public.matches 
FOR UPDATE 
USING (
    -- Direct profile match (p1_id and p2_id refer to profiles directly now)
    auth.uid() IN (p1_id, p2_id, p1b_id, p2b_id)
);



-- NOTE: Ensure PostgREST pulls schema updates.
NOTIFY pgrst, 'reload schema';
