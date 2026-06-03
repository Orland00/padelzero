-- ═══════════════════════════════════════════════════════════
-- v14_10 — Drop finish_match(uuid,uuid) legacy overload (C4)
-- ═══════════════════════════════════════════════════════════
-- 03_architecture_audit.md C4: two coexisting overloads is a migration
-- landmine. Verified no src/*, pg_proc (other fns), or pg_trigger refs the
-- 2-arg signature. App calls `supabase.functions.invoke('finish_match')`
-- (edge function) which implements ELO in TS, not the Postgres RPC.

BEGIN;

DROP FUNCTION IF EXISTS public.finish_match(match_id uuid, winner_id uuid);

COMMIT;

-- Rollback would require recreating the original body (not preserved — dead code).
