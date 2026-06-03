-- ═══════════════════════════════════════════════════════════
-- v15_07 — CRM SECURITY AUDIT & HARDENING
-- Mandatory security gate added by Senior Principal Auditor.
-- 1. crm_notes_audit: track who viewed/edited student data.
-- 2. Hardening crm_player_stats RLS (previously too permissive).
-- 3. Profiles: add role column for governance.
-- Updated: 2026-05-07
-- ═══════════════════════════════════════════════════════════

-- 0. Profiles Hardening
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'player'
    CHECK (role IN ('player', 'coach', 'admin', 'auditor', 'club_admin'));

-- Set is_founder profiles to admin
UPDATE public.profiles SET role = 'admin' WHERE is_founder = true;

-- 1. Audit Table
CREATE TABLE IF NOT EXISTS public.crm_notes_audit (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auditor_id    uuid NOT NULL REFERENCES public.profiles(id),
  target_id     uuid NOT NULL REFERENCES public.profiles(id),
  action        text NOT NULL, -- 'view_notes', 'create_note', 'update_note', 'delete_note', 'toggle_share'
  resource_id   uuid,          -- ID of the note (if applicable)
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_crm_audit_target 
  ON public.crm_notes_audit(target_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_crm_audit_auditor
  ON public.crm_notes_audit(auditor_id, created_at DESC);

-- Enable RLS (Read-only for admins/audit purposes)
ALTER TABLE public.crm_notes_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "crm_audit_select_admin"
  ON public.crm_notes_audit FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND (role = 'admin' OR role = 'auditor')
    )
  );

-- 2. Hardening crm_player_stats RLS
DROP POLICY IF EXISTS "crm_stats_select_authenticated" ON public.crm_player_stats;
DROP POLICY IF EXISTS "crm_stats_insert_authenticated" ON public.crm_player_stats;
DROP POLICY IF EXISTS "crm_stats_update_authenticated" ON public.crm_player_stats;

-- Only coaches or the player themselves can see stats
CREATE POLICY "crm_stats_select"
  ON public.crm_player_stats FOR SELECT TO authenticated
  USING (
    auth.uid() = player_id
    OR EXISTS (SELECT 1 FROM public.coaches WHERE profile_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Only coaches or admins can manage stats
CREATE POLICY "crm_stats_manage"
  ON public.crm_player_stats FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.coaches WHERE profile_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.coaches WHERE profile_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 3. Logging function for CRM access
CREATE OR REPLACE FUNCTION public.log_crm_access(
  p_target_id uuid,
  p_action text,
  p_resource_id uuid DEFAULT NULL
)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.crm_notes_audit (auditor_id, target_id, action, resource_id)
  VALUES (auth.uid(), p_target_id, p_action, p_resource_id);
END;
$$;

-- 4. Triggers for crm_notes edits
CREATE OR REPLACE FUNCTION public.trg_audit_crm_note_changes()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (TG_OP = 'INSERT') THEN
    PERFORM public.log_crm_access(NEW.target_id, 'create_note', NEW.id);
  ELSIF (TG_OP = 'UPDATE') THEN
    IF (OLD.is_shared <> NEW.is_shared) THEN
      PERFORM public.log_crm_access(NEW.target_id, 'toggle_share', NEW.id);
    ELSE
      PERFORM public.log_crm_access(NEW.target_id, 'update_note', NEW.id);
    END IF;
  ELSIF (TG_OP = 'DELETE') THEN
    PERFORM public.log_crm_access(OLD.target_id, 'delete_note', OLD.id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_audit_crm_notes ON public.crm_notes;
CREATE TRIGGER trg_audit_crm_notes
  AFTER INSERT OR UPDATE OR DELETE ON public.crm_notes
  FOR EACH ROW EXECUTE FUNCTION public.trg_audit_crm_note_changes();

NOTIFY pgrst, 'reload schema';
