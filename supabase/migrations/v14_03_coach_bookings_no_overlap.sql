-- P0-10 (Sofia 1.3, 2026-04-16): coach_bookings had no time-range exclusion
-- constraint; a coach could be double-booked across two students. Add EXCLUDE
-- USING gist (btree_gist extension already installed).
--
-- Applied via Supabase migration name: coach_bookings_no_overlap_p0

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'coach_bookings_no_overlap'
      AND conrelid = 'public.coach_bookings'::regclass
  ) THEN
    EXECUTE $EX$
      ALTER TABLE public.coach_bookings
      ADD CONSTRAINT coach_bookings_no_overlap
      EXCLUDE USING gist (
        coach_id WITH =,
        tsrange(booking_date + start_time, booking_date + end_time, '[)') WITH &&
      ) WHERE (status <> 'cancelled')
    $EX$;
  END IF;
END$$;
