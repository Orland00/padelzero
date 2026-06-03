-- ═══════════════════════════════════════════════════════════
-- V12-00: WhatsApp AI Agent — Tables, RLS & RPCs
-- ═══════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 1. Table: whatsapp_users (phone → profile linking)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.whatsapp_users (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number  TEXT        NOT NULL UNIQUE,
  profile_id    UUID        REFERENCES public.profiles(id),
  wa_name       TEXT,
  is_linked     BOOLEAN     DEFAULT FALSE,
  message_count INTEGER     DEFAULT 0,
  last_message  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_users_phone
  ON public.whatsapp_users (phone_number);
CREATE INDEX IF NOT EXISTS idx_wa_users_profile
  ON public.whatsapp_users (profile_id);

-- ─────────────────────────────────────────────────────────────
-- 2. Table: whatsapp_group_links (group → liga/club mapping)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.whatsapp_group_links (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    TEXT        NOT NULL UNIQUE,
  liga_id     UUID        REFERENCES public.ligas(id),
  club_id     INTEGER     REFERENCES public.clubs(id),
  linked_by   UUID        REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_group_links_group
  ON public.whatsapp_group_links (group_id);

-- ─────────────────────────────────────────────────────────────
-- 3. Table: whatsapp_messages (audit log)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.whatsapp_messages (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_user_id    UUID        REFERENCES public.whatsapp_users(id),
  group_id      TEXT,
  direction     TEXT        NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_text  TEXT,
  tool_used     TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wa_messages_user
  ON public.whatsapp_messages (wa_user_id, created_at DESC);

-- ─────────────────────────────────────────────────────────────
-- 4. RLS — service role only (edge functions use service role key)
-- ─────────────────────────────────────────────────────────────
ALTER TABLE public.whatsapp_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_group_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wa_users_service_only"
  ON public.whatsapp_users FOR ALL
  TO service_role
  USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "wa_group_links_service_only"
  ON public.whatsapp_group_links FOR ALL
  TO service_role
  USING (TRUE) WITH CHECK (TRUE);

CREATE POLICY "wa_messages_service_only"
  ON public.whatsapp_messages FOR ALL
  TO service_role
  USING (TRUE) WITH CHECK (TRUE);

-- ─────────────────────────────────────────────────────────────
-- 5. RPC: create_booking_for_user (service role only)
--    Same as create_booking but accepts user_id as parameter
--    instead of using auth.uid(). For WhatsApp bot use.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_booking_for_user(
  p_user_id     UUID,
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
  v_club_id      INTEGER;
  v_recent_count INTEGER;
  v_booking_id   UUID;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'user_id required';
  END IF;

  SELECT club_id INTO v_club_id
  FROM public.courts
  WHERE id = p_court_id AND active = TRUE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Court not found or inactive';
  END IF;

  SELECT count(*) INTO v_recent_count
  FROM public.club_bookings
  WHERE booked_by = p_user_id
    AND created_at > NOW() - INTERVAL '1 hour'
    AND status != 'cancelled';

  IF v_recent_count >= 5 THEN
    RAISE EXCEPTION 'Rate limit: max 5 bookings per hour.';
  END IF;

  IF (p_date + p_start_time)::timestamp < NOW() THEN
    RAISE EXCEPTION 'Cannot book a slot in the past';
  END IF;

  IF p_date > CURRENT_DATE + 14 THEN
    RAISE EXCEPTION 'Cannot book more than 14 days in advance';
  END IF;

  INSERT INTO public.club_bookings (
    court_id, club_id, booked_by, booking_date,
    start_time, end_time, price_cents, status
  ) VALUES (
    p_court_id, v_club_id, p_user_id, p_date,
    p_start_time, p_end_time, p_price_cents, 'confirmed'
  )
  RETURNING id INTO v_booking_id;

  RETURN v_booking_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_booking_for_user FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_booking_for_user TO service_role;

-- Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
