-- ═══════════════════════════════════════════════════════════
-- PadelZero — V3-05 CHALLENGE PROGRESS LOGIC
-- ═══════════════════════════════════════════════════════════

create or replace function public.update_challenge_progress(
  p_id uuid,
  c_type text
)
returns void as $$
declare
  c_rec record;
  current_week integer := extract(week from now());
  current_year integer := extract(year from now());
  p_prog_id uuid;
  p_current integer;
  p_completed boolean;
begin
  -- For each challenge of this type
  for c_rec in select * from public.weekly_challenges where type = c_type loop
    
    -- Get or create progress record
    select id, current_count, is_completed into p_prog_id, p_current, p_completed
    from public.player_challenge_progress
    where profile_id = p_id 
      and challenge_id = c_rec.id
      and week_number = current_week
      and year_number = current_year;

    if p_prog_id is null then
      insert into public.player_challenge_progress (profile_id, challenge_id, week_number, year_number, current_count)
      values (p_id, c_rec.id, current_week, current_year, 1)
      returning id, current_count, is_completed into p_prog_id, p_current, p_completed;
    else
      if not p_completed then
        update public.player_challenge_progress
        set current_count = current_count + 1,
            updated_at = now()
        where id = p_prog_id
        returning current_count into p_current;
      end if;
    end if;

    -- Check completion
    if not p_completed and p_current >= c_rec.goal_count then
      update public.player_challenge_progress
      set is_completed = true
      where id = p_prog_id;

      -- Grant Reward ELO
      update public.profiles
      set elo_rating = elo_rating + c_rec.reward_elo,
          updated_at = now()
      where id = p_id;

      -- Log in history
      insert into public.elo_history (player_id, delta, reason)
      values (p_id, c_rec.reward_elo, 'challenge');
    end if;

  end loop;
end;
$$ language plpgsql security definer;
