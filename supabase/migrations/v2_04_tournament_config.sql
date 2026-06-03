-- ═══════════════════════════════════════════════════════════
-- PadelZero — V2-04 TOURNAMENT CONFIG MIGRATION
-- ═══════════════════════════════════════════════════════════

-- Add configuration columns to tournaments
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='tournaments' and column_name='entry_fee') then
    alter table public.tournaments add column entry_fee numeric default 0;
  end if;

  if not exists (select 1 from information_schema.columns where table_name='tournaments' and column_name='registration_deadline') then
    alter table public.tournaments add column registration_deadline timestamptz;
  end if;

  if not exists (select 1 from information_schema.columns where table_name='tournaments' and column_name='min_elo') then
    alter table public.tournaments add column min_elo integer default 0;
  end if;

  if not exists (select 1 from information_schema.columns where table_name='tournaments' and column_name='max_elo') then
    alter table public.tournaments add column max_elo integer default 3000;
  end if;

  if not exists (select 1 from information_schema.columns where table_name='tournaments' and column_name='prize_pool') then
    alter table public.tournaments add column prize_pool text;
  end if;
end $$;
