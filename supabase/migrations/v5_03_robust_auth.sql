-- ═══════════════════════════════════════════════════════════
-- PadelZero — V5-03 ROBUST AUTH & TRIGGER
-- Ensures profiles are created automatically on sign-up.
-- ═══════════════════════════════════════════════════════════

-- 1. Ensure profiles table is ready and columns are nullable
-- (This fixes issues if 'nombre' or other fields were NOT NULL)
do $$ 
begin
  -- Make all columns nullable except id (for flexibility)
  alter table public.profiles alter column display_name drop not null;
  alter table public.profiles alter column email drop not null;
  -- If 'nombre' exists from a previous schema version, make it nullable too
  if exists (select 1 from information_schema.columns where table_name='profiles' and column_name='nombre') then
    alter table public.profiles alter column nombre drop not null;
  end if;
exception when others then 
  null;
end $$;

-- 2. CREATE AUTO-PROFILE TRIGGER
-- This function runs on the server every time a user signs up (Google or Email)
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name, avatar_url, elo_rating, elo_peak)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url',
    1200,
    1200
  )
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

-- Re-create the trigger
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. ENSURE RLS FOR UPDATES
-- The frontend will now mostly do UPDATES because the trigger already created the row.
alter table public.profiles enable row level security;

drop policy if exists "own_profile_update" on public.profiles;
create policy "own_profile_update" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "own_profile_insert" on public.profiles;
create policy "own_profile_insert" on public.profiles
  for insert with check (auth.uid() = id);

drop policy if exists "public_read_profiles" on public.profiles;
create policy "public_read_profiles" on public.profiles
  for select using (true);
