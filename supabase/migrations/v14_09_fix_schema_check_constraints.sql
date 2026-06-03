-- ═══════════════════════════════════════════════════════════
-- v14_09 — Fix schema drift: CHECK constraints blocking legal values
-- ═══════════════════════════════════════════════════════════
-- C2 (from 03_architecture_audit.md): tournament_matches_status_check
--     only allows ('pending','done') but store writes 'finished' → silent
--     insert failure. Explains 0 rows in tournament_matches despite real
--     tournaments having participants.
-- C3: liga_members_role_check only allows ('admin','player') but code
--     attempts to write 'creator' and the Phase 1 trigger
--     (liga_members_prevent_role_escalation) references 'owner'.
--     Both are blocked silently today.

BEGIN;

-- C2: tournament_matches.status — add 'finished'
ALTER TABLE public.tournament_matches
  DROP CONSTRAINT IF EXISTS tournament_matches_status_check;
ALTER TABLE public.tournament_matches
  ADD CONSTRAINT tournament_matches_status_check
  CHECK (status IN ('pending', 'done', 'finished'));

-- C3: liga_members.role — add 'creator' and 'owner'
ALTER TABLE public.liga_members
  DROP CONSTRAINT IF EXISTS liga_members_role_check;
ALTER TABLE public.liga_members
  ADD CONSTRAINT liga_members_role_check
  CHECK (role IN ('admin', 'player', 'creator', 'owner'));

COMMIT;

-- Rollback:
--   ALTER TABLE public.tournament_matches DROP CONSTRAINT tournament_matches_status_check;
--   ALTER TABLE public.tournament_matches ADD CONSTRAINT tournament_matches_status_check CHECK (status IN ('pending','done'));
--   ALTER TABLE public.liga_members DROP CONSTRAINT liga_members_role_check;
--   ALTER TABLE public.liga_members ADD CONSTRAINT liga_members_role_check CHECK (role IN ('admin','player'));
