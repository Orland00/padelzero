-- ═══════════════════════════════════════════════════════════
-- V9-04: ALLOW ADMIN TO ADD MEMBERS TO LIGA
-- ═══════════════════════════════════════════════════════════

-- Drop the restrictive INSERT policy that only allows self-join
DROP POLICY IF EXISTS "Users can join ligas" ON public.liga_members;

-- Create a new policy that allows:
-- 1. Users to join themselves (self-join)
-- 2. Liga admins to add other members
CREATE POLICY "Users can join or admins can add to ligas"
  ON public.liga_members FOR INSERT
  WITH CHECK (
    -- User can add themselves
    auth.uid() = player_id
    OR
    -- Admin can add anyone to their liga
    EXISTS (
      SELECT 1 FROM public.liga_members admin
      WHERE admin.liga_id = liga_members.liga_id
      AND admin.player_id = auth.uid()
      AND admin.role IN ('admin', 'owner')
    )
  );
