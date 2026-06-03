-- ═══════════════════════════════════════════════════════════
-- PadelZero — V1-04 MATCH CONFIRMATION MIGRATION
-- ═══════════════════════════════════════════════════════════

-- 1. Table
create table if not exists public.match_confirmations (
  id          uuid primary key default uuid_generate_v4(),
  match_id    uuid not null references public.matches(id) on delete cascade,
  player_id   uuid not null references public.profiles(id) on delete cascade,
  status      text not null default 'pending', -- pending, confirmed, disputed
  notes       text,
  created_at  timestamptz not null default now(),
  unique(match_id, player_id)
);

-- RLS
alter table public.match_confirmations enable row level security;
create policy "public read match_confirmations" on public.match_confirmations for select using (true);
create policy "players update own confirmation" on public.match_confirmations 
  for update using (auth.uid() = player_id);

-- 2. Trigger Function
create or replace function handle_match_completion_confirmations()
returns trigger
language plpgsql
security definer
as $$
begin
  if (NEW.finished = true and (OLD.finished is null or OLD.finished = false)) then
    -- Participant 1
    if NEW.p1_id is not null then
      insert into public.match_confirmations (match_id, player_id) values (NEW.id, NEW.p1_id) on conflict do nothing;
    end if;
    -- Participant 1b (Doubles)
    if NEW.p1b_id is not null then
      insert into public.match_confirmations (match_id, player_id) values (NEW.id, NEW.p1b_id) on conflict do nothing;
    end if;
    -- Participant 2
    if NEW.p2_id is not null then
      insert into public.match_confirmations (match_id, player_id) values (NEW.id, NEW.p2_id) on conflict do nothing;
    end if;
    -- Participant 2b (Doubles)
    if NEW.p2b_id is not null then
      insert into public.match_confirmations (match_id, player_id) values (NEW.id, NEW.p2b_id) on conflict do nothing;
    end if;
  end if;
  return NEW;
end;
$$;

-- 3. Trigger
drop trigger if exists on_match_finished_create_confirmations on public.matches;
create trigger on_match_finished_create_confirmations
  after update on public.matches
  for each row
  execute function handle_match_completion_confirmations();

-- 4. RPCs
create or replace function confirm_match(m_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  update public.match_confirmations
     set status = 'confirmed',
         created_at = now()
   where match_id = m_id
     and player_id = auth.uid();
end;
$$;

create or replace function dispute_match(m_id uuid, reason text)
returns void
language plpgsql
security definer
as $$
begin
  update public.match_confirmations
     set status = 'disputed',
         notes = reason,
         created_at = now()
   where match_id = m_id
     and player_id = auth.uid();
end;
$$;

grant execute on function confirm_match(uuid) to authenticated;
grant execute on function dispute_match(uuid, text) to authenticated;

-- Realtime
alter publication supabase_realtime add table public.match_confirmations;
