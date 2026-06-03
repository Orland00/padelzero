-- ═══════════════════════════════════════════════════════════
-- PadelZero — V5-06 RANDOM USERNAME & SCHEMA SYNC
-- Generates a random unique @username for every new user.
-- Forces PostgREST to reload the schema cache.
-- ═══════════════════════════════════════════════════════════

-- 1. Update the handle_new_user function to generate a random username
create or replace function public.handle_new_user()
returns trigger as $$
declare
  random_handle text;
  handle_exists boolean;
begin
  -- Loop until we find a unique random handle
  loop
    -- Format: jugador_ + 6 random hex chars
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
end;
$$ language plpgsql security definer;

-- 2. Ensure username is unique
do $$ 
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_username_key'
  ) then
    alter table public.profiles add constraint profiles_username_key unique (username);
  end if;
end $$;

-- 3. FORCE SCHEMA SYNC
-- This fixes the "Could not find column 'age'" errors
notify pgrst, 'reload schema';
