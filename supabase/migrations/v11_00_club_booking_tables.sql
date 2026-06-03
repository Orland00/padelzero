-- ═══════════════════════════════════════════════════════════
-- V11-00: Club Booking System — Tables, RPCs & Constraints
-- ═══════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 0. Upgrade clubs table to match schema
--    (clubs.id is SERIAL/INTEGER in production)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.clubs
  ADD COLUMN IF NOT EXISTS slug    TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS address TEXT,
  ADD COLUMN IF NOT EXISTS lat     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS lng     DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS phone   TEXT;


-- ─────────────────────────────────────────────────────────────
-- 1. Extension: btree_gist (required for GIST exclusion constraint)
-- ─────────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS btree_gist;


-- ─────────────────────────────────────────────────────────────
-- 2. Table: club_availability (recurring weekly template)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.club_availability (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id              UUID        NOT NULL REFERENCES public.courts(id) ON DELETE CASCADE,
  club_id               INTEGER     NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  day_of_week           SMALLINT    NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),  -- 0=Sunday
  start_time            TIME        NOT NULL,
  end_time              TIME        NOT NULL,
  slot_duration_minutes SMALLINT    NOT NULL DEFAULT 90 CHECK (slot_duration_minutes IN (60, 90, 120)),
  price_cents           INTEGER     NOT NULL,  -- MXN centavos
  is_peak               BOOLEAN     DEFAULT FALSE,
  is_active             BOOLEAN     DEFAULT TRUE,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_time_range CHECK (start_time < end_time)
);

CREATE INDEX IF NOT EXISTS idx_club_availability_court_dow
  ON public.club_availability (court_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_club_availability_club_id
  ON public.club_availability (club_id);


-- ─────────────────────────────────────────────────────────────
-- 3. Table: club_availability_overrides (holidays, closures, special pricing)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.club_availability_overrides (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id      UUID        REFERENCES public.courts(id) ON DELETE CASCADE,  -- nullable = club-wide override
  club_id       INTEGER     NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  override_date DATE        NOT NULL,
  is_closed     BOOLEAN     DEFAULT FALSE,
  custom_slots  JSONB       CHECK (custom_slots IS NULL OR jsonb_typeof(custom_slots) = 'array'),
  reason        TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_overrides_court_date
  ON public.club_availability_overrides (court_id, override_date);
CREATE INDEX IF NOT EXISTS idx_overrides_club_date
  ON public.club_availability_overrides (club_id, override_date);


-- ─────────────────────────────────────────────────────────────
-- 4. Table: club_bookings
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.club_bookings (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  court_id     UUID        NOT NULL REFERENCES public.courts(id),
  club_id      INTEGER     NOT NULL REFERENCES public.clubs(id),
  booked_by    UUID        NOT NULL REFERENCES public.profiles(id),
  booking_date DATE        NOT NULL,
  start_time   TIME        NOT NULL,
  end_time     TIME        NOT NULL,
  price_cents  INTEGER     NOT NULL,
  status       TEXT        NOT NULL DEFAULT 'confirmed'
                           CHECK (status IN ('confirmed', 'cancelled', 'completed', 'no_show')),
  notes        TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  cancelled_at TIMESTAMPTZ,
  -- GIST exclusion: prevent double-booking on the same court for overlapping time ranges
  -- Only active (non-cancelled) bookings participate in the constraint
  EXCLUDE USING GIST (
    court_id WITH =,
    tsrange(
      (booking_date + start_time)::timestamp,
      (booking_date + end_time)::timestamp,
      '[)'
    ) WITH &&
  ) WHERE (status NOT IN ('cancelled'))
);

CREATE INDEX IF NOT EXISTS idx_bookings_court_date
  ON public.club_bookings (court_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_bookings_club_id
  ON public.club_bookings (club_id);
CREATE INDEX IF NOT EXISTS idx_bookings_booked_by
  ON public.club_bookings (booked_by);

-- Partial unique index: a user cannot book the same court/date/time slot twice (unless cancelled)
CREATE UNIQUE INDEX IF NOT EXISTS idx_bookings_no_duplicate_user_slot
  ON public.club_bookings (court_id, booking_date, start_time, booked_by)
  WHERE status != 'cancelled';


-- ─────────────────────────────────────────────────────────────
-- 5. Security Definer helper functions
-- ─────────────────────────────────────────────────────────────

-- Check if a user is the owner of a given club
CREATE OR REPLACE FUNCTION public.is_club_owner_or_admin(v_club_id INTEGER, v_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.clubs
    WHERE id = v_club_id AND owner_user_id = v_user_id
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Return all club IDs owned by a user
CREATE OR REPLACE FUNCTION public.get_user_club_ids(v_user_id UUID)
RETURNS SETOF INTEGER AS $$
  SELECT id FROM public.clubs WHERE owner_user_id = v_user_id;
$$ LANGUAGE SQL SECURITY DEFINER STABLE;


-- ─────────────────────────────────────────────────────────────
-- 6. RPC: get_available_slots(p_court_id, p_date)
--    Returns available time slots for a court on a given date.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_available_slots(
  p_court_id UUID,
  p_date     DATE
)
RETURNS TABLE (
  start_time   TIME,
  end_time     TIME,
  price_cents  INTEGER,
  is_peak      BOOLEAN,
  is_available BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_day_of_week   SMALLINT;
  v_override      public.club_availability_overrides%ROWTYPE;
  v_slot          JSONB;
  v_slot_start    TIME;
  v_slot_end      TIME;
  v_slot_price    INTEGER;
  v_slot_is_peak  BOOLEAN;
  v_is_booked     BOOLEAN;
  v_avail         public.club_availability%ROWTYPE;
  v_series_start  TIME;
BEGIN
  -- Determine day of week (0=Sunday .. 6=Saturday)
  v_day_of_week := EXTRACT(DOW FROM p_date)::SMALLINT;

  -- Check for an override on this date for this court (court-specific first, then club-wide)
  SELECT * INTO v_override
  FROM public.club_availability_overrides
  WHERE override_date = p_date
    AND (court_id = p_court_id OR court_id IS NULL)
    AND club_id = (SELECT club_id FROM public.courts WHERE id = p_court_id)
  ORDER BY court_id NULLS LAST  -- prefer court-specific over club-wide
  LIMIT 1;

  -- If closed, return empty result set
  IF FOUND AND v_override.is_closed THEN
    RETURN;
  END IF;

  -- If there are custom slots in the override, use those
  IF FOUND AND v_override.custom_slots IS NOT NULL THEN
    FOR v_slot IN SELECT * FROM jsonb_array_elements(v_override.custom_slots)
    LOOP
      v_slot_start  := (v_slot->>'start_time')::TIME;
      v_slot_end    := (v_slot->>'end_time')::TIME;
      v_slot_price  := (v_slot->>'price_cents')::INTEGER;
      v_slot_is_peak := COALESCE((v_slot->>'is_peak')::BOOLEAN, FALSE);

      SELECT EXISTS (
        SELECT 1 FROM public.club_bookings b
        WHERE b.court_id = p_court_id
          AND b.booking_date = p_date
          AND b.status NOT IN ('cancelled')
          AND tsrange(
                (p_date + b.start_time)::timestamp,
                (p_date + b.end_time)::timestamp,
                '[)'
              ) &&
              tsrange(
                (p_date + v_slot_start)::timestamp,
                (p_date + v_slot_end)::timestamp,
                '[)'
              )
      ) INTO v_is_booked;

      start_time   := v_slot_start;
      end_time     := v_slot_end;
      price_cents  := v_slot_price;
      is_peak      := v_slot_is_peak;
      is_available := NOT v_is_booked;
      RETURN NEXT;
    END LOOP;

    RETURN;
  END IF;

  -- No override (or override without custom_slots): generate slots from the weekly template
  FOR v_avail IN
    SELECT *
    FROM public.club_availability
    WHERE court_id = p_court_id
      AND day_of_week = v_day_of_week
      AND is_active = TRUE
    ORDER BY start_time
  LOOP
    -- Generate series of slots within the availability window
    FOR v_series_start IN
      SELECT gs::TIME
      FROM generate_series(
        (p_date + v_avail.start_time)::timestamp,
        (p_date + v_avail.end_time)::timestamp - (v_avail.slot_duration_minutes || ' minutes')::interval,
        (v_avail.slot_duration_minutes || ' minutes')::interval
      ) gs
    LOOP
      v_slot_start := v_series_start;
      v_slot_end   := v_series_start + (v_avail.slot_duration_minutes || ' minutes')::interval;

      SELECT EXISTS (
        SELECT 1 FROM public.club_bookings b
        WHERE b.court_id = p_court_id
          AND b.booking_date = p_date
          AND b.status NOT IN ('cancelled')
          AND tsrange(
                (p_date + b.start_time)::timestamp,
                (p_date + b.end_time)::timestamp,
                '[)'
              ) &&
              tsrange(
                (p_date + v_slot_start)::timestamp,
                (p_date + v_slot_end)::timestamp,
                '[)'
              )
      ) INTO v_is_booked;

      start_time   := v_slot_start;
      end_time     := v_slot_end;
      price_cents  := v_avail.price_cents;
      is_peak      := v_avail.is_peak;
      is_available := NOT v_is_booked;
      RETURN NEXT;
    END LOOP;
  END LOOP;

  RETURN;
END;
$$;


-- ─────────────────────────────────────────────────────────────
-- 7. RPC: get_club_availability_summary(p_club_id)
--    Returns total vs available slots for next 7 days across all active courts.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_club_availability_summary(
  p_club_id INTEGER
)
RETURNS TABLE (
  available_date   DATE,
  total_slots      INTEGER,
  available_slots  INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_date   DATE;
  v_court  RECORD;
  v_slot   RECORD;
  v_total  INTEGER;
  v_avail  INTEGER;
BEGIN
  FOR v_date IN
    SELECT (CURRENT_DATE + s)::DATE
    FROM generate_series(0, 6) s
  LOOP
    v_total := 0;
    v_avail := 0;

    FOR v_court IN
      SELECT id FROM public.courts
      WHERE club_id = p_club_id AND active = TRUE
    LOOP
      FOR v_slot IN
        SELECT is_available FROM public.get_available_slots(v_court.id, v_date)
      LOOP
        v_total := v_total + 1;
        IF v_slot.is_available THEN
          v_avail := v_avail + 1;
        END IF;
      END LOOP;
    END LOOP;

    available_date  := v_date;
    total_slots     := v_total;
    available_slots := v_avail;
    RETURN NEXT;
  END LOOP;

  RETURN;
END;
$$;


-- ─────────────────────────────────────────────────────────────
-- 8. RPC: create_booking(p_court_id, p_date, p_start_time, p_end_time, p_price_cents)
--    Authenticated users book a court slot. GIST constraint prevents races.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_booking(
  p_court_id    UUID,
  p_date        DATE,
  p_start_time  TIME,
  p_end_time    TIME,
  p_price_cents INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id      UUID;
  v_club_id      INTEGER;
  v_recent_count INTEGER;
  v_booking_id   UUID;
BEGIN
  -- 1. Require authenticated caller
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  -- 2. Resolve club_id from court
  SELECT club_id INTO v_club_id
  FROM public.courts
  WHERE id = p_court_id AND active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Court not found or inactive';
  END IF;

  -- 3. Rate limit: max 5 bookings per hour per user (non-cancelled)
  SELECT count(*) INTO v_recent_count
  FROM public.club_bookings
  WHERE booked_by = v_user_id
    AND created_at > NOW() - INTERVAL '1 hour'
    AND status != 'cancelled';

  IF v_recent_count >= 5 THEN
    RAISE EXCEPTION 'Rate limit: max 5 bookings per hour. Try again later.';
  END IF;

  -- 4. Cannot book in the past
  IF (p_date + p_start_time)::timestamp < NOW() THEN
    RAISE EXCEPTION 'Cannot book a slot in the past';
  END IF;

  -- 5. Cannot book more than 14 days ahead
  IF p_date > CURRENT_DATE + 14 THEN
    RAISE EXCEPTION 'Cannot book more than 14 days in advance';
  END IF;

  -- 6. Insert booking (GIST exclusion constraint prevents double-booking atomically)
  INSERT INTO public.club_bookings (
    court_id,
    club_id,
    booked_by,
    booking_date,
    start_time,
    end_time,
    price_cents,
    status
  ) VALUES (
    p_court_id,
    v_club_id,
    v_user_id,
    p_date,
    p_start_time,
    p_end_time,
    p_price_cents,
    'confirmed'
  )
  RETURNING id INTO v_booking_id;

  RETURN v_booking_id;
END;
$$;


-- ─────────────────────────────────────────────────────────────
-- Reload PostgREST schema cache
-- ─────────────────────────────────────────────────────────────
NOTIFY pgrst, 'reload schema';
