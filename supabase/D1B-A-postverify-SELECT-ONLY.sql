-- =============================================================================
-- D1B-A POST-VERIFY — SELECT ONLY (run after apply)
-- =============================================================================
-- No DDL / DML. Archive results for docs.
-- =============================================================================

-- V1. Manage-own policies must include is_league_member; pick_games WITH CHECK not null
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('picks', 'pick_games')
  AND policyname IN (
    'Users manage own picks',
    'Users manage own pick_games'
  )
ORDER BY tablename;

-- Expect:
-- picks:   qual and with_check both contain is_league_member(league_id)
-- pick_games: both contain is_league_member(p.league_id); with_check IS NOT NULL

-- V2. is_league_member present in both quals/with_checks (boolean checks)
SELECT
  tablename,
  policyname,
  (coalesce(qual, '') ILIKE '%is_league_member%') AS qual_has_member,
  (coalesce(with_check, '') ILIKE '%is_league_member%') AS with_check_has_member,
  (with_check IS NOT NULL) AS with_check_present
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('picks', 'pick_games')
  AND policyname IN (
    'Users manage own picks',
    'Users manage own pick_games'
  );

-- V3. Preserve other policies still exist (sample expected names — list all)
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('picks', 'pick_games')
ORDER BY tablename, policyname;

-- V4. Integrity counts still clean
SELECT 'picks'::text AS metric, count(*)::bigint AS n FROM public.picks
UNION ALL
SELECT 'pick_games', count(*)::bigint FROM public.pick_games
UNION ALL
SELECT 'picks_without_membership', count(*)::bigint
FROM public.picks p
WHERE NOT EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.league_id = p.league_id AND m.user_id = p.user_id
)
UNION ALL
SELECT 'pick_games_under_nonmember_picks', count(*)::bigint
FROM public.pick_games pg
JOIN public.picks p ON p.id = pg.pick_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.league_id = p.league_id AND m.user_id = p.user_id
)
UNION ALL
SELECT 'pick_games_orphan_parent', count(*)::bigint
FROM public.pick_games pg
WHERE NOT EXISTS (SELECT 1 FROM public.picks p WHERE p.id = pg.pick_id);

-- V5. Helper untouched fingerprint (definition still membership EXISTS)
SELECT p.proname,
       (pg_get_functiondef(p.oid) ILIKE '%memberships%') AS body_refs_memberships,
       p.prosecdef AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'is_league_member'
  AND pg_get_function_identity_arguments(p.oid) = 'uuid';

-- END D1B-A POST-VERIFY
