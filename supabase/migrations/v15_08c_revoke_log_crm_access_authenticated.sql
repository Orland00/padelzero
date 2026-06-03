-- ═══════════════════════════════════════════════════════════
-- v15_08c — Revoke EXECUTE on log_crm_access from authenticated
-- REVOKE FROM PUBLIC in v15_08 did not cover the direct grant
-- to authenticated that Supabase applies via
-- GRANT ALL ON ALL FUNCTIONS TO authenticated.
-- Updated: 2026-05-07
-- ═══════════════════════════════════════════════════════════

REVOKE EXECUTE ON FUNCTION public.log_crm_access(uuid, text, uuid) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.log_crm_access(uuid, text, uuid) FROM anon;
-- service_role retains EXECUTE (granted in v15_08)

NOTIFY pgrst, 'reload schema';
