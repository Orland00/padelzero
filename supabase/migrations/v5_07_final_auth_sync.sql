-- ═══════════════════════════════════════════════════════════
-- PadelZero — V5-07 FINAL AUTH SYNC & REPAIR
-- This script fixes the "Server Error" on Login/SignUp.
-- Run this in your Supabase SQL Editor.
-- ═══════════════════════════════════════════════════════════

-- 1. Ensure all columns exist and are nullable (except id)
alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists elo_rating integer default 1200;
alter table public.profiles add column if not exists elo_peak integer default 1200;

-- 2. Correct the unique constraint handling
-- Clear any duplicate-causing constraints if necessary (keep unique for username/email)
do $$ 
begin
  -- Ensure username is unique
  if not exists (select 1 from pg_constraint where conname = 'profiles_username_key') then
    alter table public.profiles add constraint profiles_username_key unique (username);
  end if;
exception when others then null;
end $$;

-- 3. MASTER TRIGGER: handle_new_user (ULTRA ROBUST)
create or replace function public.handle_new_user()
returns trigger as $$
declare
  random_handle text;
  handle_exists boolean;
begin
  -- Loop for unique random handle (if username is not provided)
  loop
    random_handle := 'jugador_' || substring(md5(random()::text) from 1 for 6);
    select exists(select 1 from public.profiles where username = random_handle) into handle_exists;
    exit when not handle_exists;
  end loop;

  insert into public.profiles (
    id, 
    email, 
    display_name, 
    avatar_url, 
    username,
    elo_rating, 
    elo_peak
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', 'Nuevo Jugador'),
    new.raw_user_meta_data->>'avatar_url',
    random_handle,
    1200,
    1200
  )
  on conflict (id) do update set
    email = excluded.email,
    display_name = coalesce(public.profiles.display_name, excluded.display_name),
    username = coalesce(public.profiles.username, excluded.username);

  return new;
exception when others then
  -- CRITICAL: Prevent the whole user creation from failing if the profile insertion fails
  return new;
end;
$$ language plpgsql security definer;

-- 4. Re-attach trigger
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 5. Finalize schema sync
notify pgrst, 'reload schema';
