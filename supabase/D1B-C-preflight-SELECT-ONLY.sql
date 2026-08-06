-- =============================================================================
-- D1B-C — SELECT-ONLY PREFLIGHT (achievements Members read)
-- =============================================================================
-- Safe one-block-at-a-time in Supabase SQL Editor.
-- NO DELETE / UPDATE / INSERT / DDL.
-- Does NOT apply D1B-C.
-- =============================================================================

-- P1. Complete live policies on achievements
SELECT policyname, cmd, roles, permissive, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'achievements'
ORDER BY policyname, cmd;

-- P2. Focused target policy
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'achievements'
  AND policyname = 'Members read achievements';

-- P3. Tautology / is_league_member flags on Members read
SELECT
  policyname,
  (coalesce(qual, '') ILIKE '%m.league_id = m.league_id%') AS has_tautology_literal,
  (coalesce(qual, '') ILIKE '%is_league_member%') AS uses_is_league_member,
  (coalesce(qual, '') ~ 'm\.league_id\s*=\s*league_id') AS has_unqualified_league_eq,
  qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'achievements'
  AND policyname = 'Members read achievements';

-- P4. RLS enabled / forced
SELECT c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname = 'achievements';

-- P5. Constraints / keys
SELECT conname, contype, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid = 'public.achievements'::regclass
ORDER BY contype, conname;

-- P6. Indexes
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'achievements'
ORDER BY indexname;

-- P7. Row counts
SELECT 'achievements'::text AS metric, count(*)::bigint AS n FROM public.achievements
UNION ALL
SELECT 'achievements_distinct_leagues', count(DISTINCT league_id)::bigint FROM public.achievements
UNION ALL
SELECT 'memberships', count(*)::bigint FROM public.memberships;

-- P8. Achievement rows whose (league_id, user_id) has no membership
-- Evidence only — do not DELETE
SELECT count(*) AS achievements_owner_not_member
FROM public.achievements a
WHERE NOT EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.league_id = a.league_id
    AND m.user_id = a.user_id
);

SELECT a.league_id, a.user_id, a.code, a.earned_at
FROM public.achievements a
WHERE NOT EXISTS (
  SELECT 1 FROM public.memberships m
  WHERE m.league_id = a.league_id
    AND m.user_id = a.user_id
)
ORDER BY a.earned_at
LIMIT 50;

-- P9. Live is_league_member definition (reuse check)
SELECT p.proname,
       pg_get_functiondef(p.oid) AS def,
       p.prosecdef AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'is_league_member'
  AND pg_get_function_identity_arguments(p.oid) = 'uuid';

-- P10. All policies currently using is_league_member (consumers after D1B-A)
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    coalesce(qual, '') ILIKE '%is_league_member%'
    OR coalesce(with_check, '') ILIKE '%is_league_member%'
  )
ORDER BY tablename, policyname;

-- P11. Table grants on achievements
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'achievements'
ORDER BY grantee, privilege_type;

-- P12. Preserve-list: Commissioner grants must remain
SELECT policyname, cmd, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'achievements'
  AND policyname ILIKE '%commissioner%';

-- END D1B-C SELECT-ONLY PREFLIGHT
