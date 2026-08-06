-- =============================================================================
-- D0 PREFLIGHT — SELECT ONLY — Live RLS / trigger / grants catalog
-- =============================================================================
-- SAFE: SELECT / catalog only. No DDL. No DML. No RPC that mutates.
-- Run in Supabase SQL Editor; save full result sets before any D0 apply.
-- =============================================================================

-- ── P0. Target tables RLS enabled / forced ──────────────────────────────────
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN (
    'leagues', 'memberships', 'profiles',
    'picks', 'pick_games',
    'achievements', 'crystal_ball_picks', 'crystal_ball_result',
    'league_trophies', 'week_cards', 'card_games',
    'week_results', 'game_results', 'announcements', 'gazette_editions'
  )
ORDER BY c.relname;

-- ── P1. Live policies on D0-affected + deputy-related tables ────────────────
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'leagues', 'picks', 'pick_games',
    'achievements', 'crystal_ball_picks', 'crystal_ball_result',
    'memberships', 'week_cards', 'card_games', 'week_results', 'game_results'
  )
ORDER BY tablename, cmd, policyname;

-- ── P2. Tautology / self-comparison detector (string scan) ──────────────────
SELECT
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    coalesce(qual, '') ~* 'm\.league_id\s*=\s*m\.league_id'
    OR coalesce(with_check, '') ~* 'm\.league_id\s*=\s*m\.league_id'
    OR coalesce(qual, '') ~* 'league_id\s*=\s*league_id'
    OR coalesce(with_check, '') ~* 'league_id\s*=\s*league_id'
  )
ORDER BY tablename, policyname;

-- ── P3. Hardcoded 2026 crystal-ball freeze literals ─────────────────────────
SELECT
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename LIKE 'crystal_ball%'
  AND (
    coalesce(qual, '') LIKE '%2026%'
    OR coalesce(with_check, '') LIKE '%2026%'
  )
ORDER BY policyname;

-- ── P4. League DELETE policies (ARCHIVE NAMES for D1A — exact list) ────────
-- D1A may DROP only these verified names. No wildcards.
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'leagues'
  AND cmd = 'DELETE'
ORDER BY policyname;

-- Machine-friendly name list for D1A freeze:
SELECT policyname AS d1a_delete_policy_to_drop
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'leagues'
  AND cmd = 'DELETE'
ORDER BY policyname;

-- ── P5. League UPDATE policies (duplicate commissioner / ops) ───────────────
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'leagues'
  AND cmd = 'UPDATE'
ORDER BY policyname;

-- ── P6. Sport immutability function + trigger ───────────────────────────────
SELECT
  p.proname AS function_name,
  pg_get_functiondef(p.oid) AS function_def
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'leagues_sport_id_immutable';

SELECT
  t.tgname AS trigger_name,
  t.tgenabled AS enabled_code,
  -- O = origin, D = disabled, R = replica, A = always
  CASE t.tgenabled
    WHEN 'O' THEN 'enabled_origin'
    WHEN 'D' THEN 'disabled'
    WHEN 'R' THEN 'replica'
    WHEN 'A' THEN 'always'
    ELSE t.tgenabled::text
  END AS enabled_label,
  c.relname AS table_name,
  pg_get_triggerdef(t.oid) AS trigger_def
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND t.tgname = 'leagues_sport_id_immutable_trg'
  AND NOT t.tgisinternal;

-- ── P7. Critical unique constraints ─────────────────────────────────────────
SELECT
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) AS columns
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON kcu.constraint_name = tc.constraint_name
 AND kcu.table_schema = tc.table_schema
WHERE tc.table_schema = 'public'
  AND tc.constraint_type IN ('UNIQUE', 'PRIMARY KEY')
  AND tc.table_name IN (
    'leagues', 'memberships', 'picks', 'pick_games',
    'achievements', 'crystal_ball_picks', 'crystal_ball_result',
    'week_cards', 'week_results'
  )
GROUP BY tc.table_name, tc.constraint_name, tc.constraint_type
ORDER BY tc.table_name, tc.constraint_name;

-- ── P8. Postseason snapshot table presence ──────────────────────────────────
SELECT
  to_regclass('public.league_postseason_snapshots') AS league_postseason_snapshots,
  to_regclass('public.league_postseason_snapshot_entries') AS entries_if_any;

SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name ILIKE '%postseason%'
ORDER BY table_name;

-- ── P9. SECURITY DEFINER functions in public ───────────────────────────────
SELECT
  n.nspname AS schema,
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args,
  p.prosecdef AS security_definer,
  p.proconfig AS proconfig_search_path
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef = true
ORDER BY p.proname;

-- ── P9b. SECURITY DEFINER functions that mention leagues DELETE/UPDATE ───
-- Residual risk outside RLS (service-style RPCs). Catalog only.
SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS args,
  pg_get_functiondef(p.oid) AS def
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef = true
  AND pg_get_functiondef(p.oid) ~* 'leagues'
  AND (
    pg_get_functiondef(p.oid) ~* 'delete\s+from\s+public\.leagues'
    OR pg_get_functiondef(p.oid) ~* 'update\s+public\.leagues'
  )
ORDER BY p.proname;

-- ── P10. EXECUTE grants to anon / authenticated (public functions) ──────────
SELECT
  routine_schema,
  routine_name,
  grantee,
  privilege_type
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND grantee IN ('anon', 'authenticated', 'PUBLIC')
  AND privilege_type = 'EXECUTE'
ORDER BY routine_name, grantee;

-- ── P11. Definer functions missing search_path config ───────────────────────
SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS args,
  p.proconfig
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef = true
  AND (
    p.proconfig IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM unnest(coalesce(p.proconfig, array[]::text[])) cfg
      WHERE cfg LIKE 'search_path=%'
    )
  )
ORDER BY p.proname;

-- ── P12. Deputy authorization map (do not change these in D0) ───────────────
SELECT
  tablename,
  policyname,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND (
    coalesce(qual, '') ILIKE '%is_league_ops%'
    OR coalesce(with_check, '') ILIKE '%is_league_ops%'
    OR coalesce(qual, '') ILIKE '%is_deputy%'
    OR coalesce(with_check, '') ILIKE '%is_deputy%'
  )
ORDER BY tablename, policyname;

SELECT
  p.proname,
  pg_get_functiondef(p.oid) AS def
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'is_league_ops';

-- ── P13. league_trophies policies (document only — no D0 change) ────────────
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename = 'league_trophies'
ORDER BY policyname;

-- ── P14. picks / pick_games manage-own policy text ──────────────────────────
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('picks', 'pick_games')
ORDER BY tablename, policyname;

-- END D0 PREFLIGHT SELECT ONLY
