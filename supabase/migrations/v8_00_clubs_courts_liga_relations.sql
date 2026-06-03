-- ═══════════════════════════════════════════════════════════
-- V8-00: Club → Liga → Courts relationships
-- ═══════════════════════════════════════════════════════════

-- Create courts table
CREATE TABLE IF NOT EXISTS public.courts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  court_number INT NOT NULL,
  name VARCHAR(100),
  surface_type VARCHAR(50), -- pvc, cesped, hormigon, etc.
  availability JSONB, -- { "Mon": ["08:00", "22:00"], ... }
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(club_id, court_number)
);

-- Add club_id to ligas (nullable - liga can exist without club)
ALTER TABLE public.ligas
  ADD COLUMN IF NOT EXISTS club_id UUID REFERENCES public.clubs(id) ON DELETE SET NULL;

-- Add court_id to liga_matches (nullable - match can happen without court assignment)
ALTER TABLE public.liga_matches
  ADD COLUMN IF NOT EXISTS court_id UUID REFERENCES public.courts(id) ON DELETE SET NULL;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_courts_club_id ON public.courts(club_id);
CREATE INDEX IF NOT EXISTS idx_ligas_club_id ON public.ligas(club_id);
CREATE INDEX IF NOT EXISTS idx_liga_matches_court_id ON public.liga_matches(court_id);

-- Add updated_at trigger to courts
CREATE OR REPLACE FUNCTION update_courts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_courts_updated_at ON public.courts;
CREATE TRIGGER trg_courts_updated_at
  BEFORE UPDATE ON public.courts
  FOR EACH ROW
  EXECUTE FUNCTION update_courts_updated_at();
