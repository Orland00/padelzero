-- ═══════════════════════════════════════════════════════════
-- PadelZero — V3-05 ELO ENGINE UPGRADE (CHALLENGES)
-- ═══════════════════════════════════════════════════════════

create or replace function update_match_elo(
  winner_ids   uuid[],
  loser_ids    uuid[],
  match_id     uuid default null
)
returns void
language plpgsql
security definer
as $$
declare
  w_avg_elo    numeric := 0;
  l_avg_elo    numeric := 0;
  w_k_avg      numeric := 0;
  l_k_avg      numeric := 0;
  exp_w        numeric;
  total_delta  integer;
  pid          uuid;
  p_elo        integer;
  p_played     integer;
  p_streak     integer;
  p_multiplier numeric;
  new_elo      integer;
  final_delta  integer;
begin
  -- 1. Calculate Winner Team Avg ELO and Avg K
  foreach pid in array winner_ids loop
    if pid is not null then
      select elo_rating, matches_played into p_elo, p_played from public.profiles where id = pid;
      w_avg_elo := w_avg_elo + p_elo;
      w_k_avg   := w_k_avg + (case when p_played < 20 then 32 else 16 end);
    end if;
  end loop;
  w_avg_elo := w_avg_elo / array_length(array_remove(winner_ids, null), 1);
  w_k_avg   := w_k_avg / array_length(array_remove(winner_ids, null), 1);

  -- 2. Calculate Loser Team Avg ELO and Avg K
  foreach pid in array loser_ids loop
    if pid is not null then
      select elo_rating, matches_played into p_elo, p_played from public.profiles where id = pid;
      l_avg_elo := l_avg_elo + p_elo;
      l_k_avg   := l_k_avg + (case when p_played < 20 then 32 else 16 end);
    end if;
  end loop;
  l_avg_elo := l_avg_elo / array_length(array_remove(loser_ids, null), 1);
  l_k_avg   := l_k_avg / array_length(array_remove(loser_ids, null), 1);

  -- 3. Expected score for winner
  exp_w := 1.0 / (1.0 + power(10.0, (l_avg_elo - w_avg_elo) / 400.0));
  total_delta := round(((w_k_avg + l_k_avg) / 2.0) * (1.0 - exp_w));

  -- 4. Apply to Winners
  foreach pid in array winner_ids loop
    if pid is not null then
      select elo_rating, current_streak into p_elo, p_streak from public.profiles where id = pid;
      
      -- Calculate Streak Multiplier (V3-02)
      p_multiplier := 1.0;
      if p_streak >= 4 then p_multiplier := 1.5;
      elsif p_streak >= 2 then p_multiplier := 1.2;
      end if;

      final_delta := round(total_delta * p_multiplier);
      new_elo := greatest(800, p_elo + final_delta);
      
      update public.profiles set
        elo_rating = new_elo,
        elo_peak = greatest(coalesce(elo_peak, 1200), new_elo),
        matches_played = matches_played + 1,
        matches_won = matches_won + 1,
        current_streak = current_streak + 1,
        max_streak = greatest(max_streak, current_streak + 1),
        last_match_at = now(),
        updated_at = now()
      where id = pid;

      insert into public.elo_history (player_id, match_id, elo_before, elo_after, delta, reason)
      values (pid, match_id, p_elo, new_elo, final_delta, 'match');

      -- [NEW] Update Challenges (Participation + Wins)
      perform public.update_challenge_progress(pid, 'participation');
      perform public.update_challenge_progress(pid, 'wins');
    end if;
  end loop;

  -- 5. Apply to Losers
  total_delta := round(((w_k_avg + l_k_avg) / 2.0) * (0 - exp_w));
  foreach pid in array loser_ids loop
    if pid is not null then
      select elo_rating into p_elo from public.profiles where id = pid;
      new_elo := greatest(800, p_elo + total_delta);
      final_delta := new_elo - p_elo;

      update public.profiles set
        elo_rating = new_elo,
        matches_played = matches_played + 1,
        current_streak = 0, -- RESET STREAK
        last_match_at = now(),
        updated_at = now()
      where id = pid;

      insert into public.elo_history (player_id, match_id, elo_before, elo_after, delta, reason)
      values (pid, match_id, p_elo, new_elo, final_delta, 'match');

      -- [NEW] Update Challenges (Participation Only)
      perform public.update_challenge_progress(pid, 'participation');
    end if;
  end loop;
end;
$$;
