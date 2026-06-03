-- ═══════════════════════════════════════════════════════════
-- PadelZero — V5-04 FORCE SCHEMA SYNC
-- Ensures all columns exist and reloads the Supabase cache.
-- ═══════════════════════════════════════════════════════════

-- 1. Ensure columns exist (Double check)
alter table public.profiles add column if not exists display_name text;
alter table public.profiles add column if not exists city text;
alter table public.profiles add column if not exists country text;
alter table public.profiles add column if not exists phone text;
alter table public.profiles add column if not exists age integer;
alter table public.profiles add column if not exists gender text;
alter table public.profiles add column if not exists preferred_position text;
alter table public.profiles add column if not exists favorite_club text;
alter table public.profiles add column if not exists zone text;
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists elo_rating integer default 1200;

-- 2. RELOAD SCHEMA CACHE (Critical for PostgREST)
-- This forces Supabase to realize the columns have been added.
notify pgrst, 'reload schema';

-- 3. Verify columns (This part just for feedback in the SQL editor)
select column_name, data_type 
from information_schema.columns 
where table_name = 'profiles' 
and column_name in ('age', 'display_name', 'city');
