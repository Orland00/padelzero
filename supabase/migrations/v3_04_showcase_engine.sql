-- ═══════════════════════════════════════════════════════════
-- PadelZero — V3-04 PROFILE SHOWCASE MIGRATION
-- ═══════════════════════════════════════════════════════════

-- 1. Add showcase column to profiles
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name='profiles' and column_name='showcase_medal_ids') then
    alter table public.profiles add column showcase_medal_ids text[] default '{}';
  end if;
end $$;
