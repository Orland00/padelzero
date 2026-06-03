-- Fix overly permissive RLS policies identified in architecture review
-- Addresses: notifications INSERT, jornada_participants INSERT/UPDATE,
-- liga_team_stats INSERT/UPDATE, courts INSERT bug

BEGIN;

-- ============================================================
-- 1. notifications: restrict INSERT to sender_id = auth.uid()
-- Previously: WITH CHECK (true) — anyone could insert notifications to any recipient
-- ============================================================
DROP POLICY IF EXISTS "notifications_insert" ON notifications;
DROP POLICY IF EXISTS "Users can create notifications" ON notifications;
CREATE POLICY "notifications_insert_sender_only" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = sender_id);

-- ============================================================
-- 2. jornada_participants: restrict to own player_id or liga admin
-- Previously: WITH CHECK (true) — any user could modify any liga's data
-- ============================================================
DROP POLICY IF EXISTS "jornada_participants_insert" ON jornada_participants;
DROP POLICY IF EXISTS "Authenticated users can insert jornada_participants" ON jornada_participants;
CREATE POLICY "jornada_participants_insert_restricted" ON jornada_participants
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = player_id
    OR EXISTS (
      SELECT 1 FROM jornadas j
      JOIN liga_members lm ON lm.liga_id = j.liga_id
      WHERE j.id = jornada_id
        AND lm.player_id = auth.uid()
        AND lm.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "jornada_participants_update" ON jornada_participants;
DROP POLICY IF EXISTS "Authenticated users can update jornada_participants" ON jornada_participants;
CREATE POLICY "jornada_participants_update_restricted" ON jornada_participants
  FOR UPDATE TO authenticated
  USING (
    auth.uid() = player_id
    OR EXISTS (
      SELECT 1 FROM jornadas j
      JOIN liga_members lm ON lm.liga_id = j.liga_id
      WHERE j.id = jornada_id
        AND lm.player_id = auth.uid()
        AND lm.role = 'admin'
    )
  )
  WITH CHECK (
    auth.uid() = player_id
    OR EXISTS (
      SELECT 1 FROM jornadas j
      JOIN liga_members lm ON lm.liga_id = j.liga_id
      WHERE j.id = jornada_id
        AND lm.player_id = auth.uid()
        AND lm.role = 'admin'
    )
  );

-- ============================================================
-- 3. liga_team_stats: restrict to liga members
-- Previously: WITH CHECK (true) — fully open INSERT/UPDATE
-- ============================================================
DROP POLICY IF EXISTS "liga_team_stats_insert" ON liga_team_stats;
DROP POLICY IF EXISTS "Authenticated users can insert liga_team_stats" ON liga_team_stats;
CREATE POLICY "liga_team_stats_insert_members" ON liga_team_stats
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM liga_members lm
      WHERE lm.liga_id = liga_team_stats.liga_id
        AND lm.player_id = auth.uid()
        AND (lm.is_active = true OR lm.status = 'active')
    )
  );

DROP POLICY IF EXISTS "liga_team_stats_update" ON liga_team_stats;
DROP POLICY IF EXISTS "Authenticated users can update liga_team_stats" ON liga_team_stats;
CREATE POLICY "liga_team_stats_update_members" ON liga_team_stats
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM liga_members lm
      WHERE lm.liga_id = liga_team_stats.liga_id
        AND lm.player_id = auth.uid()
        AND (lm.is_active = true OR lm.status = 'active')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM liga_members lm
      WHERE lm.liga_id = liga_team_stats.liga_id
        AND lm.player_id = auth.uid()
        AND (lm.is_active = true OR lm.status = 'active')
    )
  );

-- ============================================================
-- 4. courts: fix INSERT policy bug
-- The original policy referenced clubs.owner_user_id which may not exist
-- in the live schema. Use liga admin check instead since courts are
-- managed through ligas, not directly through clubs.
-- ============================================================
DROP POLICY IF EXISTS "courts_insert" ON courts;
DROP POLICY IF EXISTS "Club owners can insert courts" ON courts;
CREATE POLICY "courts_insert_liga_admin" ON courts
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ligas l
      JOIN liga_members lm ON lm.liga_id = l.id
      WHERE l.club_id = club_id
        AND lm.player_id = auth.uid()
        AND lm.role IN ('admin', 'owner')
    )
  );

COMMIT;
