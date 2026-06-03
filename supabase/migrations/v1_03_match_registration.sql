-- ═══════════════════════════════════════════════════════════
-- PadelZero — V1-03 MATCH REGISTRATION MIGRATION
-- Enhances finish_match to handle score logging and Friendly/Official logic
-- ═══════════════════════════════════════════════════════════

create or replace function finish_match(
  match_id  uuid,
  winner_id uuid,
  p1_pts    integer default null,
  p2_pts    integer default null,
  scores    jsonb   default null
)
returns json
language plpgsql
security definer
as $$
declare
  match_rec    record;
  winners      uuid[];
  losers       uuid[];
  final_state  jsonb;
begin
  select * into match_rec from public.matches where id = match_id;
  if not found then return json_build_object('ok', false, 'error', 'match_not_found'); end if;
  if match_rec.elo_applied = true then return json_build_object('ok', true, 'skipped', true); end if;

  -- Determine winners and losers teams
  if match_rec.p1_id = winner_id or match_rec.p1b_id = winner_id then
    winners := array[match_rec.p1_id, match_rec.p1b_id];
    losers  := array[match_rec.p2_id, match_rec.p2b_id];
  elsif match_rec.p2_id = winner_id or match_rec.p2b_id = winner_id then
    winners := array[match_rec.p2_id, match_rec.p2b_id];
    losers  := array[match_rec.p1_id, match_rec.p1b_id];
  else
    return json_build_object('ok', false, 'error', 'winner_not_in_match');
  end if;

  -- Update live_state if points provided
  final_state := match_rec.live_state;
  if p1_pts is not null and p2_pts is not null then
    final_state := jsonb_build_object('p1_points', p1_pts, 'p2_points', p2_pts);
  end if;

  -- Update match record
  update public.matches set
    finished = true, 
    finished_at = now(),
    winner_id = winner_id, 
    elo_applied = (case when match_rec.tipo = 'ranked' then true else false end),
    live_state = final_state,
    sets = coalesce(scores, sets),
    updated_at = now()
  where id = match_id;

  -- Only apply ELO if match is 'ranked'
  if match_rec.tipo = 'ranked' then
    perform update_match_elo(winners, losers, match_id);
  end if;

  return json_build_object('ok', true, 'ranked', (match_rec.tipo = 'ranked'));
end;
$$;

-- Note: update_match_elo remains internal (service_role)
grant execute on function finish_match(uuid, uuid, integer, integer, jsonb) to authenticated;
