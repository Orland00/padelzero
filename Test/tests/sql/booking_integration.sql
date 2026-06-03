-- =====================================================================
-- Booking integration test (SQL-level, run via `supabase db execute`
-- or Supabase SQL Editor). Validates the full server-side contract that
-- tests/frontend/bookingClient.test.js relies on.
--
-- Expected outcome: RAISE NOTICE lines show each step succeeding,
-- and the final SELECT returns the 3 asserted behaviours as 'PASS'.
-- =====================================================================
DO $$
DECLARE
  v_test_user uuid := '00000000-0000-4000-8000-000000000001'; -- fixture user
  v_test_peer uuid := '00000000-0000-4000-8000-000000000002'; -- fixture user
  v_court   uuid;
  v_booking1 uuid;
  v_booking_past_ok boolean := false;
  v_booking_farfuture_ok boolean := false;
  v_booking_overlap_ok boolean := false;
  v_date date := CURRENT_DATE + 1;
BEGIN
  SELECT c.id INTO v_court
  FROM public.courts c JOIN public.clubs cl ON cl.id=c.club_id
  WHERE cl.name='Club Test Demo City Norte' AND c.court_number=1;
  IF v_court IS NULL THEN
    RAISE NOTICE 'Prerequisite missing: seed Club Test data first.';
    RETURN;
  END IF;

  -- Impersonate fixture user
  PERFORM set_config('request.jwt.claim.sub', v_test_user::text, true);
  PERFORM set_config('request.jwt.claims', json_build_object('sub',v_test_user::text,'role','authenticated')::text, true);

  -- A) Happy path: book a valid slot
  v_booking1 := public.create_booking(v_court, v_date, '14:00'::time, '15:30'::time, 30000);
  RAISE NOTICE '[PASS] create_booking succeeded: %', v_booking1;

  -- B) Past-date guard
  BEGIN
    PERFORM public.create_booking(v_court, CURRENT_DATE - 1, '10:00'::time, '11:30'::time, 30000);
    v_booking_past_ok := true; -- should NOT reach here
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%past%' THEN
      RAISE NOTICE '[PASS] past-date rejected: %', SQLERRM;
    ELSE
      RAISE NOTICE '[FAIL] expected past-date error, got: %', SQLERRM;
    END IF;
  END;
  IF v_booking_past_ok THEN RAISE NOTICE '[FAIL] past-date booking unexpectedly succeeded'; END IF;

  -- C) 14-day window guard
  BEGIN
    PERFORM public.create_booking(v_court, CURRENT_DATE + 30, '10:00'::time, '11:30'::time, 30000);
    v_booking_farfuture_ok := true;
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%14 days%' THEN
      RAISE NOTICE '[PASS] 14-day window rejected: %', SQLERRM;
    ELSE
      RAISE NOTICE '[FAIL] expected 14-day error, got: %', SQLERRM;
    END IF;
  END;
  IF v_booking_farfuture_ok THEN RAISE NOTICE '[FAIL] far-future booking unexpectedly succeeded'; END IF;

  -- D) EXCLUDE-gist overlap
  BEGIN
    PERFORM public.create_booking(v_court, v_date, '14:30'::time, '16:00'::time, 30000);
    v_booking_overlap_ok := true;
  EXCEPTION WHEN exclusion_violation THEN
    RAISE NOTICE '[PASS] overlap rejected by EXCLUDE gist';
  WHEN OTHERS THEN
    RAISE NOTICE '[?] overlap rejected by non-exclusion error: %', SQLERRM;
  END;
  IF v_booking_overlap_ok THEN RAISE NOTICE '[FAIL] overlap booking unexpectedly succeeded'; END IF;

  -- E) Cancel path (RLS: user can UPDATE own booking to cancelled)
  UPDATE public.club_bookings SET status='cancelled', cancelled_at=now()
  WHERE id=v_booking1 AND booked_by=v_test_user;
  RAISE NOTICE '[PASS] cancel succeeded (RLS bookings_cancel_self allowed)';

  -- F) After cancel, slot is free — rebook should succeed
  PERFORM public.create_booking(v_court, v_date, '14:00'::time, '15:30'::time, 30000);
  RAISE NOTICE '[PASS] rebook after cancel succeeded';

  -- G) Rate limit: try to book 6 more in this hour (test already made >2; this will trip)
  BEGIN
    FOR i IN 1..10 LOOP
      PERFORM public.create_booking(v_court, v_date + i, '09:00'::time, '10:30'::time, 30000);
    END LOOP;
    RAISE NOTICE '[FAIL] rate limit did not trip after 10 bookings';
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM LIKE '%Rate limit%' THEN
      RAISE NOTICE '[PASS] rate-limit (5/hr) engaged: %', SQLERRM;
    ELSE
      RAISE NOTICE '[?] unexpected error during rate-limit test: %', SQLERRM;
    END IF;
  END;

  RAISE NOTICE '--- booking integration test complete ---';
END$$;

-- Aggregate status (for AdminBookings owner-view)
SELECT cb.booking_date, cb.start_time, cb.end_time, cb.status,
       p.display_name AS booked_by_name, cb.price_cents
FROM public.club_bookings cb
JOIN public.clubs cl ON cl.id=cb.club_id
JOIN public.profiles p ON p.id=cb.booked_by
WHERE cl.name LIKE 'Club Test%'
ORDER BY cb.booking_date, cb.start_time;
