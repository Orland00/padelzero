-- Fix clubs INSERT RLS: require added_by to match the calling user
-- Previously the policy allowed any authenticated user to insert with any added_by value.

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Authenticated users can add courts" ON clubs;

-- Replace with one that requires added_by to match caller (or be NULL)
CREATE POLICY "Authenticated users can add courts with ownership"
  ON clubs FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND (added_by = auth.uid() OR added_by IS NULL));
