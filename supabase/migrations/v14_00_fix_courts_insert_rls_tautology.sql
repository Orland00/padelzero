-- P0-1 (Viktor 2.1, 2026-04-16): courts_insert_liga_admin had tautological join
-- l.club_id = l.club_id, letting any liga admin insert courts into any club.
-- Replace with club-ownership check.
--
-- Applied via Supabase migration name: fix_courts_insert_rls_tautology_p0

DROP POLICY IF EXISTS "courts_insert_liga_admin" ON public.courts;

CREATE POLICY "courts_insert_club_owner" ON public.courts
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.clubs c
    WHERE c.id = courts.club_id
      AND c.owner_user_id = auth.uid()
  )
);
