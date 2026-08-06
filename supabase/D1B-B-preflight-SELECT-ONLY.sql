-- =============================================================================
-- D1B-B — SELECT-ONLY PREFLIGHT (membership / join authority)
-- =============================================================================
-- Safe on connected production Supabase (SELECT / catalog only).
-- NO DELETE / UPDATE / INSERT / DDL / RPC create.
-- Does NOT apply D1B-B. Does NOT remove membership INSERT policy.
-- Prefer connected-project automation over manual paste when available.
-- =============================================================================

-- P1. Complete live policies on memberships
SELECT policyname, cmd, roles, permissive, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'memberships'
ORDER BY policyname, cmd;

-- P2. Focused: client self-INSERT policy (product join surface)
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'memberships'
  AND (
    policyname ILIKE '%insert%membership%'
    OR policyname ILIKE '%own membership%'
    OR cmd = 'INSERT'
  );

-- P3. Live "Users insert own membership" shape (name may vary — catch all INSERT)
SELECT policyname, cmd, with_check, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'memberships'
  AND cmd IN ('INSERT', 'ALL');

-- P4. RLS enabled / forced on memberships + leagues
SELECT c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('memberships', 'leagues')
ORDER BY 1;

-- P5. Constraints / keys on memberships
SELECT conname, contype, pg_get_constraintdef(oid) AS def
FROM pg_constraint
WHERE conrelid = 'public.memberships'::regclass
ORDER BY contype, conname;

-- P6. Indexes on memberships
SELECT indexname, indexdef
FROM pg_indexes
WHERE schemaname = 'public' AND tablename = 'memberships'
ORDER BY indexname;

-- P7. leagues columns relevant to join (is_open, code, capacity signals)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'leagues'
  AND column_name IN (
    'id', 'code', 'commissioner_id', 'is_open', 'sport_id',
    'created_at', 'name'
  )
ORDER BY column_name;

-- P8. Row counts (aggregates only — no PII)
SELECT 'memberships'::text AS metric, count(*)::bigint AS n FROM public.memberships
UNION ALL
SELECT 'leagues', count(*)::bigint FROM public.leagues
UNION ALL
SELECT 'leagues_is_open_true', count(*)::bigint FROM public.leagues WHERE is_open IS TRUE
UNION ALL
SELECT 'leagues_is_open_false_or_null', count(*)::bigint
  FROM public.leagues WHERE is_open IS NOT TRUE
UNION ALL
SELECT 'memberships_role_commissioner', count(*)::bigint
  FROM public.memberships WHERE role::text ILIKE '%commissioner%'
UNION ALL
SELECT 'memberships_role_player', count(*)::bigint
  FROM public.memberships WHERE role::text ILIKE '%player%';

-- P9. Integrity: memberships missing league or user (evidence only)
SELECT count(*) AS memberships_orphan_league
FROM public.memberships m
WHERE NOT EXISTS (SELECT 1 FROM public.leagues l WHERE l.id = m.league_id);

SELECT count(*) AS memberships_orphan_profile
FROM public.memberships m
WHERE NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = m.user_id);

-- P10. Leagues over capacity (evidence — product max 32)
SELECT count(*) AS leagues_over_32
FROM (
  SELECT league_id, count(*) AS n
  FROM public.memberships
  GROUP BY league_id
  HAVING count(*) > 32
) s;

SELECT league_id, count(*) AS member_count
FROM public.memberships
GROUP BY league_id
HAVING count(*) > 32
ORDER BY member_count DESC
LIMIT 20;

-- P11. Closed leagues that still have memberships (normal) vs open flag inventory
SELECT
  count(*) FILTER (WHERE is_open IS TRUE) AS open_leagues,
  count(*) FILTER (WHERE is_open IS FALSE) AS closed_false,
  count(*) FILTER (WHERE is_open IS NULL) AS open_null
FROM public.leagues;

-- P12. Join-related RPCs already present (seed_trial_bots, etc.)
SELECT p.proname,
       pg_get_function_identity_arguments(p.oid) AS args,
       p.prosecdef AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND (
    p.proname ILIKE '%join%'
    OR p.proname ILIKE '%membership%'
    OR p.proname ILIKE '%seed_trial%'
    OR p.proname ILIKE '%create_league%'
    OR p.proname = 'record_league_first_join'
  )
ORDER BY p.proname;

-- P13. EXECUTE grants on seed_trial_bots / record_league_first_join (inventory)
SELECT routine_name, grantee, privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name IN (
    'seed_trial_bots',
    'record_league_first_join',
    'is_league_member',
    'is_league_commissioner'
  )
ORDER BY routine_name, grantee;

-- P14. Table grants on memberships (inventory only — H-01 separate)
SELECT grantee, privilege_type
FROM information_schema.role_table_grants
WHERE table_schema = 'public' AND table_name = 'memberships'
ORDER BY grantee, privilege_type;

-- P15. Confirm no D1B-B join RPCs exist yet (expected absent)
SELECT to_regprocedure('public.join_league_by_code(text)') AS join_by_code,
       to_regprocedure('public.join_open_league_by_id(uuid)') AS join_open_by_id,
       to_regprocedure('public.create_league_with_commissioner_seat()') AS create_league_rpc;

-- END D1B-B SELECT-ONLY PREFLIGHT
