-- v15_10: Make liga score rules authoritative in Postgres.
-- The frontend validates schedule.rules.{maxScore,deadPoint,winByTwo}; this
-- helper mirrors that contract so direct RPC/table writes cannot bypass it.

CREATE OR REPLACE FUNCTION public.validate_liga_score_rules(
  p_liga_id uuid,
  p_score_team_a integer,
  p_score_team_b integer
)
RETURNS void
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_schedule jsonb;
  v_rules jsonb := '{}'::jsonb;
  v_rules_max_score text;
  v_legacy_schedule_max_score text;
  v_liga_max_score integer;
  v_max_score integer := 4;
  v_dead_point boolean := false;
  v_win_by_two boolean := false;
  v_winner_score integer;
  v_loser_score integer;
  v_difference integer;
BEGIN
  IF p_score_team_a IS NULL OR p_score_team_b IS NULL THEN
    RAISE EXCEPTION 'Marcador no válido';
  END IF;

  IF p_score_team_a < 0 OR p_score_team_b < 0 THEN
    RAISE EXCEPTION 'Marcador no válido';
  END IF;

  SELECT schedule, max_score
    INTO v_schedule, v_liga_max_score
  FROM public.ligas
  WHERE id = p_liga_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Liga not found';
  END IF;

  IF jsonb_typeof(v_schedule) = 'object' THEN
    IF jsonb_typeof(v_schedule->'rules') = 'object' THEN
      v_rules := v_schedule->'rules';
    END IF;
    v_legacy_schedule_max_score := v_schedule->>'max_score';
  END IF;

  v_rules_max_score := v_rules->>'maxScore';

  IF v_rules_max_score ~ '^[0-9]+$' THEN
    v_max_score := v_rules_max_score::integer;
  ELSIF v_legacy_schedule_max_score ~ '^[0-9]+$' THEN
    v_max_score := v_legacy_schedule_max_score::integer;
  ELSIF v_liga_max_score IS NOT NULL THEN
    v_max_score := v_liga_max_score;
  END IF;

  IF v_max_score <= 0 THEN
    v_max_score := 4;
  END IF;

  v_dead_point := COALESCE((v_rules->>'deadPoint')::boolean, false);
  v_win_by_two := COALESCE((v_rules->>'winByTwo')::boolean, false);

  IF p_score_team_a = p_score_team_b THEN
    RAISE EXCEPTION 'No se permiten empates';
  END IF;

  IF p_score_team_a > v_max_score OR p_score_team_b > v_max_score THEN
    RAISE EXCEPTION 'El marcador máximo es %', v_max_score;
  END IF;

  v_winner_score := GREATEST(p_score_team_a, p_score_team_b);
  v_loser_score := LEAST(p_score_team_a, p_score_team_b);
  v_difference := v_winner_score - v_loser_score;

  IF v_winner_score <> v_max_score THEN
    RAISE EXCEPTION 'El ganador debe llegar a %', v_max_score;
  END IF;

  IF v_dead_point THEN
    IF v_difference < 1 THEN
      RAISE EXCEPTION 'Con punto muerto debe haber ganador';
    END IF;
    RETURN;
  END IF;

  IF v_win_by_two AND v_difference < 2 THEN
    RAISE EXCEPTION 'Esta liga requiere ganar por 2 puntos';
  END IF;

  IF NOT v_win_by_two AND v_loser_score >= v_max_score THEN
    RAISE EXCEPTION 'El perdedor no puede llegar a %', v_max_score;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.validate_liga_match_score()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.liga_id IS NOT NULL THEN
    PERFORM public.validate_liga_score_rules(
      NEW.liga_id,
      NEW.score_team_a,
      NEW.score_team_b
    );
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'trg_validate_liga_match_score'
      AND tgrelid = 'public.liga_matches'::regclass
  ) THEN
    CREATE TRIGGER trg_validate_liga_match_score
      BEFORE INSERT OR UPDATE OF score_team_a, score_team_b, liga_id ON public.liga_matches
      FOR EACH ROW
      EXECUTE FUNCTION public.validate_liga_match_score();
  END IF;
END;
$$;

COMMENT ON FUNCTION public.validate_liga_score_rules(uuid, integer, integer) IS
  'Authoritative liga score validator. Mirrors src/lib/ligaRules.js using schedule.rules.maxScore, deadPoint and winByTwo.';

NOTIFY pgrst, 'reload schema';
