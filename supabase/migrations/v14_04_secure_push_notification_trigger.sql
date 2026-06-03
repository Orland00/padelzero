-- P0-3 (Ana §6, 2026-04-16): notify_push_on_insert trigger called /functions/v1/send-push
-- with no auth header, and send-push has verify_jwt=false. Anyone on the
-- internet could POST arbitrary payloads and trigger pushes.
--
-- Fix:
--   1. Store a 32-byte shared secret in Supabase Vault (name: push_webhook_secret).
--   2. Trigger reads the secret from Vault and forwards as X-Push-Webhook-Secret.
--   3. send-push edge function validates the header when PUSH_WEBHOOK_SECRET env
--      var is set (fail-open during rollout, fail-closed once env var is set).
--
-- Secret provisioning (one-off):
--   DO $$
--   DECLARE
--     v_secret text := encode(gen_random_bytes(32), 'hex');
--     v_existing_id uuid;
--   BEGIN
--     SELECT id INTO v_existing_id FROM vault.secrets WHERE name = 'push_webhook_secret';
--     IF v_existing_id IS NOT NULL THEN
--       PERFORM vault.update_secret(v_existing_id, v_secret, 'push_webhook_secret', 'Shared secret for push webhook');
--     ELSE
--       PERFORM vault.create_secret(v_secret, 'push_webhook_secret', 'Shared secret for push webhook');
--     END IF;
--   END$$;
--
-- Remaining step: set PUSH_WEBHOOK_SECRET env var on the send-push
-- Edge Function in Supabase project to the same Vault value.
--
-- Applied via Supabase migration name: secure_push_notification_trigger_p0

CREATE OR REPLACE FUNCTION public.notify_push_on_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions', 'vault'
AS $function$
DECLARE
  payload jsonb;
  project_url text := 'https://your-project.supabase.co';
  v_secret text;
  v_headers jsonb;
BEGIN
  payload := jsonb_build_object(
    'type', 'INSERT',
    'table', 'notifications',
    'schema', 'public',
    'record', row_to_json(NEW)::jsonb,
    'old_record', NULL
  );

  BEGIN
    SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets
    WHERE name = 'push_webhook_secret'
    LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    v_secret := NULL;
  END;

  IF v_secret IS NOT NULL AND length(v_secret) > 0 THEN
    v_headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'X-Push-Webhook-Secret', v_secret
    );
  ELSE
    v_headers := jsonb_build_object('Content-Type', 'application/json');
  END IF;

  PERFORM net.http_post(
    url := project_url || '/functions/v1/send-push',
    body := payload,
    headers := v_headers
  );

  RETURN NEW;
END;
$function$;
