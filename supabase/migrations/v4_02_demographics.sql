-- Add age and gender columns to profiles
alter table public.profiles add column if not exists age integer;
alter table public.profiles add column if not exists gender text;
