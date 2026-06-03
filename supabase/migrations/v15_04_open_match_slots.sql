-- ═══════════════════════════════════════════════════════════
-- v15_04 — OPEN MATCH SLOTS
-- Adds is_open, slots_needed, level_min, level_max to matches.
-- Powers the "Buscar partido" open match feed.
-- Updated: 2026-05-07
-- DOWN: ALTER TABLE public.matches
--         DROP COLUMN IF EXISTS is_open,
--         DROP COLUMN IF EXISTS slots_needed,
--         DROP COLUMN IF EXISTS level_min,
--         DROP COLUMN IF EXISTS level_max;
--       DROP INDEX IF EXISTS idx_matches_open_feed;
-- ═══════════════════════════════════════════════════════════

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS is_open       bool NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS slots_needed  smallint NOT NULL DEFAULT 0
    CHECK (slots_needed BETWEEN 0 AND 3),
  ADD COLUMN IF NOT EXISTS level_min     numeric(3,2) DEFAULT 0
    CHECK (level_min >= 0 AND level_min <= 7),
  ADD COLUMN IF NOT EXISTS level_max     numeric(3,2) DEFAULT 7
    CHECK (level_max >= 0 AND level_max <= 7);

-- Partial index: only indexes open matches, keeps it small
CREATE INDEX IF NOT EXISTS idx_matches_open_feed
  ON public.matches(played_at DESC)
  WHERE is_open = true AND slots_needed > 0;
