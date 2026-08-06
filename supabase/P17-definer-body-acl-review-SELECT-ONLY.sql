-- =============================================================================
-- P17: SECURITY DEFINER body + ACL review — SELECT ONLY
-- =============================================================================
-- SAFE: catalog SELECT only. No DDL. No DML. No REVOKE. No CREATE OR REPLACE.
-- Run AFTER P16 Block 3 is archived. Run blocks one at a time if result sets are large.
--
-- Purpose (map only — no remediation):
--   1) Each public SECURITY DEFINER function
--   2) Exact EXECUTE grantees
--   3) Body text for auth.uid / membership / commissioner / ops / service-role guards
--   4) Anonymously callable (EXECUTE to anon or PUBLIC)
--   5) Trigger-only vs RPC-callable (attached as trigger function?)
--
-- PUBLIC grants = treat as broadly executable.
-- Do NOT revoke grants or alter functions without Mike explicit authorization.
-- =============================================================================

-- ── Block 1. DEFINER inventory + EXECUTE grantees + anonymous flag ───────────
WITH definers AS (
  SELECT
    p.oid,
    n.nspname AS schema_name,
    p.proname AS function_name,
    pg_get_function_identity_arguments(p.oid) AS args,
    p.prokind,
    CASE p.prokind
      WHEN 'f' THEN 'function'
      WHEN 'p' THEN 'procedure'
      WHEN 'a' THEN 'aggregate'
      WHEN 'w' THEN 'window'
      ELSE p.prokind::text
    END AS kind_label,
    p.prosecdef AS security_definer,
    p.proconfig AS proconfig,
    pg_get_functiondef(p.oid) AS function_def
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.prosecdef = true
),
grants AS (
  SELECT
    routine_schema,
    routine_name,
    -- identity args not in routine_privileges; join by name only (overload-aware follow-up if needed)
    string_agg(DISTINCT grantee, ', ' ORDER BY grantee) AS execute_grantees,
    bool_or(grantee = 'anon') AS grant_anon,
    bool_or(grantee = 'authenticated') AS grant_authenticated,
    bool_or(grantee = 'PUBLIC') AS grant_public,
    bool_or(grantee IN ('anon', 'PUBLIC')) AS anonymously_callable
  FROM information_schema.routine_privileges
  WHERE routine_schema = 'public'
    AND privilege_type = 'EXECUTE'
    AND grantee IN ('anon', 'authenticated', 'PUBLIC', 'service_role', 'postgres', 'supabase_admin')
  GROUP BY routine_schema, routine_name
),
trigger_use AS (
  SELECT DISTINCT
    t.tgfoid AS function_oid,
    true AS used_as_trigger,
    string_agg(DISTINCT c.relname || '.' || t.tgname, ', ' ORDER BY c.relname || '.' || t.tgname)
      AS trigger_attachments
  FROM pg_trigger t
  JOIN pg_class c ON c.oid = t.tgrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND NOT t.tgisinternal
  GROUP BY t.tgfoid
)
SELECT
  d.schema_name,
  d.function_name,
  d.args,
  d.kind_label,
  d.proconfig,
  coalesce(g.execute_grantees, '(no matching grants in filtered set)') AS execute_grantees,
  coalesce(g.grant_anon, false) AS grant_anon,
  coalesce(g.grant_authenticated, false) AS grant_authenticated,
  coalesce(g.grant_public, false) AS grant_public,
  coalesce(g.anonymously_callable, false) AS anonymously_callable,
  coalesce(tu.used_as_trigger, false) AS used_as_trigger,
  tu.trigger_attachments,
  CASE
    WHEN coalesce(tu.used_as_trigger, false) AND NOT coalesce(g.anonymously_callable, false)
      AND NOT coalesce(g.grant_authenticated, false)
      THEN 'likely_trigger_only_or_restricted'
    WHEN coalesce(tu.used_as_trigger, false) AND coalesce(g.anonymously_callable, false)
      THEN 'trigger_AND_rpc_surface'
    WHEN NOT coalesce(tu.used_as_trigger, false)
      THEN 'rpc_or_direct_callable'
    ELSE 'mixed_or_review'
  END AS call_surface_label,
  -- Guard heuristics (string scan of definition — not a proof of security)
  (d.function_def ~* 'auth\.uid\s*\(') AS body_mentions_auth_uid,
  (d.function_def ~* 'auth\.role\s*\(') AS body_mentions_auth_role,
  (d.function_def ~* 'service_role|current_setting\s*\(\s*''request\.jwt') AS body_mentions_service_or_jwt,
  (d.function_def ~* 'is_league_ops|is_deputy|commissioner') AS body_mentions_ops_or_commish,
  (d.function_def ~* 'memberships') AS body_mentions_memberships,
  (d.function_def ~* 'raise\s+exception|return\s+null|if\s+auth\.uid') AS body_mentions_raise_or_uid_branch,
  length(d.function_def) AS def_chars
FROM definers d
LEFT JOIN grants g
  ON g.routine_schema = d.schema_name
 AND g.routine_name = d.function_name
LEFT JOIN trigger_use tu ON tu.function_oid = d.oid
ORDER BY
  coalesce(g.anonymously_callable, false) DESC,
  d.function_name,
  d.args;

-- ── Block 2. Full definitions + ACLs — anonymously callable DEFINER only ──
-- SELECT ONLY. Focused on anon and/or PUBLIC EXECUTE. Complete body + exact ACL.
WITH anon_callable AS (
  SELECT DISTINCT r.routine_name
  FROM information_schema.routine_privileges r
  WHERE r.routine_schema = 'public'
    AND r.privilege_type = 'EXECUTE'
    AND r.grantee IN ('anon', 'PUBLIC')
)
SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args,
  (
    SELECT string_agg(r.grantee, ', ' ORDER BY r.grantee)
    FROM information_schema.routine_privileges r
    WHERE r.routine_schema = 'public'
      AND r.routine_name = p.proname
      AND r.privilege_type = 'EXECUTE'
  ) AS execute_grantees_all,
  (
    SELECT string_agg(r.grantee, ', ' ORDER BY r.grantee)
    FROM information_schema.routine_privileges r
    WHERE r.routine_schema = 'public'
      AND r.routine_name = p.proname
      AND r.privilege_type = 'EXECUTE'
      AND r.grantee IN ('anon', 'PUBLIC')
  ) AS execute_grantees_anonymous,
  EXISTS (
    SELECT 1
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace tn ON tn.oid = c.relnamespace
    WHERE t.tgfoid = p.oid
      AND NOT t.tgisinternal
  ) AS used_as_trigger_any_schema,
  (
    SELECT string_agg(
      tn.nspname || '.' || c.relname || '.' || t.tgname,
      ', ' ORDER BY tn.nspname, c.relname, t.tgname
    )
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace tn ON tn.oid = c.relnamespace
    WHERE t.tgfoid = p.oid
      AND NOT t.tgisinternal
  ) AS trigger_attachments_any_schema,
  pg_get_functiondef(p.oid) AS function_def
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN anon_callable ac ON ac.routine_name = p.proname
WHERE n.nspname = 'public'
  AND p.prosecdef = true
ORDER BY p.proname, 2;

-- ── Block 3. Anonymously executable DEFINER only (anon or PUBLIC EXECUTE) ───
SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args,
  string_agg(DISTINCT r.grantee, ', ' ORDER BY r.grantee) AS execute_grantees,
  left(pg_get_functiondef(p.oid), 4000) AS function_def_prefix
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
JOIN information_schema.routine_privileges r
  ON r.routine_schema = n.nspname
 AND r.routine_name = p.proname
 AND r.privilege_type = 'EXECUTE'
 AND r.grantee IN ('anon', 'PUBLIC')
WHERE n.nspname = 'public'
  AND p.prosecdef = true
GROUP BY p.oid, p.proname
ORDER BY p.proname;

-- ── Block 4. Full EXECUTE ACL (all grantees, not just client roles) ──────────
SELECT
  r.routine_schema,
  r.routine_name,
  r.grantee,
  r.privilege_type,
  r.is_grantable
FROM information_schema.routine_privileges r
WHERE r.routine_schema = 'public'
  AND r.privilege_type = 'EXECUTE'
  AND r.routine_name IN (
    SELECT p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
  )
ORDER BY r.routine_name, r.grantee;

-- END P17 SELECT ONLY
