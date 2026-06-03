-- Feature interest tracking for upcoming features
CREATE TABLE IF NOT EXISTS public.feature_interests (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key TEXT NOT NULL,
  user_id     UUID NOT NULL REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(feature_key, user_id)
);

CREATE INDEX IF NOT EXISTS idx_feature_interests_key
  ON public.feature_interests (feature_key);

ALTER TABLE public.feature_interests ENABLE ROW LEVEL SECURITY;

-- Users can insert their own interest
CREATE POLICY "interests_insert_own"
  ON public.feature_interests FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can read their own (to show filled state)
CREATE POLICY "interests_read_own"
  ON public.feature_interests FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Service role can read all (for admin view)
CREATE POLICY "interests_service_read"
  ON public.feature_interests FOR SELECT
  TO service_role
  USING (TRUE);

NOTIFY pgrst, 'reload schema';
