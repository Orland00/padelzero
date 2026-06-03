-- ═══════════════════════════════════════════════════════════
-- V7-04: Fix liga_standings INSERT/UPDATE for active members
-- Problem: Only admins could update standings (from v7_02 policy).
--          This caused ELO updates to silently fail when a non-admin
--          member recorded a match.
-- ═══════════════════════════════════════════════════════════

-- Drop the overly-restrictive admin-only ALL policy
DROP POLICY IF EXISTS "liga_standings_admin_all" ON public.liga_standings;
DROP POLICY IF EXISTS "Admin can manage standings" ON public.liga_standings;

-- Keep public read (already exists from v7_02, but be safe)
DROP POLICY IF EXISTS "Anyone can read standings" ON public.liga_standings;
DROP POLICY IF EXISTS "liga_standings_select" ON public.liga_standings;

-- Re-create read: anyone can see standings
CREATE POLICY "liga_standings_select"
  ON public.liga_standings FOR SELECT
  USING (true);

-- Admins can do everything (manage other players' rows)
CREATE POLICY "liga_standings_admin_all"
  ON public.liga_standings FOR ALL
  USING (public.is_liga_admin(liga_id, auth.uid()));

-- Active members can upsert their OWN standing row
CREATE POLICY "liga_standings_member_upsert"
  ON public.liga_standings FOR INSERT
  TO authenticated
  WITH CHECK (
    player_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.liga_members
      WHERE liga_members.liga_id = liga_standings.liga_id
        AND liga_members.player_id = auth.uid()
        AND liga_members.status = 'active'
    )
  );

CREATE POLICY "liga_standings_member_update"
  ON public.liga_standings FOR UPDATE
  TO authenticated
  USING (
    player_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.liga_members
      WHERE liga_members.liga_id = liga_standings.liga_id
        AND liga_members.player_id = auth.uid()
        AND liga_members.status = 'active'
    )
  );

-- ═══════════════════════════════════════════════════════════
-- Also fix liga_matches and liga_pair_stats:
-- Only ACTIVE members can insert/update (not pending/rejected)
-- This ensures the pattern applies to ALL future ligas automatically.
-- ═══════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "liga_matches_insert" ON public.liga_matches;
CREATE POLICY "liga_matches_insert"
  ON public.liga_matches FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.liga_members
      WHERE liga_members.liga_id = liga_matches.liga_id
        AND liga_members.player_id = auth.uid()
        AND liga_members.status = 'active'
    )
  );

DROP POLICY IF EXISTS "liga_pair_stats_insert" ON public.liga_pair_stats;
DROP POLICY IF EXISTS "liga_pair_stats_update" ON public.liga_pair_stats;

CREATE POLICY "liga_pair_stats_insert"
  ON public.liga_pair_stats FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.liga_members
      WHERE liga_members.liga_id = liga_pair_stats.liga_id
        AND liga_members.player_id = auth.uid()
        AND liga_members.status = 'active'
    )
  );

CREATE POLICY "liga_pair_stats_update"
  ON public.liga_pair_stats FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.liga_members
      WHERE liga_members.liga_id = liga_pair_stats.liga_id
        AND liga_members.player_id = auth.uid()
        AND liga_members.status = 'active'
    )
  );
