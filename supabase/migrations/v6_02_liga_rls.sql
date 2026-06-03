-- ═══════════════════════════════════════════════════════════
-- LIGA PROLEAGUE — V6-02 RLS POLICIES
-- Run in Supabase SQL Editor AFTER v6_01
-- ═══════════════════════════════════════════════════════════

-- Enable RLS on all tables
ALTER TABLE public.ligas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liga_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jornadas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jornada_checkins ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.americano_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.americano_matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.liga_standings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crown_history ENABLE ROW LEVEL SECURITY;

-- ── ligas ──
-- Anyone authenticated can read active ligas
CREATE POLICY "Anyone can read active ligas" ON public.ligas
  FOR SELECT USING (is_active = true);

-- Authenticated users can create ligas
CREATE POLICY "Authenticated users can create ligas" ON public.ligas
  FOR INSERT WITH CHECK (auth.uid() = created_by);

-- Only creator can update/delete
CREATE POLICY "Creator can update own liga" ON public.ligas
  FOR UPDATE USING (auth.uid() = created_by);

CREATE POLICY "Creator can delete own liga" ON public.ligas
  FOR DELETE USING (auth.uid() = created_by);

-- ── liga_members ──
-- Members can see their liga's members
CREATE POLICY "Members can read liga members" ON public.liga_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.liga_members my
      WHERE my.liga_id = liga_members.liga_id
      AND my.player_id = auth.uid()
    )
  );

-- Anyone authenticated can join (insert themselves)
CREATE POLICY "Users can join ligas" ON public.liga_members
  FOR INSERT WITH CHECK (auth.uid() = player_id);

-- Admin can remove members, players can remove themselves
CREATE POLICY "Admin or self can delete membership" ON public.liga_members
  FOR DELETE USING (
    auth.uid() = player_id
    OR EXISTS (
      SELECT 1 FROM public.liga_members admin
      WHERE admin.liga_id = liga_members.liga_id
      AND admin.player_id = auth.uid()
      AND admin.role = 'admin'
    )
  );

-- ── jornadas ──
-- Liga members can read jornadas
CREATE POLICY "Members can read jornadas" ON public.jornadas
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.liga_members
      WHERE liga_id = jornadas.liga_id
      AND player_id = auth.uid()
    )
  );

-- Admin can create/update jornadas
CREATE POLICY "Admin can create jornadas" ON public.jornadas
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.liga_members
      WHERE liga_id = jornadas.liga_id
      AND player_id = auth.uid()
      AND role = 'admin'
    )
  );

CREATE POLICY "Admin can update jornadas" ON public.jornadas
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.liga_members
      WHERE liga_id = jornadas.liga_id
      AND player_id = auth.uid()
      AND role = 'admin'
    )
  );

-- ── jornada_checkins ──
-- Members can read checkins for their liga's jornadas
CREATE POLICY "Members can read checkins" ON public.jornada_checkins
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.jornadas j
      JOIN public.liga_members lm ON lm.liga_id = j.liga_id
      WHERE j.id = jornada_checkins.jornada_id
      AND lm.player_id = auth.uid()
    )
  );

-- Players can check themselves in
CREATE POLICY "Players can check in" ON public.jornada_checkins
  FOR INSERT WITH CHECK (auth.uid() = player_id);

-- Players can remove own check-in, admin can remove any
CREATE POLICY "Self or admin can delete checkin" ON public.jornada_checkins
  FOR DELETE USING (
    auth.uid() = player_id
    OR EXISTS (
      SELECT 1 FROM public.jornadas j
      JOIN public.liga_members lm ON lm.liga_id = j.liga_id
      WHERE j.id = jornada_checkins.jornada_id
      AND lm.player_id = auth.uid()
      AND lm.role = 'admin'
    )
  );

-- ── americano_rounds ──
-- Members can read rounds
CREATE POLICY "Members can read rounds" ON public.americano_rounds
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.jornadas j
      JOIN public.liga_members lm ON lm.liga_id = j.liga_id
      WHERE j.id = americano_rounds.jornada_id
      AND lm.player_id = auth.uid()
    )
  );

-- Admin can create rounds (via generateRounds)
CREATE POLICY "Admin can create rounds" ON public.americano_rounds
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.jornadas j
      JOIN public.liga_members lm ON lm.liga_id = j.liga_id
      WHERE j.id = americano_rounds.jornada_id
      AND lm.player_id = auth.uid()
      AND lm.role = 'admin'
    )
  );

-- Admin can update round status
CREATE POLICY "Admin can update rounds" ON public.americano_rounds
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.jornadas j
      JOIN public.liga_members lm ON lm.liga_id = j.liga_id
      WHERE j.id = americano_rounds.jornada_id
      AND lm.player_id = auth.uid()
      AND lm.role = 'admin'
    )
  );

-- ── americano_matches ──
-- Members can read matches
CREATE POLICY "Members can read matches" ON public.americano_matches
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.americano_rounds r
      JOIN public.jornadas j ON j.id = r.jornada_id
      JOIN public.liga_members lm ON lm.liga_id = j.liga_id
      WHERE r.id = americano_matches.round_id
      AND lm.player_id = auth.uid()
    )
  );

-- Admin can create matches
CREATE POLICY "Admin can create matches" ON public.americano_matches
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.americano_rounds r
      JOIN public.jornadas j ON j.id = r.jornada_id
      JOIN public.liga_members lm ON lm.liga_id = j.liga_id
      WHERE r.id = americano_matches.round_id
      AND lm.player_id = auth.uid()
      AND lm.role = 'admin'
    )
  );

-- Members can update match scores (any liga member can enter scores)
CREATE POLICY "Members can update match scores" ON public.americano_matches
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.americano_rounds r
      JOIN public.jornadas j ON j.id = r.jornada_id
      JOIN public.liga_members lm ON lm.liga_id = j.liga_id
      WHERE r.id = americano_matches.round_id
      AND lm.player_id = auth.uid()
    )
  );

-- ── liga_standings ──
-- Public read for active ligas
CREATE POLICY "Anyone can read standings" ON public.liga_standings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.ligas
      WHERE id = liga_standings.liga_id
      AND is_active = true
    )
  );

-- Service role / edge function handles inserts and updates
-- Allow admin to insert/update for manual corrections
CREATE POLICY "Admin can manage standings" ON public.liga_standings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.liga_members
      WHERE liga_id = liga_standings.liga_id
      AND player_id = auth.uid()
      AND role = 'admin'
    )
  );

-- ── crown_history ──
-- Public read
CREATE POLICY "Anyone can read crown history" ON public.crown_history
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.ligas
      WHERE id = crown_history.liga_id
      AND is_active = true
    )
  );

-- Admin can insert crown history
CREATE POLICY "Admin can insert crown history" ON public.crown_history
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.liga_members
      WHERE liga_id = crown_history.liga_id
      AND player_id = auth.uid()
      AND role = 'admin'
    )
  );
