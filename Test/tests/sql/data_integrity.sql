-- ═══════════════════════════════════════════════════════════
-- PadelZero — Data Integrity & Functional Test Suite
-- Tests: match flow, liga lifecycle, club booking, coach flow
-- Run in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════════

BEGIN;

-- ───────────────────────────────────────────────────────────
-- 1. MATCH DATA CONSISTENCY
-- ───────────────────────────────────────────────────────────

DO $$
DECLARE
  total_matches INT;
  matches_with_scores INT;
  finished_no_winner INT;
BEGIN
  SELECT count(*) INTO total_matches FROM public.matches;
  RAISE NOTICE 'INFO: Total matches: %', total_matches;

  -- Check finished matches have winners
  SELECT count(*) INTO finished_no_winner
  FROM public.matches
  WHERE status = 'finished' AND winner_id IS NULL;
  IF finished_no_winner > 0 THEN
    RAISE WARNING 'WARNING: % finished matches without winner_id', finished_no_winner;
  ELSE
    RAISE NOTICE 'PASS: all finished matches have winner_id';
  END IF;

  -- Check no match references itself (player1 = player2)
  PERFORM 1 FROM public.matches
  WHERE player1_id = player2_id AND player1_id IS NOT NULL;
  IF FOUND THEN
    RAISE WARNING 'WARNING: found match where player1 = player2 (self-match)';
  ELSE
    RAISE NOTICE 'PASS: no self-matches found';
  END IF;
END $$;

-- ───────────────────────────────────────────────────────────
-- 2. LIGA LIFECYCLE INTEGRITY
-- ───────────────────────────────────────────────────────────

DO $$
DECLARE
  liga_no_admin INT;
  liga_no_members INT;
  r RECORD;
BEGIN
  -- Every liga should have at least one admin
  SELECT count(*) INTO liga_no_admin
  FROM public.ligas l
  WHERE NOT EXISTS (
    SELECT 1 FROM public.liga_members lm
    WHERE lm.liga_id = l.id AND lm.role = 'admin'
  );
  IF liga_no_admin > 0 THEN
    RAISE WARNING 'WARNING: % ligas have no admin member', liga_no_admin;
  ELSE
    RAISE NOTICE 'PASS: all ligas have at least one admin';
  END IF;

  -- Every liga should have at least one member
  SELECT count(*) INTO liga_no_members
  FROM public.ligas l
  WHERE NOT EXISTS (
    SELECT 1 FROM public.liga_members lm WHERE lm.liga_id = l.id
  );
  IF liga_no_members > 0 THEN
    RAISE WARNING 'WARNING: % ligas have zero members', liga_no_members;
  ELSE
    RAISE NOTICE 'PASS: all ligas have at least one member';
  END IF;

  -- Liga codes should be unique
  FOR r IN
    SELECT invite_code, count(*) AS cnt
    FROM public.ligas
    WHERE invite_code IS NOT NULL
    GROUP BY invite_code HAVING count(*) > 1
  LOOP
    RAISE WARNING 'WARNING: duplicate liga invite_code: %', r.invite_code;
  END LOOP;
  RAISE NOTICE 'PASS: liga invite_code uniqueness check complete';
END $$;

-- ───────────────────────────────────────────────────────────
-- 3. CLUB BOOKING INTEGRITY
-- ───────────────────────────────────────────────────────────

DO $$
DECLARE
  double_booked INT;
  booking_no_club INT;
BEGIN
  -- Check no double-bookings (same court, same date, same time, both confirmed)
  SELECT count(*) INTO double_booked
  FROM public.club_bookings a
  JOIN public.club_bookings b ON
    a.court_id = b.court_id
    AND a.booking_date = b.booking_date
    AND a.start_time = b.start_time
    AND a.id < b.id
    AND a.status NOT IN ('cancelled')
    AND b.status NOT IN ('cancelled');
  IF double_booked > 0 THEN
    RAISE WARNING 'WARNING: % potential double-bookings found', double_booked;
  ELSE
    RAISE NOTICE 'PASS: no double-bookings detected';
  END IF;

  -- Check bookings reference valid clubs (via courts)
  SELECT count(*) INTO booking_no_club
  FROM public.club_bookings cb
  WHERE cb.court_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.courts c WHERE c.id = cb.court_id);
  IF booking_no_club > 0 THEN
    RAISE WARNING 'WARNING: % bookings reference nonexistent courts', booking_no_club;
  ELSE
    RAISE NOTICE 'PASS: all bookings reference valid courts';
  END IF;
END $$;

-- ───────────────────────────────────────────────────────────
-- 4. COACH DATA INTEGRITY
-- ───────────────────────────────────────────────────────────

DO $$
DECLARE
  coach_count INT;
  avail_count INT;
  booking_count INT;
  review_count INT;
  invalid_ratings INT;
BEGIN
  SELECT count(*) INTO coach_count FROM public.coaches;
  SELECT count(*) INTO avail_count FROM public.coach_availability;
  SELECT count(*) INTO booking_count FROM public.coach_bookings;
  SELECT count(*) INTO review_count FROM public.coach_reviews;

  RAISE NOTICE 'INFO: Coaches: %, Availability: %, Bookings: %, Reviews: %',
    coach_count, avail_count, booking_count, review_count;

  -- Reviews should be 1-5
  SELECT count(*) INTO invalid_ratings
  FROM public.coach_reviews WHERE rating < 1 OR rating > 5;
  ASSERT invalid_ratings = 0, 'FAIL: found coach reviews with invalid ratings';
  RAISE NOTICE 'PASS: all coach review ratings are 1-5';

  -- No duplicate reviews (same reviewer for same coach)
  PERFORM 1 FROM public.coach_reviews
  GROUP BY coach_id, reviewer_id HAVING count(*) > 1;
  IF FOUND THEN
    RAISE WARNING 'WARNING: duplicate coach reviews found (same reviewer, same coach)';
  ELSE
    RAISE NOTICE 'PASS: no duplicate coach reviews';
  END IF;
END $$;

-- ───────────────────────────────────────────────────────────
-- 5. PROFILE STATS CONSISTENCY
-- ───────────────────────────────────────────────────────────

DO $$
DECLARE
  r RECORD;
  mismatches INT := 0;
BEGIN
  -- Check match count consistency for top 10 most active players
  FOR r IN
    SELECT p.id, p.display_name, p.match_count,
      (SELECT count(*) FROM public.matches m
       WHERE (m.player1_id = p.id OR m.player2_id = p.id)
         AND m.status = 'finished') AS actual_count
    FROM public.profiles p
    WHERE p.match_count > 0
    ORDER BY p.match_count DESC LIMIT 10
  LOOP
    IF r.match_count != r.actual_count THEN
      RAISE WARNING 'MISMATCH: % has match_count=% but actual=%',
        r.display_name, r.match_count, r.actual_count;
      mismatches := mismatches + 1;
    END IF;
  END LOOP;

  IF mismatches = 0 THEN
    RAISE NOTICE 'PASS: match_count consistent for top 10 players';
  ELSE
    RAISE WARNING 'WARNING: % match_count mismatches in top 10 players', mismatches;
  END IF;
END $$;

-- ───────────────────────────────────────────────────────────
-- 6. FEATURE INTERESTS TABLE CHECK
-- ───────────────────────────────────────────────────────────

DO $$
DECLARE
  interest_count INT;
BEGIN
  PERFORM 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'feature_interests';
  IF NOT FOUND THEN
    RAISE WARNING 'WARNING: feature_interests table does not exist';
  ELSE
    SELECT count(*) INTO interest_count FROM public.feature_interests;
    RAISE NOTICE 'INFO: feature_interests has % entries', interest_count;

    PERFORM 1 FROM pg_tables
      WHERE schemaname = 'public' AND tablename = 'feature_interests' AND rowsecurity = TRUE;
    IF NOT FOUND THEN
      RAISE WARNING 'WARNING: feature_interests does not have RLS enabled';
    ELSE
      RAISE NOTICE 'PASS: feature_interests has RLS enabled';
    END IF;
  END IF;
END $$;

-- ───────────────────────────────────────────────────────────
-- 7. PUSH SUBSCRIPTIONS INTEGRITY
-- ───────────────────────────────────────────────────────────

DO $$
DECLARE
  sub_count INT;
  orphan_subs INT;
BEGIN
  PERFORM 1 FROM pg_tables
    WHERE schemaname = 'public' AND tablename = 'push_subscriptions';
  IF NOT FOUND THEN
    RAISE WARNING 'WARNING: push_subscriptions table does not exist';
  ELSE
    SELECT count(*) INTO sub_count FROM public.push_subscriptions;
    RAISE NOTICE 'INFO: push_subscriptions: % entries', sub_count;

    -- Check no orphaned subscriptions
    SELECT count(*) INTO orphan_subs
    FROM public.push_subscriptions ps
    WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = ps.user_id);
    IF orphan_subs > 0 THEN
      RAISE WARNING 'WARNING: % orphaned push subscriptions', orphan_subs;
    ELSE
      RAISE NOTICE 'PASS: no orphaned push subscriptions';
    END IF;
  END IF;
END $$;

-- ───────────────────────────────────────────────────────────
-- 8. SCHEMA VERSION CHECK
-- ───────────────────────────────────────────────────────────

DO $$
DECLARE
  migration_count INT;
BEGIN
  -- Count applied migrations
  SELECT count(*) INTO migration_count
  FROM supabase_migrations.schema_migrations;
  RAISE NOTICE 'INFO: Applied migrations: %', migration_count;
  ASSERT migration_count >= 50, 'WARNING: fewer migrations than expected';
  RAISE NOTICE 'PASS: migration count looks correct (% migrations)', migration_count;
END $$;

COMMIT;

-- ═══════════════════════════════════════════════════════════
-- SUMMARY: Run in Supabase SQL Editor
-- All PASS = database is healthy
-- WARNING = non-critical issues to investigate
-- FAIL = critical issues that need fixing
-- ═══════════════════════════════════════════════════════════
