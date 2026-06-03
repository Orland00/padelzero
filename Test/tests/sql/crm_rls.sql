-- ═══════════════════════════════════════════════════════════
-- CRM RLS Privacy Guard Tests (pgTAP)
-- Run via: supabase test db
-- Tests:
--   1. Coach isolation: coach_alfa sees only their notes
--   2. Write-forgery blocked: coach_alfa cannot insert as coach_beta
--   3. Player conditional read: sees only is_shared=true notes
--   4. Anonymous access: sees nothing
-- Updated: 2026-05-07
-- ═══════════════════════════════════════════════════════════

BEGIN;

SELECT plan(6);

-- ─── Structural checks ───────────────────────────────────────────────────────

SELECT has_table('public', 'crm_notes',
  'crm_notes table must exist');

SELECT policies_are('public', 'crm_notes',
  ARRAY['crm_notes_select', 'crm_notes_insert', 'crm_notes_update', 'crm_notes_delete'],
  'crm_notes must have exactly 4 RLS policies');

-- ─── Test setup ──────────────────────────────────────────────────────────────

SELECT tests.create_supabase_user('coach_alfa');
SELECT tests.create_supabase_user('coach_beta');
SELECT tests.create_supabase_user('player_omega');

-- Insert test notes bypassing RLS (service role context)
INSERT INTO public.crm_notes (id, author_id, target_id, content, tags, is_shared)
VALUES
  ('a0000000-0000-0000-0000-000000000001',
   tests.get_supabase_uid('coach_alfa'),
   tests.get_supabase_uid('player_omega'),
   'Private note from alfa', ARRAY['bandeja'], false),

  ('a0000000-0000-0000-0000-000000000002',
   tests.get_supabase_uid('coach_alfa'),
   tests.get_supabase_uid('player_omega'),
   'Shared note from alfa', ARRAY['vibora'], true),

  ('b0000000-0000-0000-0000-000000000003',
   tests.get_supabase_uid('coach_beta'),
   tests.get_supabase_uid('player_omega'),
   'Note from beta (hidden)', ARRAY['smash'], false);

-- ─── Test 1: Coach alfa sees only their notes ─────────────────────────────

SELECT tests.authenticate_as('coach_alfa');
SELECT results_eq(
  'SELECT COUNT(*)::int FROM public.crm_notes',
  ARRAY[2],
  'coach_alfa sees exactly 2 notes (their own only)'
);
SELECT tests.clear_authentication();

-- ─── Test 2: Write-forgery blocked ───────────────────────────────────────

SELECT tests.authenticate_as('coach_alfa');
SELECT throws_ok(
  $$INSERT INTO public.crm_notes (author_id, target_id, content)
    VALUES (tests.get_supabase_uid('coach_beta'),
            tests.get_supabase_uid('player_omega'),
            'Forged note')$$,
  'new row violates row-level security policy for table "crm_notes"',
  'RLS must block author_id forgery'
);
SELECT tests.clear_authentication();

-- ─── Test 3: Player sees only shared notes ────────────────────────────────

SELECT tests.authenticate_as('player_omega');
SELECT results_eq(
  'SELECT COUNT(*)::int FROM public.crm_notes',
  ARRAY[1],
  'player_omega sees only the 1 note with is_shared=true'
);
SELECT tests.clear_authentication();

-- ─── Test 4: Anonymous sees nothing ──────────────────────────────────────

SELECT results_eq(
  'SELECT COUNT(*)::int FROM public.crm_notes',
  ARRAY[0],
  'Unauthenticated request sees 0 crm_notes rows'
);

SELECT * FROM finish();
ROLLBACK;
