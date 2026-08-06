-- =============================================================================
-- D1B-A — SELECT-ONLY PREFLIGHT
-- =============================================================================
-- Safe to run in Supabase SQL Editor one block at a time.
-- NO DELETE / UPDATE / INSERT / DDL.
-- Does NOT apply D1B-A.
-- Archive results before any apply authorization.
-- =============================================================================

-- P1. Complete live policies for picks
SELECT policyname, cmd, roles, permissive, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'picks'
ORDER BY policyname, cmd;

-- P2. Complete live policies for pick_games
SELECT policyname, cmd, roles, permissive, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'pick_games'
ORDER BY policyname, cmd;

-- P3. RLS enabled / forced
SELECT c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('picks', 'pick_games')
ORDER BY 1;

-- P4. Constraints and keys linking pick_games → picks
SELECT conname, contype, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid = 'public.pick_games'::regclass
ORDER BY contype, conname;

SELECT conname, contype, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid = 'public.picks'::regclass
ORDER BY contype, conname;

-- P5. Relevant indexes
SELECT tablename, indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename IN ('picks', 'pick_games')
ORDER BY tablename, indexname;

-- P6. Row counts
SELECT 'picks'::text AS table_name, count(*)::bigint AS n FROM public.picks
UNION ALL
SELECT 'pick_games', count(*)::bigint FROM public.pick_games
UNION ALL
SELECT 'memberships', count(*)::bigint FROM public.memberships;

-- P7. Picks whose owner lacks membership in picks.league_id
-- EVIDENCE ONLY — do not DELETE/UPDATE
SELECT count(*) AS picks_without_membership
FROM public.picks p
WHERE NOT EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.league_id = p.league_id
    AND m.user_id = p.user_id
);

SELECT p.id, p.league_id, p.user_id, p.week_number
FROM public.picks p
WHERE NOT EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.league_id = p.league_id
    AND m.user_id = p.user_id
)
ORDER BY p.created_at
LIMIT 50;

-- P8. pick_games whose parent pick owner lacks target-league membership
SELECT count(*) AS pick_games_under_nonmember_picks
FROM public.pick_games pg
JOIN public.picks p ON p.id = pg.pick_id
WHERE NOT EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.league_id = p.league_id
    AND m.user_id = p.user_id
);

-- P9. Rows with missing / invalid parent picks
SELECT count(*) AS pick_games_orphan_parent
FROM public.pick_games pg
WHERE NOT EXISTS (
  SELECT 1 FROM public.picks p WHERE p.id = pg.pick_id
);

-- P10. Exact live definition of is_league_member(uuid)
SELECT p.proname,
       pg_get_functiondef(p.oid) AS def,
       p.prosecdef AS security_definer,
       p.provolatile,
       p.proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'is_league_member'
  AND pg_get_function_identity_arguments(p.oid) = 'uuid';

-- EXECUTE grants on helper
SELECT grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name = 'is_league_member';

-- P11. Policies whose qual/with_check reference is_league_member
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    coalesce(qual, '') ILIKE '%is_league_member%'
    OR coalesce(with_check, '') ILIKE '%is_league_member%'
  )
ORDER BY tablename, policyname;

-- P12. Table grants on picks / pick_games
SELECT table_name, grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public'
  AND table_name IN ('picks', 'pick_games')
ORDER BY table_name, grantee, privilege_type;

-- P13. Focused manage-own policy defs (drift vs D1B-A proposal)
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('picks', 'pick_games')
  AND policyname IN (
    'Users manage own picks',
    'Users manage own pick_games'
  );

-- P14. Preserve-list presence (must remain after apply)
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('picks', 'pick_games')
  AND (
    policyname ILIKE '%ops%'
    OR policyname ILIKE '%member%'
    OR policyname ILIKE '%commissioner%'
    OR policyname ILIKE '%locked%'
    OR policyname ILIKE '%scored%'
  )
ORDER BY tablename, policyname;

-- END D1B-A SELECT-ONLY PREFLIGHT
