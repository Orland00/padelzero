-- Add preferred_language to profiles for localized push notifications
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_language text DEFAULT 'es';
