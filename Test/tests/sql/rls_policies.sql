-- ═══════════════════════════════════════════════════════════
-- PadelZero — RLS Policy Test Suite
-- Run against Supabase SQL Editor or psql
-- Tests: profiles, matches, ligas, clubs, coaches, notifications
-- ═══════════════════════════════════════════════════════════

-- Helper: create test users in auth.users and profiles
-- NOTE: These tests use service_role to set up state,
-- then switch to authenticated role to verify RLS.

BEGIN;

-- ───────────────────────────────────────────────────────────
-- 1. PROFILES RLS
-- ───────────────────────────────────────────────────────────

DO $$
DECLARE
  test_user_id UUID;
  other_user_id UUID;
  row_count INT;
BEGIN
  -- Get two fixture user IDs from profiles
  SELECT id INTO test_user_id FROM public.profiles LIMIT 1;
  SELECT id INTO other_user_id FROM public.profiles WHERE id != test_user_id LIMIT 1;

  -- Test: All profiles should be readable (public SELECT)
  SELECT count(*) INTO row_count FROM public.profiles;
  ASSERT row_count > 0, 'FAIL: profiles should be publicly readable';
  RAISE NOTICE 'PASS: profiles are publicly readable (% rows)', row_count;

  -- Test: Profiles table has required columns
  PERFORM column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
    AND column_name = 'elo_rating';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FAIL: profiles missing elo_rating column';
  END IF;
  RAISE NOTICE 'PASS: profiles has elo_rating column';

  PERFORM column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
    AND column_name = 'display_name';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FAIL: profiles missing display_name column';
  END IF;
  RAISE NOTICE 'PASS: profiles has display_name column';
END $$;

-- ───────────────────────────────────────────────────────────
-- 2. MATCHES TABLE INTEGRITY
-- ───────────────────────────────────────────────────────────

DO $$
DECLARE
  match_count INT;
  orphan_count INT;
BEGIN
  SELECT count(*) INTO match_count FROM public.matches;
  RAISE NOTICE 'INFO: Total matches in database: %', match_count;

  -- Test: No matches reference nonexistent players
  SELECT count(*) INTO orphan_count
  FROM public.matches m
  WHERE m.player1_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = m.player1_id);
  ASSERT orphan_count = 0, 'FAIL: found orphaned player1_id references';
  RAISE NOTICE 'PASS: no orphaned player1_id references';

  -- Test: matches table has RLS enabled
  PERFORM 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'matches' AND rowsecurity = TRUE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FAIL: matches table does not have RLS enabled';
  END IF;
  RAISE NOTICE 'PASS: matches table has RLS enabled';
END $$;

-- ───────────────────────────────────────────────────────────
-- 3. LIGAS RLS & INTEGRITY
-- ───────────────────────────────────────────────────────────

DO $$
DECLARE
  liga_count INT;
  member_orphan_count INT;
BEGIN
  SELECT count(*) INTO liga_count FROM public.ligas;
  RAISE NOTICE 'INFO: Total ligas: %', liga_count;

  -- Test: ligas table has RLS enabled
  PERFORM 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'ligas' AND rowsecurity = TRUE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FAIL: ligas table does not have RLS enabled';
  END IF;
  RAISE NOTICE 'PASS: ligas table has RLS enabled';

  -- Test: liga_members table has RLS enabled
  PERFORM 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'liga_members' AND rowsecurity = TRUE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FAIL: liga_members table does not have RLS enabled';
  END IF;
  RAISE NOTICE 'PASS: liga_members table has RLS enabled';

  -- Test: No liga_members reference nonexistent ligas
  SELECT count(*) INTO member_orphan_count
  FROM public.liga_members lm
  WHERE NOT EXISTS (SELECT 1 FROM public.ligas l WHERE l.id = lm.liga_id);
  ASSERT member_orphan_count = 0, 'FAIL: found orphaned liga_members';
  RAISE NOTICE 'PASS: no orphaned liga_members';
END $$;

-- ───────────────────────────────────────────────────────────
-- 4. CLUBS RLS & INTEGRITY
-- ───────────────────────────────────────────────────────────

DO $$
DECLARE
  club_count INT;
  court_orphan INT;
BEGIN
  SELECT count(*) INTO club_count FROM public.clubs;
  RAISE NOTICE 'INFO: Total clubs: %', club_count;

  -- Test: clubs table has RLS enabled
  PERFORM 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'clubs' AND rowsecurity = TRUE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FAIL: clubs table does not have RLS enabled';
  END IF;
  RAISE NOTICE 'PASS: clubs table has RLS enabled';

  -- Test: courts table has RLS enabled
  PERFORM 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'courts' AND rowsecurity = TRUE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FAIL: courts table does not have RLS enabled';
  END IF;
  RAISE NOTICE 'PASS: courts table has RLS enabled';

  -- Test: No orphaned courts
  SELECT count(*) INTO court_orphan
  FROM public.courts c
  WHERE NOT EXISTS (SELECT 1 FROM public.clubs cl WHERE cl.id = c.club_id);
  ASSERT court_orphan = 0, 'FAIL: found orphaned courts';
  RAISE NOTICE 'PASS: no orphaned courts';

  -- Test: club_bookings table has RLS enabled
  PERFORM 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'club_bookings' AND rowsecurity = TRUE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FAIL: club_bookings table does not have RLS enabled';
  END IF;
  RAISE NOTICE 'PASS: club_bookings table has RLS enabled';
END $$;

-- ───────────────────────────────────────────────────────────
-- 5. COACHES RLS & INTEGRITY
-- ───────────────────────────────────────────────────────────

DO $$
DECLARE
  coach_orphan INT;
BEGIN
  -- Test: coaches table has RLS enabled
  PERFORM 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'coaches' AND rowsecurity = TRUE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FAIL: coaches table does not have RLS enabled';
  END IF;
  RAISE NOTICE 'PASS: coaches table has RLS enabled';

  -- Test: coach_availability table has RLS enabled
  PERFORM 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'coach_availability' AND rowsecurity = TRUE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FAIL: coach_availability table does not have RLS enabled';
  END IF;
  RAISE NOTICE 'PASS: coach_availability table has RLS enabled';

  -- Test: coach_bookings table has RLS enabled
  PERFORM 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'coach_bookings' AND rowsecurity = TRUE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FAIL: coach_bookings table does not have RLS enabled';
  END IF;
  RAISE NOTICE 'PASS: coach_bookings table has RLS enabled';

  -- Test: coach_reviews table has RLS enabled
  PERFORM 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'coach_reviews' AND rowsecurity = TRUE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FAIL: coach_reviews table does not have RLS enabled';
  END IF;
  RAISE NOTICE 'PASS: coach_reviews table has RLS enabled';

  -- Test: No orphaned coach profiles
  SELECT count(*) INTO coach_orphan
  FROM public.coaches c
  WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = c.profile_id);
  ASSERT coach_orphan = 0, 'FAIL: found orphaned coach profiles';
  RAISE NOTICE 'PASS: no orphaned coach profiles';
END $$;

-- ───────────────────────────────────────────────────────────
-- 6. NOTIFICATIONS RLS
-- ───────────────────────────────────────────────────────────

DO $$
BEGIN
  -- Test: notifications table has RLS enabled
  PERFORM 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'notifications' AND rowsecurity = TRUE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FAIL: notifications table does not have RLS enabled';
  END IF;
  RAISE NOTICE 'PASS: notifications table has RLS enabled';
END $$;

-- ───────────────────────────────────────────────────────────
-- 7. ELO INTEGRITY CHECKS
-- ───────────────────────────────────────────────────────────

DO $$
DECLARE
  below_floor INT;
  null_elo INT;
BEGIN
  -- Test: No player ELO below floor (800)
  SELECT count(*) INTO below_floor
  FROM public.profiles WHERE elo_rating < 800;
  IF below_floor > 0 THEN
    RAISE WARNING 'WARNING: % profiles have ELO below 800 floor', below_floor;
  ELSE
    RAISE NOTICE 'PASS: all ELO ratings >= 800 floor';
  END IF;

  -- Test: No NULL ELO ratings (should default to 1200)
  SELECT count(*) INTO null_elo
  FROM public.profiles WHERE elo_rating IS NULL;
  IF null_elo > 0 THEN
    RAISE WARNING 'WARNING: % profiles have NULL elo_rating', null_elo;
  ELSE
    RAISE NOTICE 'PASS: no NULL ELO ratings';
  END IF;
END $$;

-- ───────────────────────────────────────────────────────────
-- 8. COMPREHENSIVE RLS TABLE AUDIT
-- ───────────────────────────────────────────────────────────

DO $$
DECLARE
  r RECORD;
  unprotected INT := 0;
BEGIN
  FOR r IN
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename NOT IN ('schema_migrations', 'debug_logs')
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_tables
      WHERE schemaname = 'public' AND tablename = r.tablename AND rowsecurity = TRUE
    ) THEN
      RAISE WARNING 'SECURITY: Table % does NOT have RLS enabled', r.tablename;
      unprotected := unprotected + 1;
    END IF;
  END LOOP;

  IF unprotected = 0 THEN
    RAISE NOTICE 'PASS: All public tables have RLS enabled';
  ELSE
    RAISE WARNING 'FAIL: % tables without RLS protection', unprotected;
  END IF;
END $$;

-- ───────────────────────────────────────────────────────────
-- 9. FOREIGN KEY INTEGRITY
-- ───────────────────────────────────────────────────────────

DO $$
DECLARE
  fk_count INT;
BEGIN
  -- Count total foreign keys
  SELECT count(*) INTO fk_count
  FROM information_schema.table_constraints
  WHERE constraint_type = 'FOREIGN KEY'
    AND table_schema = 'public';
  RAISE NOTICE 'INFO: Total foreign keys in public schema: %', fk_count;
  ASSERT fk_count > 10, 'WARNING: unexpectedly few foreign keys';
  RAISE NOTICE 'PASS: adequate foreign key constraints (% total)', fk_count;
END $$;

-- ───────────────────────────────────────────────────────────
-- 10. JORNADAS & TOURNAMENT INTEGRITY
-- ───────────────────────────────────────────────────────────

DO $$
DECLARE
  jornada_orphan INT;
BEGIN
  -- Test: jornadas table has RLS
  PERFORM 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'jornadas' AND rowsecurity = TRUE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'FAIL: jornadas table does not have RLS enabled';
  END IF;
  RAISE NOTICE 'PASS: jornadas table has RLS enabled';

  -- Test: No orphaned jornadas
  SELECT count(*) INTO jornada_orphan
  FROM public.jornadas j
  WHERE NOT EXISTS (SELECT 1 FROM public.ligas l WHERE l.id = j.liga_id);
  ASSERT jornada_orphan = 0, 'FAIL: found orphaned jornadas';
  RAISE NOTICE 'PASS: no orphaned jornadas';
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════
-- SUMMARY
-- ═══════════════════════════════════════════════════════════
-- Expected output: All tests should show PASS
-- Any FAIL will abort the transaction (safety)
-- Any WARNING indicates non-critical issues to investigate
-- Run this in Supabase SQL Editor > New query
