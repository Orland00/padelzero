-- ═══════════════════════════════════════════════════════════
-- v15_02 — MATCH CONFIRMATION
-- Adds confirmation_status + confirmed_at to existing matches.
-- New match_confirmations table for per-player decisions.
-- Updated: 2026-05-07
-- DOWN: ALTER TABLE public.matches
--         DROP COLUMN IF EXISTS confirmation_status,
--         DROP COLUMN IF EXISTS confirmed_at;
--       DROP TABLE IF EXISTS public.match_confirmations;
-- ═══════════════════════════════════════════════════════════

-- Extend matches with confirmation tracking
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS confirmation_status text NOT NULL DEFAULT 'pending'
    CHECK (confirmation_status IN ('pending', 'confirmed', 'disputed')),
  ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;

-- Per-player confirmation decisions
CREATE TABLE IF NOT EXISTS public.match_confirmations (
  match_id    uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  decision    text NOT NULL CHECK (decision IN ('confirm', 'dispute')),
  decided_at  timestamptz DEFAULT now(),
  PRIMARY KEY (match_id, player_id)
);

ALTER TABLE public.match_confirmations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "confirmations_select_authenticated"
  ON public.match_confirmations FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "confirmations_insert_own"
  ON public.match_confirmations FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = player_id);
