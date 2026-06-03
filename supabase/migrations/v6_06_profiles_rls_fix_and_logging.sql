-- ═══════════════════════════════════════════════════════════════════════
-- PadelZero — V6-06 FIX PROFILES RLS & ADD UPDATE LOGGING
-- Ensures UPDATE RLS policy is properly scoped and adds debug logging
-- ═══════════════════════════════════════════════════════════════════════

-- Step 1: Verify RLS is enabled
alter table public.profiles enable row level security;

-- Step 2: Drop and recreate UPDATE policy with correct logic
-- The issue: WITH CHECK needs to verify the NEW row, not reject if id changes
drop policy if exists "Users can update own profile" on public.profiles;

-- Correct policy: USING checks if current user owns the row, WITH CHECK ensures they own the new row
create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Step 3: Create debug logging table if it doesn't exist
create table if not exists public.profile_update_logs (
  id uuid primary key default uuid_generate_v4(),
  profile_id uuid references auth.users(id) on delete cascade,
  auth_uid uuid,
  attempted_at timestamptz default now(),
  status text, -- 'success', 'rls_rejected', 'error'
  error_message text,
  metadata jsonb
);

-- Enable RLS on logs (only system can write, authenticated users can read own)
alter table public.profile_update_logs enable row level security;

drop policy if exists "System can insert logs" on public.profile_update_logs;
create policy "System can insert logs"
  on public.profile_update_logs for insert
  with check (true);

drop policy if exists "Users can view own logs" on public.profile_update_logs;
create policy "Users can view own logs"
  on public.profile_update_logs for select
  using (profile_id = auth.uid());

-- Step 4: Create trigger function to log profile updates
create or replace function public.log_profile_update()
returns trigger as $$
begin
  insert into public.profile_update_logs (
    profile_id,
    auth_uid,
    status,
    metadata
  ) values (
    new.id,
    auth.uid(),
    'success',
    jsonb_build_object(
      'fields_updated', array_agg(distinct key) filter (where key is not null),
      'old_display_name', old.display_name,
      'new_display_name', new.display_name
    )
  );
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if exists
drop trigger if exists trigger_log_profile_update on public.profiles;

-- Create trigger
create trigger trigger_log_profile_update
after update on public.profiles
for each row
execute function public.log_profile_update();

-- Step 5: Ensure updated_at is auto-set
drop function if exists public.update_profiles_updated_at() cascade;

create or replace function public.update_profiles_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_update_profiles_updated_at on public.profiles;

create trigger trigger_update_profiles_updated_at
before update on public.profiles
for each row
execute function public.update_profiles_updated_at();

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
