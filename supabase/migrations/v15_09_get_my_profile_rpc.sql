-- ═══════════════════════════════════════════════════════════
-- v15_09 — get_my_profile() SECURITY DEFINER RPC
-- Returns the full profiles row (including PII columns withheld
-- by v15_08b) for the currently authenticated user.
-- Used by authStore instead of from('profiles').select('*').
-- Updated: 2026-05-08
-- ═══════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS SETOF public.profiles
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;
  RETURN QUERY SELECT * FROM public.profiles WHERE id = auth.uid();
END;
$$;

REVOKE ALL ON FUNCTION public.get_my_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;

NOTIFY pgrst, 'reload schema';
