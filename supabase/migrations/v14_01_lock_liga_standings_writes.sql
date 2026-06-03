-- P0-2 (Viktor 2.2, 2026-04-16): liga_standings UPDATE/INSERT was open to any
-- active member, letting a browser bypass the record_liga_match RPC and write
-- arbitrary standings. All legitimate writes run as SECURITY DEFINER and thus
-- bypass RLS. Lock member-writable policies. Same treatment for liga_team_stats.
--
-- Applied via Supabase migration name: lock_liga_standings_writes_p0

DROP POLICY IF EXISTS "liga_standings_member_write" ON public.liga_standings;
DROP POLICY IF EXISTS "liga_standings_member_insert" ON public.liga_standings;
DROP POLICY IF EXISTS "liga_team_stats_insert_members" ON public.liga_team_stats;
DROP POLICY IF EXISTS "liga_team_stats_update_members" ON public.liga_team_stats;
