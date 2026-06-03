-- ═══════════════════════════════════════════════════════════
-- PadelZero — V3-03 SEASON CLOSING LOGIC
-- ═══════════════════════════════════════════════════════════

-- 1. Seasonal Medals
insert into public.medals (id, name, description, icon_text, rarity) values
('season_1_finisher', 'Pionero (S1)', 'Participaste en la primera temporada de PadelZero.', '🌱', 'rare'),
('season_1_top_10', 'Veterano Élite (S1)', 'Terminaste en el Top 10 de la Temporada 1.', '🎖️', 'legendary')
on conflict (id) do nothing;

-- 2. Close Season Function
create or replace function public.close_active_season()
returns void as $$
declare
  current_s_id uuid;
  p_rec record;
  p_rank integer := 1;
begin
  -- Find active season
  select id into current_s_id from public.seasons where is_active = true limit 1;
  if current_s_id is null then return; end if;

  -- Close it
  update public.seasons set is_active = false where id = current_s_id;

  -- Snapshot & Award & Compress
  for p_rec in 
    select id, elo_rating from public.profiles order by elo_rating desc
  loop
    -- Snapshot result
    insert into public.season_results (season_id, profile_id, final_elo, final_rank)
    values (current_s_id, p_rec.id, p_rec.elo_rating, p_rank);

    -- Award Medals
    -- Everyone gets finisher
    insert into public.profile_medals (profile_id, medal_id)
    values (p_rec.id, 'season_1_finisher')
    on conflict do nothing;

    -- Top 10 gets special
    if p_rank <= 10 then
      insert into public.profile_medals (profile_id, medal_id)
      values (p_rec.id, 'season_1_top_10')
      on conflict do nothing;
    end if;

    -- ELO Compression (20% closer to 1200)
    -- Formula: 1200 + (Old - 1200) * 0.8
    update public.profiles set
      elo_rating = round(1200 + (p_rec.elo_rating - 1200) * 0.8),
      current_streak = 0 -- Reset streaks for new season
    where id = p_rec.id;

    p_rank := p_rank + 1;
  end loop;

  -- Create new season (placeholder name)
  insert into public.seasons (name, end_date)
  values ('Temporada 2: Ascenso', now() + interval '90 days');

end;
$$ language plpgsql security definer;
