-- v11_03: Add pending_payment to booking status constraint

-- 1. Drop and recreate the CHECK constraint to include pending_payment
ALTER TABLE public.club_bookings DROP CONSTRAINT IF EXISTS club_bookings_status_check;
ALTER TABLE public.club_bookings ADD CONSTRAINT club_bookings_status_check
  CHECK (status IN ('confirmed', 'cancelled', 'completed', 'no_show', 'pending_payment'));

-- 2. GIST exclusion already covers pending_payment (excludes only 'cancelled')

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
