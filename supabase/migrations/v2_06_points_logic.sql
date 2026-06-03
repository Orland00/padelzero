-- ═══════════════════════════════════════════════════════════
-- PadelZero — V2-06 TOURNAMENT POINTS TRIGGER
-- ═══════════════════════════════════════════════════════════

create or replace function public.on_match_finished_update_tournament_points()
returns trigger as $$
declare
  t_match record;
  winner_id uuid;
  loser_id uuid;
begin
  -- Only proceed if the match is finished
  if NEW.status = 'finished' then
    -- 1. Find the tournament match entry for this match_id
    select * into t_match 
    from public.tournament_matches 
    where match_id = NEW.id;

    if t_match.id is not null then
      -- 2. Determine the winner and loser
      if (NEW.p1_score > NEW.p2_score) then
        winner_id := NEW.p1_id;
        loser_id := NEW.p2_id;
      else
        winner_id := NEW.p2_id;
        loser_id := NEW.p1_id;
      end if;

      -- 3. Update Winner Standing (+3 Pts)
      update public.tournament_participants 
      set points = points + 3,
          matches_won = matches_won + 1
      where tournament_id = t_match.tournament_id 
        and player_id = winner_id;

      -- 4. Update Loser Standing (+0 Pts)
      update public.tournament_participants 
      set matches_lost = matches_lost + 1
      where tournament_id = t_match.tournament_id 
        and player_id = loser_id;
    end if;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

-- Trigger
drop trigger if exists on_match_finished_update_tournament_points_trigger on public.matches;
create trigger on_match_finished_update_tournament_points_trigger
after update on public.matches
for each row execute function public.on_match_finished_update_tournament_points();
