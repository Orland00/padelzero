-- ═══════════════════════════════════════════════════════════
-- PadelZero — V2-01 TOURNAMENT ADVANCEMENT TRIGGER
-- ═══════════════════════════════════════════════════════════

create or replace function public.on_match_finished_advance_bracket()
returns trigger as $$
declare
  t_match record;
  n_match record;
  winner_id uuid;
begin
  -- Only proceed if the match is finished
  if NEW.status = 'finished' then
    -- 1. Find the tournament match entry for this match_id
    select * into t_match 
    from public.tournament_matches 
    where match_id = NEW.id;

    if t_match.id is not null and t_match.next_match_id is not null then
      -- 2. Determine the winner
      -- In Padel, team 1 wins if p1_score > p2_score
      if (NEW.p1_score > NEW.p2_score) then
        winner_id := NEW.p1_id;
      else
        winner_id := NEW.p2_id;
      end if;

      -- 3. Find the target next match
      select * into n_match 
      from public.tournament_matches 
      where id = t_match.next_match_id;

      -- 4. Assign winner to next match (Top/Bottom based on original pos)
      -- If original position was even, go to player 1. If odd, go to player 2.
      -- (This depends on how the bracket is generated, simplified here)
      if (t_match.bracket_pos % 2 = 0) then
        update public.tournament_matches 
        set player1_id = winner_id 
        where id = n_match.id;
      else
        update public.tournament_matches 
        set player2_id = winner_id 
        where id = n_match.id;
      end if;
    end if;
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

-- Trigger
drop trigger if exists on_match_finished_advance_bracket_trigger on public.matches;
create trigger on_match_finished_advance_bracket_trigger
after update on public.matches
for each row execute function public.on_match_finished_advance_bracket();
