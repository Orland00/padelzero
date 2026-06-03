-- Add Stripe payment columns to club_bookings
ALTER TABLE public.club_bookings ADD COLUMN IF NOT EXISTS stripe_checkout_session_id TEXT;
ALTER TABLE public.club_bookings ADD COLUMN IF NOT EXISTS stripe_payment_intent_id TEXT;

-- Add stripe_account_id to clubs for Connect (future use)
ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS stripe_account_id TEXT;

NOTIFY pgrst, 'reload schema';
