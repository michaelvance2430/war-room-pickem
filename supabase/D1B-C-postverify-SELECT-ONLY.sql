-- =============================================================================
-- D1B-C POST-VERIFY — SELECT ONLY (run after apply)
-- =============================================================================
-- No DDL / DML.
-- =============================================================================

-- V1. Members read policy — no tautology; uses is_league_member
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'achievements'
  AND policyname = 'Members read achievements';

SELECT
  (coalesce(qual, '') ILIKE '%is_league_member%') AS uses_is_league_member,
  (coalesce(qual, '') ILIKE '%achievements.league_id%'
    OR coalesce(qual, '') ILIKE '%is_league_member(league_id)%'
    OR coalesce(qual, '') ILIKE '%is_league_member(achievements.league_id)%') AS correlates_row_league,
  (coalesce(qual, '') ILIKE '%m.league_id = m.league_id%') AS still_has_tautology,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'achievements'
  AND policyname = 'Members read achievements';

-- V2. Commissioner INSERT unchanged (still present; correlated)
SELECT policyname, cmd, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'achievements'
  AND policyname = 'Commissioner grants achievements';

-- V3. Full policy set on achievements
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'achievements'
ORDER BY policyname;

-- V4. RLS still enabled
SELECT c.relname,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'achievements';

-- V5. Achievement count still zero (or unchanged inventory)
SELECT count(*)::bigint AS achievement_rows FROM public.achievements;

-- V6. Helper fingerprint unchanged intent
SELECT p.proname,
       p.prosecdef AS security_definer,
       (pg_get_functiondef(p.oid) ILIKE '%memberships%') AS body_refs_memberships
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'is_league_member'
  AND pg_get_function_identity_arguments(p.oid) = 'uuid';

-- END D1B-C POST-VERIFY
