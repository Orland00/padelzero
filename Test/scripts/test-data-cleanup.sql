-- =====================================================================
-- Test-data cleanup script (seeded 2026-04-16 by audit agent)
-- Run this when you're done exercising the test ligas/tournament/clubs/coaches.
-- Idempotent: safe to run multiple times.
-- =====================================================================
-- What's in the DB from the seed:
--   ligas    = 3 rows named 'Liga Test — %'
--   tournaments = 1 row named 'Torneo Test%'
--   clubs    = 2 rows named 'Club Test%'
--   coaches  = 2 rows with bio containing 'Test data — safe to delete'
--   profiles = 8 rows with username 'testagent_%'
--
-- Order of deletion respects FK constraints.
-- =====================================================================

BEGIN;

-- 1. Tournament chain
DELETE FROM public.tournament_matches
  WHERE tournament_id IN (SELECT id FROM public.tournaments WHERE name LIKE 'Torneo Test%');
DELETE FROM public.tournament_participants
  WHERE tournament_id IN (SELECT id FROM public.tournaments WHERE name LIKE 'Torneo Test%');
DELETE FROM public.tournaments WHERE name LIKE 'Torneo Test%';

-- 2. Liga chain
DELETE FROM public.elo_history
  WHERE match_id IN (
    SELECT lm.id FROM public.liga_matches lm
    JOIN public.ligas l ON l.id = lm.liga_id
    WHERE l.name LIKE 'Liga Test%'
  );
DELETE FROM public.liga_matches
  WHERE liga_id IN (SELECT id FROM public.ligas WHERE name LIKE 'Liga Test%');
DELETE FROM public.liga_pair_stats
  WHERE liga_id IN (SELECT id FROM public.ligas WHERE name LIKE 'Liga Test%');
DELETE FROM public.liga_team_stats
  WHERE liga_id IN (SELECT id FROM public.ligas WHERE name LIKE 'Liga Test%');
DELETE FROM public.liga_standings
  WHERE liga_id IN (SELECT id FROM public.ligas WHERE name LIKE 'Liga Test%');
DELETE FROM public.liga_members
  WHERE liga_id IN (SELECT id FROM public.ligas WHERE name LIKE 'Liga Test%');
DELETE FROM public.ligas WHERE name LIKE 'Liga Test%';

-- 3. Related notifications
DELETE FROM public.notifications
  WHERE type = 'liga_invite'
    AND created_at > '2026-04-16 20:00:00+00'
    AND data->>'liga_id' IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.ligas WHERE id::text = data->>'liga_id'
    );

-- 4. Coaches (Pablo/Valeria dropped before profiles are deleted)
DELETE FROM public.coach_availability
  WHERE coach_id IN (SELECT id FROM public.coaches WHERE bio ILIKE '%Test data — safe to delete%');
DELETE FROM public.coaches WHERE bio ILIKE '%Test data — safe to delete%';

-- 5. Clubs + courts
DELETE FROM public.courts
  WHERE club_id IN (SELECT id FROM public.clubs WHERE name LIKE 'Club Test%');
DELETE FROM public.clubs WHERE name LIKE 'Club Test%';

-- 6. Test profiles
DELETE FROM public.profiles WHERE username LIKE 'testagent_%';

COMMIT;
