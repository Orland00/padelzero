-- 2026-04-16: Self-hosted error tracking replaces Sentry.
-- Browser-side reportError() writes to this table via RLS-allowed INSERT.
-- Operators query via Supabase SQL Editor (service_role).
--
-- Applied via migration name: client_errors_self_hosted_tracking

CREATE TABLE IF NOT EXISTS public.client_errors (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  url          text,
  message      text NOT NULL,
  stack        text,
  user_agent   text,
  release_sha  text,
  context      jsonb,
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_client_errors_created_at
  ON public.client_errors(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_client_errors_user_created
  ON public.client_errors(user_id, created_at DESC);

-- Rate limiter: 30 inserts/hour per user (or per UA for anon-prevented now)
CREATE OR REPLACE FUNCTION public.rate_limit_client_errors()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_recent integer;
BEGIN
  SELECT count(*) INTO v_recent
  FROM public.client_errors
  WHERE created_at > now() - INTERVAL '1 hour'
    AND (
      (NEW.user_id IS NOT NULL AND user_id = NEW.user_id)
      OR (NEW.user_id IS NULL AND user_agent IS NOT DISTINCT FROM NEW.user_agent)
    );
  IF v_recent >= 30 THEN
    RAISE EXCEPTION 'client_errors rate limit: 30/hour';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rate_limit_client_errors ON public.client_errors;
CREATE TRIGGER trg_rate_limit_client_errors
  BEFORE INSERT ON public.client_errors
  FOR EACH ROW EXECUTE FUNCTION public.rate_limit_client_errors();

ALTER TABLE public.client_errors ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS client_errors_insert_any ON public.client_errors;
DROP POLICY IF EXISTS client_errors_select_service ON public.client_errors;

CREATE POLICY client_errors_insert_any ON public.client_errors
  FOR INSERT TO authenticated, anon
  WITH CHECK (
    user_id IS NULL
    OR user_id = (select auth.uid())
  );

CREATE POLICY client_errors_select_service ON public.client_errors
  FOR SELECT TO service_role
  USING (true);
