-- ═══════════════════════════════════════════════════════════
-- V8-01: RLS policies for courts table
-- ═══════════════════════════════════════════════════════════

-- Enable RLS on courts table
ALTER TABLE public.courts ENABLE ROW LEVEL SECURITY;

-- Public read: anyone can see courts (useful for displaying league venues)
CREATE POLICY "courts_public_read"
  ON public.courts FOR SELECT
  USING (true);

-- Club admins can insert courts for their club
CREATE POLICY "courts_club_admin_insert"
  ON public.courts FOR INSERT
  TO authenticated
  WITH CHECK (
    -- User must be club admin
    EXISTS (
      SELECT 1 FROM public.clubs c
      WHERE c.id = clubs.id
        AND c.owner_user_id = auth.uid()
    )
  );

-- Club admins can update their own club's courts
CREATE POLICY "courts_club_admin_update"
  ON public.courts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clubs c
      WHERE c.id = courts.club_id
        AND c.owner_user_id = auth.uid()
    )
  );

-- Club admins can delete their own club's courts
CREATE POLICY "courts_club_admin_delete"
  ON public.courts FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.clubs c
      WHERE c.id = courts.club_id
        AND c.owner_user_id = auth.uid()
    )
  );

-- Keep existing ligas RLS policies (unchanged)
-- Keep existing liga_matches RLS policies (unchanged)
-- Keep existing liga_standings RLS policies (unchanged)
