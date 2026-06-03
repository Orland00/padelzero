-- ═══════════════════════════════════════════════════════════
-- v15_05 — SOCIAL LAYER
-- player_follows: follow graph between players
-- player_achievements: earned achievements per player
-- profiles.achievements[]: denormalized for fast badge reads
-- Trigger: auto-evaluates achievement unlocks on new rating history
-- Updated: 2026-05-07
-- DOWN: DROP TABLE IF EXISTS public.player_achievements;
--       DROP TABLE IF EXISTS public.player_follows;
--       ALTER TABLE public.profiles DROP COLUMN IF EXISTS achievements;
--       DROP TRIGGER IF EXISTS trg_check_achievements ON public.player_rating_history;
--       DROP FUNCTION IF EXISTS public.check_achievements();
-- ═══════════════════════════════════════════════════════════

-- Follow graph
CREATE TABLE IF NOT EXISTS public.player_follows (
  follower_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  followee_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at   timestamptz DEFAULT now(),
  PRIMARY KEY (follower_id, followee_id),
  CHECK (follower_id != followee_id)
);

ALTER TABLE public.player_follows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "follows_select_authenticated"
  ON public.player_follows FOR SELECT TO authenticated USING (true);

CREATE POLICY "follows_insert_own"
  ON public.player_follows FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = follower_id);

CREATE POLICY "follows_delete_own"
  ON public.player_follows FOR DELETE TO authenticated
  USING (auth.uid() = follower_id);

-- Achievement records
CREATE TABLE IF NOT EXISTS public.player_achievements (
  player_id       uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  achievement_key text NOT NULL,
  unlocked_at     timestamptz DEFAULT now(),
  PRIMARY KEY (player_id, achievement_key)
);

ALTER TABLE public.player_achievements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "achievements_select_all"
  ON public.player_achievements FOR SELECT USING (true);

-- Denormalized achievements array on profiles (fast badge reads)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS achievements text[] NOT NULL DEFAULT '{}';

-- Achievement check function
CREATE OR REPLACE FUNCTION public.check_achievements()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_profile record;
  v_keys    text[] := '{}';
BEGIN
  SELECT elo_rating, matches_played, matches_won, level
  INTO v_profile
  FROM public.profiles WHERE id = NEW.player_id;

  IF v_profile.matches_won >= 1 THEN
    v_keys := array_append(v_keys, 'primera_victoria');
  END IF;

  IF v_profile.matches_played >= 10 THEN
    v_keys := array_append(v_keys, 'doble_10');
  END IF;

  IF v_profile.matches_played >= 20 THEN
    v_keys := array_append(v_keys, 'veterano_20');
  END IF;

  IF v_profile.level >= 3.0 THEN
    v_keys := array_append(v_keys, 'nivel_3');
  END IF;

  IF v_profile.level >= 5.0 THEN
    v_keys := array_append(v_keys, 'nivel_5');
  END IF;

  IF v_profile.elo_rating >= 2000 THEN
    v_keys := array_append(v_keys, 'leyenda');
  END IF;

  INSERT INTO public.player_achievements (player_id, achievement_key)
  SELECT NEW.player_id, unnest(v_keys)
  ON CONFLICT DO NOTHING;

  UPDATE public.profiles
  SET achievements = (
    SELECT ARRAY_AGG(achievement_key)
    FROM public.player_achievements
    WHERE player_id = NEW.player_id
  )
  WHERE id = NEW.player_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_check_achievements ON public.player_rating_history;
CREATE TRIGGER trg_check_achievements
  AFTER INSERT ON public.player_rating_history
  FOR EACH ROW EXECUTE FUNCTION public.check_achievements();
