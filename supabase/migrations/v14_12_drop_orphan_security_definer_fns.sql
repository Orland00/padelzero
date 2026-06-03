-- ═══════════════════════════════════════════════════════════
-- v14_12 — Drop 8 orphan SECURITY DEFINER functions (06_dead_code.md §4)
-- ═══════════════════════════════════════════════════════════
-- Cross-verified zero callers via:
--   (a) grep .rpc('<name>') in src/ — zero matches
--   (b) pg_proc scan: no other function body references them
--   (c) pg_trigger: not wired as trigger handlers
--   (d) cron.job: not scheduled
--   (e) pg_policy: not used in RLS USING/WITH CHECK expressions
--
-- Note on mark_notifications_read: Phase 1 (v14_07) hardened this fn to
-- validate auth.uid(). Subsequent audit of src/ confirmed the frontend
-- uses direct UPDATE (notificationStore.js:92) through the RLS policy
-- "Users can update own notification read status" (recipient_id = auth.uid()).
-- So the RPC is redundant attack surface. Dropping achieves the same
-- security goal (no IDOR) by removing the function entirely.

BEGIN;

DROP FUNCTION IF EXISTS public.apply_forever_league_inactivity();
DROP FUNCTION IF EXISTS public.decrement_standing(uuid, uuid, integer, integer, integer);
DROP FUNCTION IF EXISTS public.mark_notifications_read(uuid);
DROP FUNCTION IF EXISTS public.reverse_match_elo(uuid, integer, boolean, uuid);
-- rls_auto_enable() KEPT — event trigger `ensure_rls` depends on it
-- (auto-enables RLS on new tables; audit missed this dependency)
DROP FUNCTION IF EXISTS public.update_match_elo(uuid, integer, integer, integer, integer, uuid);
DROP FUNCTION IF EXISTS public.update_tournament_elo(uuid, integer, integer, integer, integer, uuid);
DROP FUNCTION IF EXISTS public.get_user_club_ids(uuid);

COMMIT;

-- Rollback: not preserving original bodies. These are truly dead — if
-- future code needs any of them, write fresh with proper auth checks.
