-- ═══════════════════════════════════════════════════════════
-- PadelZero — V1-06 RIVAL FINDER MIGRATION
-- ═══════════════════════════════════════════════════════════

-- Add availability columns to profiles if they don't exist
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'profiles'
      and column_name  = 'availability_days'
  ) then
    alter table public.profiles add column availability_days text[] default '{}';
  end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'profiles'
      and column_name  = 'availability_times'
  ) then
    alter table public.profiles add column availability_times text[] default '{}';
  end if;
end $$;

-- Indices for filtering performance
create index if not exists idx_profiles_availability_days on public.profiles using gin(availability_days);
create index if not exists idx_profiles_availability_times on public.profiles using gin(availability_times);
