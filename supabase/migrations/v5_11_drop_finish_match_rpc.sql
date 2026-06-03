-- ═══════════════════════════════════════════════════════════
-- PadelZero — V5-11 DROP LEGACY RPC
-- Removes the finish_match database RPC since this logic 
-- has been fully migrated to a secure Supabase Edge Function.
-- ═══════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.finish_match(uuid, uuid, integer, integer, jsonb);

-- Reload PostgREST schema to ensure the endpoint disappears
NOTIFY pgrst, 'reload schema';
