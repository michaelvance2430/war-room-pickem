-- =============================================================================
-- P16: SECURITY DEFINER inventory / EXECUTE grants / search_path safety
-- =============================================================================
-- SAFE: catalog SELECT only. No DDL. No DML. No mutative RPCs.
-- Run ONE block at a time in Supabase SQL Editor. Archive each result set.
-- Do NOT apply D1A or any corrections without Mike explicit authorization.
-- Complements: D0-rls-preflight P9 / P10 / P11 · P15 complete archive
-- =============================================================================

-- ── Block 1. SECURITY DEFINER function inventory ────────────────────────────
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

-- ── Block 2. anon / authenticated EXECUTE grants ───────────────────────────
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

-- ── Block 3. SECURITY DEFINER search_path safety ────────────────────────────
-- Lists definer functions missing a fixed search_path=… config (risk surface).
SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args,
  p.proconfig AS proconfig
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

-- END P16 SELECT ONLY
