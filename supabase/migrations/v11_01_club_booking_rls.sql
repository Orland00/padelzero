-- ═══════════════════════════════════════════════════════════
-- V11-01: Club Booking RLS Policies
-- ═══════════════════════════════════════════════════════════

-- Enable RLS on all new tables
ALTER TABLE public.club_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_availability_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_bookings ENABLE ROW LEVEL SECURITY;

-- Enable RLS on clubs table (was missing!)
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;

-- ─── CLUBS RLS ───────────────────────────────────────────
-- Public read: active clubs only
CREATE POLICY "clubs_public_read"
  ON public.clubs FOR SELECT
  USING (active = TRUE);

-- Owner can insert their club
CREATE POLICY "clubs_owner_insert"
  ON public.clubs FOR INSERT
  TO authenticated
  WITH CHECK (owner_user_id = auth.uid());

-- Owner can update their club
CREATE POLICY "clubs_owner_update"
  ON public.clubs FOR UPDATE
  TO authenticated
  USING (owner_user_id = auth.uid());

-- ─── AVAILABILITY RLS ────────────────────────────────────
-- Anyone can read (needed for booking UI)
CREATE POLICY "avail_public_read"
  ON public.club_availability FOR SELECT
  USING (TRUE);

-- Club owner manages
CREATE POLICY "avail_owner_manage"
  ON public.club_availability FOR ALL
  TO authenticated
  USING (public.is_club_owner_or_admin(club_id, auth.uid()))
  WITH CHECK (public.is_club_owner_or_admin(club_id, auth.uid()));

-- ─── OVERRIDES RLS ───────────────────────────────────────
CREATE POLICY "overrides_public_read"
  ON public.club_availability_overrides FOR SELECT
  USING (TRUE);

CREATE POLICY "overrides_owner_manage"
  ON public.club_availability_overrides FOR ALL
  TO authenticated
  USING (public.is_club_owner_or_admin(club_id, auth.uid()))
  WITH CHECK (public.is_club_owner_or_admin(club_id, auth.uid()));

-- ─── BOOKINGS RLS ────────────────────────────────────────
-- Users see own bookings + club owners see their club's bookings
CREATE POLICY "bookings_read"
  ON public.club_bookings FOR SELECT
  TO authenticated
  USING (
    booked_by = auth.uid()
    OR public.is_club_owner_or_admin(club_id, auth.uid())
  );

-- Insert: user books for themselves, status must be confirmed
CREATE POLICY "bookings_insert"
  ON public.club_bookings FOR INSERT
  TO authenticated
  WITH CHECK (booked_by = auth.uid() AND status = 'confirmed');

-- Self-cancel: only own confirmed bookings
CREATE POLICY "bookings_cancel_self"
  ON public.club_bookings FOR UPDATE
  TO authenticated
  USING (booked_by = auth.uid() AND status = 'confirmed')
  WITH CHECK (status = 'cancelled');

-- Club owner can update any booking in their club
CREATE POLICY "bookings_owner_update"
  ON public.club_bookings FOR UPDATE
  TO authenticated
  USING (public.is_club_owner_or_admin(club_id, auth.uid()));

NOTIFY pgrst, 'reload schema';
