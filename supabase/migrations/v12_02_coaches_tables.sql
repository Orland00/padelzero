-- ═══════════════════════════════════════════════════════════
-- V12-02: Coaches System — Tables & RLS
-- ═══════════════════════════════════════════════════════════

-- 1. Coach profiles (extends profiles)
CREATE TABLE IF NOT EXISTS public.coaches (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      UUID NOT NULL UNIQUE REFERENCES public.profiles(id),
  bio             TEXT,
  specialties     TEXT[],        -- e.g. {'beginners','advanced','kids','fitness'}
  experience_years INTEGER,
  hourly_rate_cents INTEGER,     -- MXN centavos
  group_rate_cents  INTEGER,     -- per person for group classes
  max_group_size  INTEGER DEFAULT 4,
  phone           TEXT,
  instagram       TEXT,
  club_ids        INTEGER[],     -- clubs where they teach (optional)
  city            TEXT,
  verified        BOOLEAN DEFAULT FALSE,
  active          BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coaches_profile ON public.coaches (profile_id);
CREATE INDEX IF NOT EXISTS idx_coaches_city ON public.coaches (city);

-- 2. Coach availability (recurring weekly template, same pattern as clubs)
CREATE TABLE IF NOT EXISTS public.coach_availability (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id        UUID NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  day_of_week     SMALLINT NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  slot_duration_minutes SMALLINT NOT NULL DEFAULT 60 CHECK (slot_duration_minutes IN (30, 60, 90, 120)),
  is_group        BOOLEAN DEFAULT FALSE,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_coach_time CHECK (start_time < end_time)
);

CREATE INDEX IF NOT EXISTS idx_coach_avail ON public.coach_availability (coach_id, day_of_week);

-- 3. Coach bookings
CREATE TABLE IF NOT EXISTS public.coach_bookings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id        UUID NOT NULL REFERENCES public.coaches(id),
  booked_by       UUID NOT NULL REFERENCES public.profiles(id),
  booking_date    DATE NOT NULL,
  start_time      TIME NOT NULL,
  end_time        TIME NOT NULL,
  is_group        BOOLEAN DEFAULT FALSE,
  participants    INTEGER DEFAULT 1,
  price_cents     INTEGER NOT NULL,
  status          TEXT NOT NULL DEFAULT 'confirmed'
                  CHECK (status IN ('confirmed', 'cancelled', 'completed', 'no_show')),
  notes           TEXT,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  cancelled_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_coach_bookings_coach ON public.coach_bookings (coach_id, booking_date);
CREATE INDEX IF NOT EXISTS idx_coach_bookings_user ON public.coach_bookings (booked_by);

-- 4. Coach reviews
CREATE TABLE IF NOT EXISTS public.coach_reviews (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id    UUID NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  reviewer_id UUID NOT NULL REFERENCES public.profiles(id),
  rating      SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(coach_id, reviewer_id)
);

CREATE INDEX IF NOT EXISTS idx_coach_reviews ON public.coach_reviews (coach_id);

-- 5. RLS
ALTER TABLE public.coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_reviews ENABLE ROW LEVEL SECURITY;

-- Coaches: public read, own manage
CREATE POLICY "coaches_public_read" ON public.coaches FOR SELECT USING (TRUE);
CREATE POLICY "coaches_own_manage" ON public.coaches FOR ALL TO authenticated
  USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());

-- Availability: public read, coach manages own
CREATE POLICY "coach_avail_public_read" ON public.coach_availability FOR SELECT USING (TRUE);
CREATE POLICY "coach_avail_own_manage" ON public.coach_availability FOR ALL TO authenticated
  USING (coach_id IN (SELECT id FROM public.coaches WHERE profile_id = auth.uid()))
  WITH CHECK (coach_id IN (SELECT id FROM public.coaches WHERE profile_id = auth.uid()));

-- Bookings: own read + coach read, insert own
CREATE POLICY "coach_bookings_own_read" ON public.coach_bookings FOR SELECT TO authenticated
  USING (booked_by = auth.uid() OR coach_id IN (SELECT id FROM public.coaches WHERE profile_id = auth.uid()));
CREATE POLICY "coach_bookings_insert" ON public.coach_bookings FOR INSERT TO authenticated
  WITH CHECK (booked_by = auth.uid());
CREATE POLICY "coach_bookings_update" ON public.coach_bookings FOR UPDATE TO authenticated
  USING (booked_by = auth.uid() OR coach_id IN (SELECT id FROM public.coaches WHERE profile_id = auth.uid()));

-- Reviews: public read, insert own
CREATE POLICY "coach_reviews_public_read" ON public.coach_reviews FOR SELECT USING (TRUE);
CREATE POLICY "coach_reviews_insert" ON public.coach_reviews FOR INSERT TO authenticated
  WITH CHECK (reviewer_id = auth.uid());

NOTIFY pgrst, 'reload schema';
