-- ═══════════════════════════════════════════════════════════
-- PadelZero — V3-01 AUTOMATED AWARD LOGIC
-- ═══════════════════════════════════════════════════════════

create or replace function public.check_and_award_medals()
returns trigger as $$
begin
  -- 1. First Win
  if NEW.matches_won >= 1 then
    insert into public.profile_medals (profile_id, medal_id)
    values (NEW.id, 'first_win')
    on conflict (profile_id, medal_id) do nothing;
  end if;

  -- 2. Veteran (10 matches)
  if NEW.matches_played >= 10 then
    insert into public.profile_medals (profile_id, medal_id)
    values (NEW.id, 'ten_matches')
    on conflict (profile_id, medal_id) do nothing;
  end if;

  -- 3. Elite (1800+ ELO)
  if NEW.elo_rating >= 1800 then
    insert into public.profile_medals (profile_id, medal_id)
    values (NEW.id, 'elite_ranking')
    on conflict (profile_id, medal_id) do nothing;
  end if;

  -- 4. Founder
  if NEW.is_founder then
    insert into public.profile_medals (profile_id, medal_id)
    values (NEW.id, 'founder')
    on conflict (profile_id, medal_id) do nothing;
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

-- Trigger
drop trigger if exists on_profile_update_check_medals_trigger on public.profiles;
create trigger on_profile_update_check_medals_trigger
after update on public.profiles
for each row execute function public.check_and_award_medals();
