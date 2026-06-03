-- ═══════════════════════════════════════════════════════════
-- V9-02: FIX LIGA_MATCHES RLS POLICIES
-- ═══════════════════════════════════════════════════════════

-- Drop all existing RLS policies on liga_matches
DROP POLICY IF EXISTS "Authenticated users can insert matches" ON public.liga_matches;
DROP POLICY IF EXISTS "Members can insert matches for their liga" ON public.liga_matches;
DROP POLICY IF EXISTS "Anyone can read matches" ON public.liga_matches;
DROP POLICY IF EXISTS "Members can update own matches" ON public.liga_matches;

-- Enable RLS if not already enabled
ALTER TABLE public.liga_matches ENABLE ROW LEVEL SECURITY;

-- 1. Public read access to all matches
CREATE POLICY "Anyone can read matches"
  ON public.liga_matches FOR SELECT
  USING (true);

-- 2. Authenticated users in a liga can insert matches for that liga
CREATE POLICY "Liga members can insert matches"
  ON public.liga_matches FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.liga_members
      WHERE liga_members.liga_id = liga_matches.liga_id
      AND liga_members.player_id = auth.uid()
      AND (liga_members.is_active = true OR liga_members.status = 'active')
    )
  );

-- 3. Match recorders can update their own matches
CREATE POLICY "Recorders can update own matches"
  ON public.liga_matches FOR UPDATE
  TO authenticated
  USING (recorded_by = auth.uid())
  WITH CHECK (recorded_by = auth.uid());

-- 4. Admins can delete matches
CREATE POLICY "Admins can delete matches"
  ON public.liga_matches FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.liga_members
      WHERE liga_members.liga_id = liga_matches.liga_id
      AND liga_members.player_id = auth.uid()
      AND liga_members.role IN ('admin', 'owner')
    )
  );
