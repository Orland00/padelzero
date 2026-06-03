-- ═══════════════════════════════════════════════════════════
-- v14_08 — Fix F5 HIGH: profiles PII exposed to anon
-- ═══════════════════════════════════════════════════════════
-- Audit report: 02_security_pentest.md F5 (VERIFIED by reality-check A8 row 15)
-- Vulnerability: policy "Anyone can read profiles" has qual=true and
-- roles=[public] — anon key (sb_publishable_*) can SELECT all rows of
-- public.profiles, including PII columns: email, phone, age, gender, city.
-- Impact: LGPD / LFPDPPP (Mexico) / GDPR data exposure. Scrapeable via
-- REST API with only the public anon key.
--
-- Fix strategy: restrict SELECT to the `authenticated` role. All in-app
-- reads (`src/stores/`, `src/pages/`) already require an authenticated
-- session (routes live inside <ProtectedRoute>), so no UX regression.
-- Service role (backend) bypasses RLS entirely — unaffected.
--
-- Impact assessment (grep of src/, 2026-04-17):
-- • 30 `.from('profiles')` call sites across src/
-- • All are behind <ProtectedRoute> (App.jsx:163-204) or inside authStore
--   post-session-validation (authStore.js lines 26/62/102/140)
-- • No anon-context reads of profiles identified
-- • Search-engine crawl risk: zero, because routes require auth anyway

BEGIN;

-- Drop the overly-permissive public-read policy.
DROP POLICY IF EXISTS "Anyone can read profiles" ON public.profiles;

-- Recreate as authenticated-only.
CREATE POLICY "Authenticated users can read profiles"
  ON public.profiles
  FOR SELECT
  TO authenticated
  USING (true);

COMMIT;

-- ═══════════════════════════════════════════════════════════
-- Rollback (manual, emergency only — re-opens LGPD hole):
--   DROP POLICY IF EXISTS "Authenticated users can read profiles" ON public.profiles;
--   CREATE POLICY "Anyone can read profiles"
--     ON public.profiles FOR SELECT TO public USING (true);
-- ═══════════════════════════════════════════════════════════
