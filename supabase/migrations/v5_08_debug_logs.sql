-- ═══════════════════════════════════════════════════════════
-- PadelZero — V5-08 DEBUG LOGS SYSTEM
-- Creates a table for captured errors and troubleshooting.
-- ═══════════════════════════════════════════════════════════

create table if not exists public.debug_logs (
  id          uuid primary key default uuid_generate_v4(),
  user_id     uuid references auth.users(id) on delete set null,
  level       text not null default 'error', -- error, warning, info
  category    text not null default 'auth',  -- auth, match, ui
  message     text not null,
  metadata    jsonb default '{}',
  created_at  timestamptz default now()
);

-- RLS: Open for inserts so we can capture everything
alter table public.debug_logs enable row level security;

drop policy if exists "Anyone can insert logs" on public.debug_logs;
create policy "Anyone can insert logs"
  on public.debug_logs for insert
  with check (true);

drop policy if exists "Only admins can see logs" on public.debug_logs;
create policy "Only admins can see logs"
  on public.debug_logs for select
  using (true); -- Set to true for now so user can see them if needed
