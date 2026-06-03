-- ═══════════════════════════════════════════════════════════
-- v14_11 — Drop orphan pz_* namespace (20 tables + 4 functions)
-- ═══════════════════════════════════════════════════════════
-- 06_dead_code.md / 08_reality_check.md row 40: entire pz_* namespace
-- is a sport-agnostic abstraction with zero references in src/. Triggers
-- maintain updated_at on every write for zero benefit, and `pz_*` public
-- SELECT policies leak email/bookings to anon (A2 F6 MEDIUM).
--
-- Verified zero src/*.{js,jsx} references to any pz_* table or function.
-- Verified no active cron jobs or edge functions reference pz_* (pg_proc
-- scan of all public functions returned zero callers).
--
-- CASCADE drops FK constraints and their RI triggers automatically.
-- User triggers (trg_pz_*) drop with their tables.

BEGIN;

-- Drop all 20 pz_* tables (CASCADE removes FK RI triggers + RLS policies)
DROP TABLE IF EXISTS public.pz_api_keys CASCADE;
DROP TABLE IF EXISTS public.pz_auth_player_map CASCADE;
DROP TABLE IF EXISTS public.pz_bookings CASCADE;
DROP TABLE IF EXISTS public.pz_clubs CASCADE;
DROP TABLE IF EXISTS public.pz_connection_log CASCADE;
DROP TABLE IF EXISTS public.pz_court_availability CASCADE;
DROP TABLE IF EXISTS public.pz_courts CASCADE;
DROP TABLE IF EXISTS public.pz_elo_history CASCADE;
DROP TABLE IF EXISTS public.pz_group_members CASCADE;
DROP TABLE IF EXISTS public.pz_groups CASCADE;
DROP TABLE IF EXISTS public.pz_league_members CASCADE;
DROP TABLE IF EXISTS public.pz_leagues CASCADE;
DROP TABLE IF EXISTS public.pz_match_players CASCADE;
DROP TABLE IF EXISTS public.pz_matches CASCADE;
DROP TABLE IF EXISTS public.pz_player_sport_elo CASCADE;
DROP TABLE IF EXISTS public.pz_players CASCADE;
DROP TABLE IF EXISTS public.pz_sponsors CASCADE;
DROP TABLE IF EXISTS public.pz_sport_configs CASCADE;
DROP TABLE IF EXISTS public.pz_tournament_registrations CASCADE;
DROP TABLE IF EXISTS public.pz_tournaments CASCADE;

-- Drop the 4 pz_* support functions (tables are gone, functions are unused)
DROP FUNCTION IF EXISTS public.pz_calculate_elo CASCADE;
DROP FUNCTION IF EXISTS public.pz_check_permission CASCADE;
DROP FUNCTION IF EXISTS public.pz_update_updated_at CASCADE;
DROP FUNCTION IF EXISTS public.pz_validate_match_scores CASCADE;

COMMIT;

-- Rollback: not practical — would require re-running the original pz_* schema
-- creation migrations and restoring 120 rows of historical data. If rollback
-- is ever needed, it's a "recreate from scratch" exercise, not a DDL undo.
