-- ============================================================
-- v13_00: Security fixes + data integrity constraints
-- Applied: 2026-04-13
-- Source: QA Report findings (6 agents, 75 tests)
-- ============================================================

-- ============================================================
-- PHASE 1: RLS SECURITY FIXES
-- Root cause: restricted policies shadowed by wide-open ones
-- ============================================================

-- 1.1 Courts: remove wide-open INSERT/UPDATE/DELETE
DROP POLICY IF EXISTS "courts_authenticated_write" ON courts;
DROP POLICY IF EXISTS "courts_authenticated_update" ON courts;
DROP POLICY IF EXISTS "courts_authenticated_delete" ON courts;

-- 1.2 Courts: add proper owner-restricted UPDATE/DELETE
CREATE POLICY "courts_update_club_owner" ON courts
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM clubs WHERE clubs.id = courts.club_id AND clubs.owner_user_id = auth.uid()));

CREATE POLICY "courts_delete_club_owner" ON courts
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM clubs WHERE clubs.id = courts.club_id AND clubs.owner_user_id = auth.uid()));

-- 1.3 Notifications: remove sender spoofing policy
DROP POLICY IF EXISTS "authenticated_insert_notifications" ON notifications;
-- Kept: notifications_insert_sender_only (auth.uid() = sender_id)

-- 1.4 Jornada participants: remove wide-open INSERT/UPDATE
DROP POLICY IF EXISTS "Authenticated users can insert jornada participants" ON jornada_participants;
DROP POLICY IF EXISTS "Authenticated users can update jornada participants" ON jornada_participants;
-- Kept: jornada_participants_insert_restricted, jornada_participants_update_restricted

-- 1.5 Liga team stats: remove wide-open INSERT/UPDATE
DROP POLICY IF EXISTS "Authenticated users can insert team stats" ON liga_team_stats;
DROP POLICY IF EXISTS "Authenticated users can update team stats" ON liga_team_stats;
-- Kept: liga_team_stats_insert_members, liga_team_stats_update_members

-- 1.6 Clubs: remove redundant SELECT that exposes inactive clubs
DROP POLICY IF EXISTS "clubs_select_all" ON clubs;
-- Kept: clubs_public_read (active = true)

-- 1.7 Remove exact duplicate policies
DROP POLICY IF EXISTS "jornada_checkins_insert" ON jornada_checkins;
DROP POLICY IF EXISTS "ligas_insert" ON ligas;
DROP POLICY IF EXISTS "ligas_update" ON ligas;
DROP POLICY IF EXISTS "liga_members_insert" ON liga_members;
DROP POLICY IF EXISTS "Admins can invite or users can join" ON liga_members;
DROP POLICY IF EXISTS "profiles_select_all" ON profiles;
DROP POLICY IF EXISTS "public_read_profiles" ON profiles;
DROP POLICY IF EXISTS "users_can_update_own_profile" ON profiles;

-- ============================================================
-- PHASE 1B: SECURITY DEFINER search_path fixes
-- Prevents search path injection attacks
-- ============================================================

CREATE OR REPLACE FUNCTION public.is_club_owner_or_admin(v_club_id integer, v_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.clubs
    WHERE id = v_club_id AND owner_user_id = v_user_id
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.get_user_club_ids(v_user_id uuid)
RETURNS SETOF integer
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT id FROM public.clubs WHERE owner_user_id = v_user_id;
$$;

-- Note: notify_friend_request, prevent_elo_self_update, get_available_slots,
-- get_club_availability_summary were also updated via CREATE OR REPLACE
-- with SET search_path TO 'public' (full function bodies preserved)

-- ============================================================
-- PHASE 2: BUG FIXES
-- ============================================================

-- 2.1 Score validation: no negative scores
ALTER TABLE liga_matches ADD CONSTRAINT chk_score_non_negative
  CHECK (score_team_a >= 0 AND score_team_b >= 0);

-- 2.2 Self-play prevention (null-safe for legacy columns)
ALTER TABLE liga_matches ADD CONSTRAINT chk_no_self_play
  CHECK (
    (team_a_player1 IS NULL OR team_a_player2 IS NULL OR team_a_player1 IS DISTINCT FROM team_a_player2) AND
    (team_a_player1 IS NULL OR team_b_player1 IS NULL OR team_a_player1 IS DISTINCT FROM team_b_player1) AND
    (team_a_player1 IS NULL OR team_b_player2 IS NULL OR team_a_player1 IS DISTINCT FROM team_b_player2) AND
    (team_a_player2 IS NULL OR team_b_player1 IS NULL OR team_a_player2 IS DISTINCT FROM team_b_player1) AND
    (team_a_player2 IS NULL OR team_b_player2 IS NULL OR team_a_player2 IS DISTINCT FROM team_b_player2) AND
    (team_b_player1 IS NULL OR team_b_player2 IS NULL OR team_b_player1 IS DISTINCT FROM team_b_player2)
  );

ALTER TABLE liga_matches ADD CONSTRAINT chk_no_self_play_id
  CHECK (
    (team_a_player1_id IS NULL OR team_a_player2_id IS NULL OR team_a_player1_id IS DISTINCT FROM team_a_player2_id) AND
    (team_a_player1_id IS NULL OR team_b_player1_id IS NULL OR team_a_player1_id IS DISTINCT FROM team_b_player1_id) AND
    (team_a_player1_id IS NULL OR team_b_player2_id IS NULL OR team_a_player1_id IS DISTINCT FROM team_b_player2_id) AND
    (team_a_player2_id IS NULL OR team_b_player1_id IS NULL OR team_a_player2_id IS DISTINCT FROM team_b_player1_id) AND
    (team_a_player2_id IS NULL OR team_b_player2_id IS NULL OR team_a_player2_id IS DISTINCT FROM team_b_player2_id) AND
    (team_b_player1_id IS NULL OR team_b_player2_id IS NULL OR team_b_player1_id IS DISTINCT FROM team_b_player2_id)
  );

-- 2.3 Max score validation trigger
CREATE OR REPLACE FUNCTION public.validate_liga_match_score()
RETURNS TRIGGER AS $$
DECLARE
  v_max_score INT;
BEGIN
  IF NEW.liga_id IS NOT NULL THEN
    SELECT max_score INTO v_max_score FROM ligas WHERE id = NEW.liga_id;
    IF v_max_score IS NOT NULL THEN
      IF NEW.score_team_a > v_max_score OR NEW.score_team_b > v_max_score THEN
        RAISE EXCEPTION 'Score (% - %) exceeds liga max_score of %',
          NEW.score_team_a, NEW.score_team_b, v_max_score;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path TO 'public';

CREATE TRIGGER trg_validate_liga_match_score
  BEFORE INSERT OR UPDATE ON liga_matches
  FOR EACH ROW EXECUTE FUNCTION validate_liga_match_score();

-- 2.4 ELO floor constraint
ALTER TABLE profiles ADD CONSTRAINT chk_elo_floor
  CHECK (elo_rating >= 800);

-- 2.5 Display name constraint
ALTER TABLE profiles ADD CONSTRAINT chk_display_name_not_empty
  CHECK (display_name IS NOT NULL AND display_name <> '');

-- 2.6 Fix transfer_crown() — correct column names
CREATE OR REPLACE FUNCTION public.transfer_crown(p_liga_id uuid)
RETURNS TABLE(previous_crowned_id uuid, new_crowned_id uuid, previous_points integer, new_points integer)
LANGUAGE plpgsql
AS $$
DECLARE
  v_current_crowned uuid;
  v_new_crowned uuid;
  v_current_points int;
  v_new_points int;
BEGIN
  SELECT player_id, total_points
  INTO v_current_crowned, v_current_points
  FROM liga_standings
  WHERE liga_id = p_liga_id AND has_crown = true
  LIMIT 1;

  SELECT player_id, total_points
  INTO v_new_crowned, v_new_points
  FROM liga_standings
  WHERE liga_id = p_liga_id
  ORDER BY total_points DESC, elo_rating DESC
  LIMIT 1;

  IF v_current_crowned IS DISTINCT FROM v_new_crowned THEN
    IF v_current_crowned IS NOT NULL THEN
      UPDATE liga_standings
      SET has_crown = false
      WHERE liga_id = p_liga_id AND player_id = v_current_crowned;
    END IF;

    UPDATE liga_standings
    SET has_crown = true
    WHERE liga_id = p_liga_id AND player_id = v_new_crowned;
  END IF;

  RETURN QUERY SELECT v_current_crowned, v_new_crowned, v_current_points, v_new_points;
END;
$$;
