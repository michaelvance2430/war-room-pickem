-- =============================================================================
-- D1B-B / 10-postverify-SELECT-ONLY.sql
-- REVIEW ONLY — run after an authorized stage apply
-- SELECT only
-- =============================================================================

-- V1 RPCs present + grants (no PUBLIC if intended)
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS args,
       p.prosecdef AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname in (
    'create_league_with_commissioner_seat',
    'join_league_by_code',
    'join_open_league_by_id',
    'list_open_leagues_public',
    'd1b_b_human_member_count'
  )
ORDER BY 1;

SELECT routine_name, grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name in (
    'create_league_with_commissioner_seat',
    'join_league_by_code',
    'join_open_league_by_id',
    'list_open_leagues_public'
  )
ORDER BY 1, 2;

-- V2 max_human_members column + nulls
SELECT
  count(*) AS leagues,
  count(max_human_members) AS with_max,
  count(*) FILTER (WHERE max_human_members IS NULL) AS null_max
FROM public.leagues;

-- V3 membership INSERT policy still present until stage 10
SELECT policyname, cmd, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'memberships'
  AND cmd IN ('INSERT', 'ALL');

-- V4 no membership row loss (compare to preflight archive counts)
SELECT
  count(*) AS memberships,
  count(*) FILTER (WHERE coalesce(is_bot, false) = false) AS humans,
  count(*) FILTER (WHERE coalesce(is_bot, false) = true) AS bots
FROM public.memberships;

-- V5 leagues SELECT still broad until stage 14 (expect USING true still)
SELECT policyname, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'leagues'
  AND cmd = 'SELECT';

-- END 10 POST-VERIFY
