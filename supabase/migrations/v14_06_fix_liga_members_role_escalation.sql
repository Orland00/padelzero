-- ═══════════════════════════════════════════════════════════
-- v14_06 — Fix F1 CRITICAL: liga_members privilege escalation
-- ═══════════════════════════════════════════════════════════
-- Audit report: 02_security_pentest.md F1 (VERIFIED by reality-check A8 row 13)
-- Vulnerability: Two UPDATE policies on public.liga_members allow a member
-- to UPDATE their own row without pinning `role`:
--   1. "Users can accept their own invites" — with_check limits status but not role
--   2. "Members can update own team name" — with_check only pins player_id = auth.uid()
-- Attack: any authenticated member runs:
--   UPDATE liga_members SET role='admin' WHERE player_id = auth.uid();
-- Impact: full liga admin privileges across any liga the attacker belongs to.
--
-- Fix strategy: BEFORE UPDATE OF role trigger. Only fires when `role` appears
-- in the SET clause. If OLD.role = NEW.role → allow (no-op). Else require caller
-- to be admin/owner of the same liga. Service-role context (auth.uid() IS NULL)
-- bypasses — backend code is trusted (e.g., admin RPCs via service_role key).
-- This is defense-in-depth: existing policies still apply; the trigger catches
-- role changes regardless of which policy path was used.

BEGIN;

-- Trigger function
CREATE OR REPLACE FUNCTION public.prevent_liga_members_role_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Service-role or backend context: auth.uid() is NULL, trust it.
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  -- No role change: pass-through.
  IF OLD.role IS NOT DISTINCT FROM NEW.role THEN
    RETURN NEW;
  END IF;

  -- Role is changing. Caller must be admin/owner of this liga.
  IF NOT EXISTS (
    SELECT 1
    FROM public.liga_members admin
    WHERE admin.liga_id = NEW.liga_id
      AND admin.player_id = auth.uid()
      AND admin.role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'role changes require admin/owner privileges on this liga'
      USING ERRCODE = '42501'; -- insufficient_privilege
  END IF;

  RETURN NEW;
END;
$$;

-- Drop trigger if re-running the migration locally
DROP TRIGGER IF EXISTS liga_members_prevent_role_escalation ON public.liga_members;

-- Fire only when `role` is in the SET clause; BEFORE so we can veto via RAISE.
CREATE TRIGGER liga_members_prevent_role_escalation
BEFORE UPDATE OF role ON public.liga_members
FOR EACH ROW
EXECUTE FUNCTION public.prevent_liga_members_role_escalation();

-- Lock down function privileges: only postgres/service_role should call directly.
-- Trigger execution bypasses normal GRANT checks, so this is just for hygiene.
REVOKE ALL ON FUNCTION public.prevent_liga_members_role_escalation() FROM PUBLIC;

COMMIT;

-- ═══════════════════════════════════════════════════════════
-- Rollback (manual):
--   DROP TRIGGER IF EXISTS liga_members_prevent_role_escalation ON public.liga_members;
--   DROP FUNCTION IF EXISTS public.prevent_liga_members_role_escalation();
-- ═══════════════════════════════════════════════════════════
