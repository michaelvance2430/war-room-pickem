-- =============================================================================
-- P15: Remaining structural/security evidence — SELECT ONLY
-- =============================================================================
-- SAFE: catalog SELECT only. No DDL. No DML. No RPCs that mutate.
-- Run in Supabase → SQL Editor. Archive full result sets before D1A/D1B apply.
-- Complements: D0-rls-preflight-SELECT-ONLY.sql (P0–P14)
-- =============================================================================

-- 1. Is RLS enabled and forced on leagues?
SELECT
  c.relname AS table_name,
  c.relrowsecurity AS rls_enabled,
  c.relforcerowsecurity AS rls_forced
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'leagues';

-- 2. Show the complete sport-immutability trigger definition
SELECT
  t.tgname AS trigger_name,
  t.tgenabled AS enabled_status,
  pg_get_triggerdef(t.oid, true) AS trigger_definition
FROM pg_trigger t
JOIN pg_class c ON c.oid = t.tgrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname = 'leagues'
  AND NOT t.tgisinternal;

-- Optional: function body (pairs with trigger)
SELECT
  p.proname AS function_name,
  pg_get_functiondef(p.oid) AS function_def
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'leagues_sport_id_immutable';

-- 3. List public-table unique constraints
SELECT
  tc.table_name,
  tc.constraint_name,
  string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) AS columns
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
  ON kcu.constraint_schema = tc.constraint_schema
 AND kcu.constraint_name = tc.constraint_name
 AND kcu.table_name = tc.table_name
WHERE tc.constraint_schema = 'public'
  AND tc.constraint_type = 'UNIQUE'
GROUP BY tc.table_name, tc.constraint_name
ORDER BY tc.table_name, tc.constraint_name;

-- 4. Locate postseason-related tables
SELECT tablename
FROM pg_tables
WHERE schemaname = 'public'
  AND (
    tablename ILIKE '%postseason%'
    OR tablename ILIKE '%playoff%'
    OR tablename ILIKE '%bracket%'
  )
ORDER BY tablename;

-- END P15 SELECT ONLY
