-- ═══════════════════════════════════════════════════════════
-- v15_00 — ADD PLAYER LEVEL (PLAYTOMIC-STYLE 0.0–7.0)
-- Extends profiles with a computed level derived from elo_rating.
-- Linear map: elo 800 → level 0.00, elo 2400 → level 7.00
-- Also adds preferred_side for matchmaking.
-- Updated: 2026-05-07
-- DOWN: ALTER TABLE public.profiles DROP COLUMN IF EXISTS level;
--       ALTER TABLE public.profiles DROP COLUMN IF EXISTS preferred_side;
--       DROP TRIGGER IF EXISTS trg_sync_level ON public.profiles;
--       DROP FUNCTION IF EXISTS public.sync_level_from_elo();
-- ═══════════════════════════════════════════════════════════

-- Add level column
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS level numeric(3,2) NOT NULL DEFAULT 1.00
    CHECK (level >= 0 AND level <= 7);

-- Add preferred side
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS preferred_side text
    CHECK (preferred_side IN ('drive', 'reves', 'ambos'));

-- Backfill existing rows: map elo_rating to level
-- Formula: round(max(0, min(7, (elo_rating - 800) / 1600.0 * 7)), 2)
UPDATE public.profiles
SET level = ROUND(
  GREATEST(0, LEAST(7, (elo_rating - 800) / 1600.0 * 7))::numeric,
  2
);

-- Helper function for the sync trigger
CREATE OR REPLACE FUNCTION public.sync_level_from_elo()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- Recompute level whenever elo_rating changes
  NEW.level := ROUND(
    GREATEST(0, LEAST(7, (NEW.elo_rating - 800) / 1600.0 * 7))::numeric,
    2
  );
  RETURN NEW;
END;
$$;

-- Trigger: fires before any UPDATE that touches elo_rating
DROP TRIGGER IF EXISTS trg_sync_level ON public.profiles;
CREATE TRIGGER trg_sync_level
  BEFORE UPDATE OF elo_rating ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.sync_level_from_elo();

-- Index for level-based queries (open match feed, leaderboard filter)
CREATE INDEX IF NOT EXISTS idx_profiles_level ON public.profiles(level DESC);
