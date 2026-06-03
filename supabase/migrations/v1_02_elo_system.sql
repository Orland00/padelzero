-- ═══════════════════════════════════════════════════════════
-- PadelZero — V1-02 ELO SYSTEM MIGRATION
-- Run in Supabase SQL Editor (safe to run on existing data)
-- Requires: pg_cron extension enabled in Dashboard → Extensions
-- ═══════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────
-- 1. ELO HISTORY TABLE
-- ───────────────────────────────────────────────────────────
create table if not exists public.elo_history (
  id          uuid primary key default uuid_generate_v4(),
  player_id   uuid not null references public.profiles(id) on delete cascade,
  match_id    uuid references public.matches(id) on delete set null,
  elo_before  integer not null,
  elo_after   integer not null,
  delta       integer not null,
  reason      text not null default 'match',   -- match | decay | season | manual
  created_at  timestamptz not null default now()
);

create index if not exists idx_elo_history_player on public.elo_history(player_id, created_at desc);
create index if not exists idx_elo_history_match  on public.elo_history(match_id);

-- RLS: anyone can read history; only security-definer functions write
alter table public.elo_history enable row level security;
create policy "public read elo_history" on public.elo_history for select using (true);

-- ───────────────────────────────────────────────────────────
-- 2. Add last_match_at to profiles (for decay tracking)
--    Uses IF NOT EXISTS pattern via DO block (idempotent)
-- ───────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'profiles'
      and column_name  = 'last_match_at'
  ) then
    alter table public.profiles add column last_match_at timestamptz;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'profiles'
      and column_name  = 'elo_peak'
  ) then
    alter table public.profiles add column elo_peak integer not null default 1200;
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'profiles'
      and column_name  = 'favorite_club'
  ) then
    alter table public.profiles add column favorite_club text;
  end if;
end $$;

-- ───────────────────────────────────────────────────────────
-- 3. DYNAMIC K-FACTOR ELO UPDATE (replaces flat K=32)
--    Supports 1v1 and 2v2
-- ───────────────────────────────────────────────────────────
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
  p_k          integer;
  new_elo      integer;
  final_delta  integer;
begin
  -- Calculate Winner Team Avg ELO and Avg K
  foreach pid in array winner_ids loop
    if pid is not null then
      select elo_rating, matches_played into p_elo, p_played from public.profiles where id = pid;
      w_avg_elo := w_avg_elo + p_elo;
      w_k_avg   := w_k_avg + (case when p_played < 20 then 32 else 16 end);
    end if;
  end loop;
  w_avg_elo := w_avg_elo / array_length(array_remove(winner_ids, null), 1);
  w_k_avg   := w_k_avg / array_length(array_remove(winner_ids, null), 1);

  -- Calculate Loser Team Avg ELO and Avg K
  foreach pid in array loser_ids loop
    if pid is not null then
      select elo_rating, matches_played into p_elo, p_played from public.profiles where id = pid;
      l_avg_elo := l_avg_elo + p_elo;
      l_k_avg   := l_k_avg + (case when p_played < 20 then 32 else 16 end);
    end if;
  end loop;
  l_avg_elo := l_avg_elo / array_length(array_remove(loser_ids, null), 1);
  l_k_avg   := l_k_avg / array_length(array_remove(loser_ids, null), 1);

  -- Expected score for winner
  exp_w := 1.0 / (1.0 + power(10.0, (l_avg_elo - w_avg_elo) / 400.0));
  total_delta := round(((w_k_avg + l_k_avg) / 2.0) * (1.0 - exp_w));

  -- Apply to Winners
  foreach pid in array winner_ids loop
    if pid is not null then
      select elo_rating into p_elo from public.profiles where id = pid;
      new_elo := greatest(800, p_elo + total_delta);
      final_delta := new_elo - p_elo;
      
      update public.profiles set
        elo_rating = new_elo,
        elo_peak = greatest(coalesce(elo_peak, 1200), new_elo),
        matches_played = matches_played + 1,
        matches_won = matches_won + 1,
        last_match_at = now(),
        updated_at = now()
      where id = pid;

      insert into public.elo_history (player_id, match_id, elo_before, elo_after, delta, reason)
      values (pid, match_id, p_elo, new_elo, final_delta, 'match');
    end if;
  end loop;

  -- Apply to Losers (negative delta)
  total_delta := round(((w_k_avg + l_k_avg) / 2.0) * (0 - exp_w));
  foreach pid in array loser_ids loop
    if pid is not null then
      select elo_rating into p_elo from public.profiles where id = pid;
      new_elo := greatest(800, p_elo + total_delta);
      final_delta := new_elo - p_elo;

      update public.profiles set
        elo_rating = new_elo,
        matches_played = matches_played + 1,
        last_match_at = now(),
        updated_at = now()
      where id = pid;

      insert into public.elo_history (player_id, match_id, elo_before, elo_after, delta, reason)
      values (pid, match_id, p_elo, new_elo, final_delta, 'match');
    end if;
  end loop;
end;
$$;

-- ───────────────────────────────────────────────────────────
-- 4. FINISH MATCH RPC
-- ───────────────────────────────────────────────────────────
create or replace function finish_match(
  match_id  uuid,
  winner_id uuid
)
returns json
language plpgsql
security definer
as $$
declare
  match_rec    record;
  winners      uuid[];
  losers       uuid[];
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

  update public.matches set
    finished = true, finished_at = now(),
    winner_id = winner_id, elo_applied = true, updated_at = now()
  where id = match_id;

  perform update_match_elo(winners, losers, match_id);
  return json_build_object('ok', true);
end;
$$;

-- Grant execute to authenticated users
grant execute on function finish_match(uuid, uuid) to authenticated;
grant execute on function update_match_elo(uuid[], uuid[], uuid) to service_role;

-- ───────────────────────────────────────────────────────────
-- 5. ELO DECAY FUNCTION (called by pg_cron nightly)
--    -10 ELO after 30 days inactive, floor at 800
-- ───────────────────────────────────────────────────────────
create or replace function apply_elo_decay()
returns integer   -- returns number of players affected
language plpgsql
security definer
as $$
declare
  affected  integer := 0;
  rec       record;
  new_elo   integer;
begin
  for rec in
    select id, elo_rating
      from public.profiles
     where (last_match_at is null and created_at < now() - interval '30 days')
        or (last_match_at < now() - interval '30 days')
  loop
    -- Floor decay at 800
    new_elo := greatest(800, rec.elo_rating - 10);

    if new_elo = rec.elo_rating then
      continue;  -- already at floor, skip
    end if;

    update public.profiles set
      elo_rating   = new_elo,
      -- push last_match_at forward 30 days so decay only fires once per window
      last_match_at = coalesce(last_match_at, created_at) + interval '30 days',
      updated_at   = now()
    where id = rec.id;

    insert into public.elo_history (player_id, match_id, elo_before, elo_after, delta, reason)
    values (rec.id, null, rec.elo_rating, new_elo, new_elo - rec.elo_rating, 'decay');

    affected := affected + 1;
  end loop;

  return affected;
end;
$$;

grant execute on function apply_elo_decay() to service_role;

-- ───────────────────────────────────────────────────────────
-- 6. pg_cron SCHEDULE
--    IMPORTANT: pg_cron extension must be enabled first:
--    Dashboard → Database → Extensions → pg_cron → Enable
-- ───────────────────────────────────────────────────────────

-- Schedule nightly decay at 02:00 UTC
-- Uncomment and run separately AFTER enabling pg_cron:
/*
select cron.schedule(
  'elo-decay-nightly',
  '0 2 * * *',
  $$select apply_elo_decay()$$
);
*/

-- ───────────────────────────────────────────────────────────
-- 7. REALTIME for elo_history
-- ───────────────────────────────────────────────────────────
alter publication supabase_realtime add table public.elo_history;

-- ───────────────────────────────────────────────────────────
-- VERIFICATION QUERIES — run after migration
-- ───────────────────────────────────────────────────────────

-- Check tables exist:
-- select * from elo_history limit 5;

-- Test ELO math (manual call):
-- select update_profile_elo('<winner-uuid>', '<loser-uuid>', null);

-- Test decay (set a player inactive):
-- update profiles set last_match_at = now() - interval '31 days' where id = '<uuid>';
-- select apply_elo_decay();
-- select * from elo_history where reason = 'decay';
