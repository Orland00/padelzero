-- ═══════════════════════════════════════════════════════════
-- v15_08b — Profiles PII: column-level grant (Fix 2 retry)
-- Column-level REVOKE cannot punch holes in a table-level
-- GRANT in PostgreSQL. Correct approach:
--   1. Revoke table-level SELECT from authenticated + anon
--   2. Re-grant only the 28 non-PII columns
-- Withheld: email, phone, age, gender
-- PII access for own row: use get_own_profile_pii() RPC
-- Updated: 2026-05-07
-- ═══════════════════════════════════════════════════════════

-- Step 1: Drop table-level SELECT grant
REVOKE SELECT ON public.profiles FROM authenticated;
REVOKE SELECT ON public.profiles FROM anon;

-- Step 2: Re-grant only non-PII columns to authenticated
GRANT SELECT (
  id,
  display_name,
  level_self,
  favorite_club_id,
  elo_rating,
  matches_played,
  matches_won,
  win_streak,
  best_streak,
  elo_peak,
  is_founder,
  created_at,
  updated_at,
  username,
  avatar_url,
  preferred_position,
  zone,
  last_match_at,
  city,
  country,
  last_title_won_at,
  favorite_club,
  is_dummy,
  preferred_language,
  level,
  preferred_side,
  achievements,
  role
) ON public.profiles TO authenticated;

-- anon gets no SELECT at all (RLS blocks all rows for anon anyway;
-- this adds defence-in-depth at the privilege layer)

NOTIFY pgrst, 'reload schema';
