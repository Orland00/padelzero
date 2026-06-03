-- ═══════════════════════════════════════════════════════════════════════
-- PadelZero — V6-05 ADD UPDATED_AT TRIGGER FOR PROFILES
-- Automatically updates updated_at timestamp on profile changes
-- ═══════════════════════════════════════════════════════════════════════

-- Create function to update updated_at
create or replace function public.update_profiles_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Drop trigger if it exists
drop trigger if exists trigger_update_profiles_updated_at on public.profiles;

-- Create trigger
create trigger trigger_update_profiles_updated_at
before update on public.profiles
for each row
execute function public.update_profiles_updated_at();

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
