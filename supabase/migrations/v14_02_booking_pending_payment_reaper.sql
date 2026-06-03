-- P0-9 (Sofia 1.2, 2026-04-16): pending_payment bookings hold slots via the
-- EXCLUDE constraint if a user abandons Stripe without triggering the expired
-- webhook. Reap after 30 minutes.
--
-- Applied via Supabase migration name: booking_pending_payment_reaper_p0

SELECT cron.schedule(
  'reap-pending-payment-bookings',
  '*/15 * * * *',
  $$
    UPDATE public.club_bookings
    SET status = 'cancelled',
        cancelled_at = now()
    WHERE status = 'pending_payment'
      AND updated_at < now() - INTERVAL '30 minutes';
  $$
);
