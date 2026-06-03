-- ═══════════════════════════════════════════════════════════
-- v15_01 — PLAYER RATING HISTORY
-- Immutable audit log of every ELO change.
-- Written exclusively by confirm_match_and_update_ratings RPC.
-- No client INSERT allowed.
-- Updated: 2026-05-07
-- DOWN: DROP TABLE IF EXISTS public.player_rating_history;
-- ═══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.player_rating_history (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  match_id     uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  elo_before   integer NOT NULL,
  elo_after    integer NOT NULL,
  level_before numeric(3,2) NOT NULL,
  level_after  numeric(3,2) NOT NULL,
  delta_elo    integer NOT NULL,
  created_at   timestamptz DEFAULT now()
);

-- Performance index for per-player history queries (paginated, newest first)
CREATE INDEX IF NOT EXISTS idx_rating_history_player
  ON public.player_rating_history(player_id, created_at DESC);

-- RLS: anyone authenticated can read history; only RPC can insert
ALTER TABLE public.player_rating_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rating_history_select_authenticated"
  ON public.player_rating_history FOR SELECT
  TO authenticated USING (true);

-- No INSERT policy for end users — the SECURITY DEFINER RPC bypasses RLS
