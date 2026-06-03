-- ═══════════════════════════════════════════════════════════
-- PadelZero — Phase 1 Security Verification
-- ═══════════════════════════════════════════════════════════
-- Re-runnable verification for migrations v14_06/07/08.
-- Run against Supabase SQL editor or psql as service_role.
-- Each DO block must print PASS; any FAIL aborts the script.

-- ───────────────────────────────────────────────────────────
-- C1 — F1 CRITICAL: liga_members role-escalation guard
-- ───────────────────────────────────────────────────────────
DO $$
DECLARE
  has_trigger BOOL;
  has_func BOOL;
  trigger_def TEXT;
BEGIN
  -- Trigger must exist and target `role` column only
  SELECT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgrelid='public.liga_members'::regclass
      AND tgname='liga_members_prevent_role_escalation'
  ) INTO has_trigger;
  ASSERT has_trigger, 'FAIL C1: trigger liga_members_prevent_role_escalation not installed';

  SELECT pg_get_triggerdef(oid) INTO trigger_def
  FROM pg_trigger
  WHERE tgrelid='public.liga_members'::regclass
    AND tgname='liga_members_prevent_role_escalation';
  ASSERT trigger_def LIKE '%BEFORE UPDATE OF role%',
    'FAIL C1: trigger must fire BEFORE UPDATE OF role, got: ' || trigger_def;

  -- Function must exist, be SECURITY DEFINER, pin search_path
  SELECT EXISTS (
    SELECT 1 FROM pg_proc
    WHERE proname='prevent_liga_members_role_escalation'
      AND pronamespace='public'::regnamespace
      AND prosecdef = true
      AND proconfig @> ARRAY['search_path=public, pg_temp']
  ) INTO has_func;
  ASSERT has_func, 'FAIL C1: function prevent_liga_members_role_escalation missing or misconfigured';

  RAISE NOTICE 'PASS C1: liga_members role-escalation guard installed correctly';
END $$;

-- ───────────────────────────────────────────────────────────
-- C6 — F2 HIGH: mark_notifications_read uses auth.uid()
-- ───────────────────────────────────────────────────────────
DO $$
DECLARE
  fn_body TEXT;
BEGIN
  SELECT pg_get_functiondef(oid) INTO fn_body
  FROM pg_proc
  WHERE proname='mark_notifications_read'
    AND pronamespace='public'::regnamespace;

  ASSERT fn_body IS NOT NULL, 'FAIL C6: mark_notifications_read function missing';
  ASSERT fn_body LIKE '%auth.uid()%', 'FAIL C6: function must reference auth.uid()';
  ASSERT fn_body LIKE '%cannot mark notifications for another user%',
    'FAIL C6: missing caller-mismatch RAISE EXCEPTION';
  ASSERT fn_body LIKE '%recipient_id = caller%',
    'FAIL C6: update must use caller, not parameter';

  RAISE NOTICE 'PASS C6: mark_notifications_read locked to auth.uid()';
END $$;

-- ───────────────────────────────────────────────────────────
-- C7 — F5 HIGH: profiles SELECT restricted to authenticated
-- ───────────────────────────────────────────────────────────
DO $$
DECLARE
  anon_policy_exists BOOL;
  auth_policy_roles TEXT[];
BEGIN
  -- Old "Anyone can read profiles" must be gone
  SELECT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='profiles'
      AND policyname='Anyone can read profiles'
  ) INTO anon_policy_exists;
  ASSERT NOT anon_policy_exists, 'FAIL C7: "Anyone can read profiles" policy still exists';

  -- New policy must exist and target authenticated only
  SELECT roles INTO auth_policy_roles
  FROM pg_policies
  WHERE schemaname='public' AND tablename='profiles'
    AND policyname='Authenticated users can read profiles';
  ASSERT auth_policy_roles IS NOT NULL,
    'FAIL C7: "Authenticated users can read profiles" policy missing';
  ASSERT 'authenticated' = ANY (auth_policy_roles),
    'FAIL C7: policy must target authenticated role, got: ' || auth_policy_roles::text;
  ASSERT NOT ('anon' = ANY (auth_policy_roles)),
    'FAIL C7: policy leaks to anon role';
  ASSERT NOT ('public' = ANY (auth_policy_roles)),
    'FAIL C7: policy leaks to public role (includes anon)';

  RAISE NOTICE 'PASS C7: profiles SELECT restricted to authenticated';
END $$;

-- ───────────────────────────────────────────────────────────
-- Posture sanity — RLS still enabled on all public tables
-- ───────────────────────────────────────────────────────────
DO $$
DECLARE
  missing_rls INT;
BEGIN
  SELECT count(*) INTO missing_rls
  FROM pg_tables
  WHERE schemaname='public' AND rowsecurity=false;
  ASSERT missing_rls = 0,
    format('FAIL: %s public tables have RLS disabled', missing_rls);
  RAISE NOTICE 'PASS: all public tables still have RLS enabled';
END $$;

-- ═══════════════════════════════════════════════════════════
-- If you see all PASS messages above, Phase 1 DB fixes are green.
-- ═══════════════════════════════════════════════════════════
