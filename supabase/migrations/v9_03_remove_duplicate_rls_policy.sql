-- ═══════════════════════════════════════════════════════════
-- V9-03: REMOVE DUPLICATE RLS POLICIES
-- ═══════════════════════════════════════════════════════════

-- Remove old/duplicate RLS policies that were conflicting
DROP POLICY IF EXISTS "liga_matches_insert" ON public.liga_matches;
DROP POLICY IF EXISTS "liga_matches_select" ON public.liga_matches;
DROP POLICY IF EXISTS "liga_matches_update" ON public.liga_matches;
DROP POLICY IF EXISTS "liga_matches_delete" ON public.liga_matches;
