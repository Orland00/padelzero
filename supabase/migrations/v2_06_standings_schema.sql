-- ═══════════════════════════════════════════════════════════
-- PadelZero — V2-06 TOURNAMENT STANDINGS MIGRATION
-- ═══════════════════════════════════════════════════════════

-- Add scoring columns to tournament_participants
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='tournament_participants' and column_name='points') then
    alter table public.tournament_participants add column points integer default 0;
  end if;

  if not exists (select 1 from information_schema.columns where table_name='tournament_participants' and column_name='matches_won') then
    alter table public.tournament_participants add column matches_won integer default 0;
  end if;

  if not exists (select 1 from information_schema.columns where table_name='tournament_participants' and column_name='matches_lost') then
    alter table public.tournament_participants add column matches_lost integer default 0;
  end if;
end $$;
