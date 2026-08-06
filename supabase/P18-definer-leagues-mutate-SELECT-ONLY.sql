-- =============================================================================
-- P18: SECURITY DEFINER residual risk — leagues DELETE/UPDATE body scan
-- =============================================================================
-- SAFE: catalog SELECT only. No DDL. No DML. No REVOKE. No CREATE OR REPLACE.
-- Next unresolved gate after P17 body review (P17 Blocks 3–4 skipped as redundant).
-- Complements: D0-rls-preflight P9b · D1A residual risk outside RLS
-- Do NOT apply remediations without Mike explicit authorization.
-- =============================================================================

-- ── Block 1. SECURITY DEFINER functions whose body can DELETE/UPDATE leagues ─
SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args,
  (
    SELECT string_agg(r.grantee, ', ' ORDER BY r.grantee)
    FROM information_schema.routine_privileges r
    WHERE r.routine_schema = 'public'
      AND r.routine_name = p.proname
      AND r.privilege_type = 'EXECUTE'
      AND r.grantee IN ('anon', 'authenticated', 'PUBLIC', 'service_role')
  ) AS execute_grantees_clientish,
  (pg_get_functiondef(p.oid) ~* 'delete\s+from\s+(public\.)?leagues') AS body_deletes_leagues,
  (pg_get_functiondef(p.oid) ~* 'update\s+(public\.)?leagues') AS body_updates_leagues,
  (pg_get_functiondef(p.oid) ~* 'auth\.uid\s*\(') AS body_mentions_auth_uid,
  (pg_get_functiondef(p.oid) ~* 'is_league_ops|is_deputy|commissioner') AS body_mentions_ops_or_commish,
  pg_get_functiondef(p.oid) AS function_def
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.prosecdef = true
  AND (
    pg_get_functiondef(p.oid) ~* 'delete\s+from\s+(public\.)?leagues'
    OR pg_get_functiondef(p.oid) ~* 'update\s+(public\.)?leagues'
  )
ORDER BY p.proname, 2;

-- END P18 SELECT ONLY (Block 1)
