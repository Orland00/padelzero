-- Add phone column to profiles
alter table public.profiles add column if not exists phone text;
