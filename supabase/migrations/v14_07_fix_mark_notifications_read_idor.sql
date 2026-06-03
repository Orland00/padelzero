-- ═══════════════════════════════════════════════════════════
-- v14_07 — Fix F2 HIGH: mark_notifications_read IDOR
-- ═══════════════════════════════════════════════════════════
-- Audit report: 02_security_pentest.md F2 (VERIFIED by reality-check A8 row 14)
-- Vulnerability: the function's parameter `user_id` is used directly in the
-- WHERE clause; auth.uid() is IGNORED. Any authenticated user can mark ANY
-- other user's notifications as read:
--   SELECT public.mark_notifications_read('<victim-uuid>');
-- Impact: griefing + hides security signals (e.g., "someone joined your liga")
--
-- Fix: rewrite the body to use auth.uid() internally. Keep the parameter
-- for backward compat but REJECT if the caller's auth.uid() differs from
-- the passed user_id. Service-role (auth.uid() IS NULL) is allowed to
-- operate on any user (for admin/backend tasks).

BEGIN;

CREATE OR REPLACE FUNCTION public.mark_notifications_read(user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  caller uuid := auth.uid();
BEGIN
  -- Service role or backend context: auth.uid() NULL → trust the caller's user_id.
  IF caller IS NULL THEN
    UPDATE public.notifications
    SET is_read = true, updated_at = now()
    WHERE recipient_id = user_id AND is_read = false;
    RETURN;
  END IF;

  -- Authenticated user: caller must match the user_id parameter.
  IF caller <> user_id THEN
    RAISE EXCEPTION 'cannot mark notifications for another user'
      USING ERRCODE = '42501'; -- insufficient_privilege
  END IF;

  UPDATE public.notifications
  SET is_read = true, updated_at = now()
  WHERE recipient_id = caller AND is_read = false;
END;
$$;

COMMIT;

-- ═══════════════════════════════════════════════════════════
-- Rollback (manual):
--   CREATE OR REPLACE FUNCTION public.mark_notifications_read(user_id uuid)
--   RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
--   BEGIN
--     UPDATE public.notifications SET is_read = true, updated_at = now()
--     WHERE recipient_id = user_id AND is_read = false;
--   END;
--   $$;
-- (This was the vulnerable pre-fix body — DO NOT REVERT unless emergency.)
-- ═══════════════════════════════════════════════════════════
