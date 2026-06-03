-- ═══════════════════════════════════════════════════════════
-- PadelZero — V5-05 SYNC FINISH_MATCH RPC
-- Aligns the database function with the matchStore.js signature.
-- ═══════════════════════════════════════════════════════════

create or replace function public.finish_match(
    match_id uuid,
    winner_id uuid,
    p1_pts integer,
    p2_pts integer,
    scores jsonb default null
)
returns jsonb
language plpgsql
security definer
as $$
declare
    v_winner_team text;
    v_match record;
    v_elo_gain integer := 25; -- Default fixed gain for now
begin
    -- 1. Fetch match details
    select * into v_match from public.matches where id = match_id;
    if not found then
        raise exception 'Match not found';
    end if;

    -- 2. Determine winner team
    if winner_id = v_match.p1_id or winner_id = v_match.p1b_id then
        v_winner_team := 'team_a';
    elsif winner_id = v_match.p2_id or winner_id = v_match.p2b_id then
        v_winner_team := 'team_b';
    else
        raise exception 'Winner ID does not belong to this match';
    end if;

    -- 3. Update Match Status
    update public.matches
    set 
        finished = true,
        winner_team = v_winner_team,
        sets = coalesce(scores, sets),
        live_state = jsonb_build_object('p1_points', p1_pts, 'p2_points', p2_pts),
        updated_at = now()
    where id = match_id;

    -- 4. Update Profiles (ELO and Stats)
    -- Team A Winners
    if v_winner_team = 'team_a' then
        update public.profiles set 
            elo_rating = elo_rating + v_elo_gain,
            elo_peak = greatest(elo_peak, elo_rating + v_elo_gain),
            matches_played = matches_played + 1,
            matches_won = matches_won + 1
        where id in (v_match.p1_id, v_match.p1b_id);

        update public.profiles set 
            elo_rating = greatest(0, elo_rating - v_elo_gain),
            matches_played = matches_played + 1
        where id in (v_match.p2_id, v_match.p2b_id);
    -- Team B Winners
    else
        update public.profiles set 
            elo_rating = elo_rating + v_elo_gain,
            elo_peak = greatest(elo_peak, elo_rating + v_elo_gain),
            matches_played = matches_played + 1,
            matches_won = matches_won + 1
        where id in (v_match.p2_id, v_match.p2b_id);

        update public.profiles set 
            elo_rating = greatest(0, elo_rating - v_elo_gain),
            matches_played = matches_played + 1
        where id in (v_match.p1_id, v_match.p1b_id);
    end if;

    return jsonb_build_object('success', true, 'winner_team', v_winner_team);
end;
$$;
