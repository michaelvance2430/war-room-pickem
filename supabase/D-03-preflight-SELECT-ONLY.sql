-- =============================================================================
-- D-03 PREFLIGHT — SELECT ONLY — record_league_first_join / league_first_joins
-- =============================================================================
-- SAFE: catalog + inventory. No DDL. No DML. No DELETE of history.
-- Run one statement at a time in Supabase if multi-statement truncates results.
-- =============================================================================

-- ── 1. Function definition + grants ─────────────────────────────────────────
SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS args,
  p.prosecdef AS security_definer,
  p.proconfig,
  pg_get_functiondef(p.oid) AS function_def
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'record_league_first_join';

SELECT grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name = 'record_league_first_join'
  AND privilege_type = 'EXECUTE'
ORDER BY grantee;

-- ── 2. Policies on league_first_joins ───────────────────────────────────────
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'league_first_joins'
ORDER BY cmd, policyname;

-- ── 3. Orphan inventory: first-join without current membership ─────────────
-- NOTE: leavers may legitimately appear here (permanent first join product law).
SELECT
  f.league_id,
  f.user_id,
  f.first_joined_at,
  l.name AS league_name,
  p.display_name
FROM public.league_first_joins f
LEFT JOIN public.memberships m
  ON m.league_id = f.league_id AND m.user_id = f.user_id
LEFT JOIN public.leagues l ON l.id = f.league_id
LEFT JOIN public.profiles p ON p.id = f.user_id
WHERE m.id IS NULL
ORDER BY f.first_joined_at DESC
LIMIT 200;

-- ── 4. Counts ───────────────────────────────────────────────────────────────
SELECT
  (SELECT count(*) FROM public.league_first_joins) AS total_first_join_rows,
  (
    SELECT count(*)
    FROM public.league_first_joins f
    WHERE NOT EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.league_id = f.league_id AND m.user_id = f.user_id
    )
  ) AS orphan_first_join_rows,
  (
    SELECT count(DISTINCT f.user_id)
    FROM public.league_first_joins f
    WHERE NOT EXISTS (
      SELECT 1 FROM public.memberships m
      WHERE m.league_id = f.league_id AND m.user_id = f.user_id
    )
  ) AS users_with_orphan_first_joins;

-- END D-03 PREFLIGHT SELECT ONLY
