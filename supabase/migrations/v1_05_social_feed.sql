-- ═══════════════════════════════════════════════════════════
-- PadelZero — V1-05 SOCIAL FEED MIGRATION
-- ═══════════════════════════════════════════════════════════

-- Add zone column to profiles if not exists
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name   = 'profiles'
      and column_name  = 'zone'
  ) then
    alter table public.profiles add column zone text;
  end if;
end $$;

-- Create index for performance on filtering
create index if not exists idx_profiles_zone on public.profiles(zone);
