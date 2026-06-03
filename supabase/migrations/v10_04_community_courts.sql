-- Add community court support columns
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS court_type text DEFAULT 'club';
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS added_by uuid REFERENCES profiles(id);
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS claimed_by uuid REFERENCES profiles(id);
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE clubs ADD COLUMN IF NOT EXISTS hours text;

-- Allow any authenticated user to insert courts
CREATE POLICY "Authenticated users can add courts"
  ON clubs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Allow users to update courts they added (for community/public courts with no owner)
CREATE POLICY "Users can update courts they added"
  ON clubs FOR UPDATE
  USING (added_by = auth.uid())
  WITH CHECK (added_by = auth.uid());
