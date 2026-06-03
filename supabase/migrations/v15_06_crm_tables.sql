-- ═══════════════════════════════════════════════════════════
-- v15_06 — COACH + CLUB MICRO-CRM TABLES
-- crm_notes: private coach notes per student with Privacy Guard
-- crm_player_stats: club-level player analytics
-- Privacy Guard: RLS ensures coaches only see their own notes;
-- students only see notes marked is_shared=true.
-- Updated: 2026-05-07
-- DOWN: DROP TABLE IF EXISTS public.crm_player_stats;
--       DROP TABLE IF EXISTS public.crm_notes;
-- ═══════════════════════════════════════════════════════════

-- Coach notes with privacy guard
CREATE TABLE IF NOT EXISTS public.crm_notes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content    text NOT NULL,
  tags       text[] NOT NULL DEFAULT '{}',
  is_shared  bool NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_notes_author
  ON public.crm_notes(author_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_notes_tags
  ON public.crm_notes USING GIN(tags);

ALTER TABLE public.crm_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_notes_select"
  ON public.crm_notes FOR SELECT TO authenticated
  USING (
    auth.uid() = author_id
    OR (auth.uid() = target_id AND is_shared = true)
  );

CREATE POLICY "crm_notes_insert"
  ON public.crm_notes FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "crm_notes_update"
  ON public.crm_notes FOR UPDATE TO authenticated
  USING (auth.uid() = author_id);

CREATE POLICY "crm_notes_delete"
  ON public.crm_notes FOR DELETE TO authenticated
  USING (auth.uid() = author_id);

-- Club-level player analytics
CREATE TABLE IF NOT EXISTS public.crm_player_stats (
  player_id              uuid PRIMARY KEY
    REFERENCES public.profiles(id) ON DELETE CASCADE,
  freq_classes_taken     integer NOT NULL DEFAULT 0,
  freq_classes_cancelled integer NOT NULL DEFAULT 0,
  total_spend            numeric(10,2) NOT NULL DEFAULT 0,
  pending_debt           numeric(10,2) NOT NULL DEFAULT 0,
  heavy_user_score       integer NOT NULL DEFAULT 0,
  updated_at             timestamptz DEFAULT now()
);

CREATE OR REPLACE FUNCTION public.compute_heavy_user_score()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.heavy_user_score :=
    (NEW.freq_classes_taken * 2) + FLOOR(NEW.total_spend / 100)::integer;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_heavy_user_score ON public.crm_player_stats;
CREATE TRIGGER trg_heavy_user_score
  BEFORE INSERT OR UPDATE ON public.crm_player_stats
  FOR EACH ROW EXECUTE FUNCTION public.compute_heavy_user_score();

ALTER TABLE public.crm_player_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_stats_select_authenticated"
  ON public.crm_player_stats FOR SELECT TO authenticated USING (true);

CREATE POLICY "crm_stats_insert_authenticated"
  ON public.crm_player_stats FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "crm_stats_update_authenticated"
  ON public.crm_player_stats FOR UPDATE TO authenticated
  USING (true);
