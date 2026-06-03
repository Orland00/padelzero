-- ═══════════════════════════════════════════════════════════
-- LIGA PROLEAGUE — V6-04 ENABLE REALTIME
-- Run in Supabase SQL Editor AFTER v6_01 and v6_02
-- ═══════════════════════════════════════════════════════════

ALTER PUBLICATION supabase_realtime ADD TABLE public.ligas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.liga_members;
ALTER PUBLICATION supabase_realtime ADD TABLE public.jornadas;
ALTER PUBLICATION supabase_realtime ADD TABLE public.jornada_checkins;
ALTER PUBLICATION supabase_realtime ADD TABLE public.americano_rounds;
ALTER PUBLICATION supabase_realtime ADD TABLE public.americano_matches;
ALTER PUBLICATION supabase_realtime ADD TABLE public.liga_standings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crown_history;
