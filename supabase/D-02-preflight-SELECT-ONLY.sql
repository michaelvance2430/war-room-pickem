-- =============================================================================
-- D-02 PREFLIGHT — SELECT ONLY — run ONE block at a time
-- =============================================================================
-- SAFE: catalog / inventory SELECT only. No DDL. No DML. No DELETE.
-- Proposed catalog = 20 ids from app listEasterEggDefs() (see design doc).
-- After full preflight: show Mike invalid inventory before any cleanup proposal.
-- DO NOT apply D-02 until Mike authorizes after reviewing results.
-- =============================================================================

-- ── Block 1. Live function definition + EXECUTE grants ──────────────────────
SELECT
  p.proname AS function_name,
  pg_get_function_identity_arguments(p.oid) AS args,
  p.prosecdef AS security_definer,
  p.proconfig AS proconfig,
  pg_get_functiondef(p.oid) AS function_def
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'record_easter_egg_find';

SELECT
  grantee,
  privilege_type,
  is_grantable
FROM information_schema.routine_privileges
WHERE routine_schema = 'public'
  AND routine_name = 'record_easter_egg_find'
  AND privilege_type = 'EXECUTE'
ORDER BY grantee;

-- ── Block 2. RLS policies on finds / flexes / catalog (if any) ─────────────
SELECT tablename, policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN (
    'easter_egg_finds',
    'egg_milestone_flexes',
    'easter_egg_catalog'
  )
ORDER BY tablename, cmd, policyname;

-- ── Block 3. Proposed 20-ID catalog verification (VALUES, not live table) ───
-- Expect: exactly 20 rows; use before apply to freeze intended seed.
WITH proposed AS (
  SELECT * FROM (VALUES
    ('egg_anniversary'),
    ('egg_curiosity_trophy'),
    ('egg_vonnaggio_gold'),
    ('egg_hidden_headline'),
    ('egg_leap_day'),
    ('egg_birthday'),
    ('egg_sibling_supremacy'),
    ('egg_lucky_seven'),
    ('egg_obsession'),
    ('egg_halloween'),
    ('egg_christmas'),
    ('egg_thanksgiving'),
    ('egg_newyear'),
    ('egg_three_peat'),
    ('egg_never_give_up'),
    ('egg_developer_thanks'),
    ('egg_impossible'),
    ('egg_mascot_scout'),
    ('egg_veterans'),
    ('egg_welcome_home')
  ) AS t(discovery_id)
)
SELECT
  count(*) AS proposed_count,
  count(*) = 20 AS is_exactly_20,
  string_agg(discovery_id, ', ' ORDER BY discovery_id) AS ids_sorted
FROM proposed;

-- Live catalog table presence (expect null/false before first apply)
SELECT
  to_regclass('public.easter_egg_catalog') AS easter_egg_catalog_regclass;

-- ── Block 4. Invalid discovery IDs inventory (not in proposed 20) ───────────
WITH proposed AS (
  SELECT discovery_id FROM (VALUES
    ('egg_anniversary'),
    ('egg_curiosity_trophy'),
    ('egg_vonnaggio_gold'),
    ('egg_hidden_headline'),
    ('egg_leap_day'),
    ('egg_birthday'),
    ('egg_sibling_supremacy'),
    ('egg_lucky_seven'),
    ('egg_obsession'),
    ('egg_halloween'),
    ('egg_christmas'),
    ('egg_thanksgiving'),
    ('egg_newyear'),
    ('egg_three_peat'),
    ('egg_never_give_up'),
    ('egg_developer_thanks'),
    ('egg_impossible'),
    ('egg_mascot_scout'),
    ('egg_veterans'),
    ('egg_welcome_home')
  ) AS t(discovery_id)
)
SELECT
  f.discovery_id AS invalid_discovery_id,
  count(*) AS row_count,
  count(DISTINCT f.user_id) AS affected_users
FROM public.easter_egg_finds f
LEFT JOIN proposed p ON p.discovery_id = f.discovery_id
WHERE p.discovery_id IS NULL
GROUP BY f.discovery_id
ORDER BY row_count DESC, f.discovery_id;

-- ── Block 5. Affected users (invalid finds) ────────────────────────────────
WITH proposed AS (
  SELECT discovery_id FROM (VALUES
    ('egg_anniversary'),
    ('egg_curiosity_trophy'),
    ('egg_vonnaggio_gold'),
    ('egg_hidden_headline'),
    ('egg_leap_day'),
    ('egg_birthday'),
    ('egg_sibling_supremacy'),
    ('egg_lucky_seven'),
    ('egg_obsession'),
    ('egg_halloween'),
    ('egg_christmas'),
    ('egg_thanksgiving'),
    ('egg_newyear'),
    ('egg_three_peat'),
    ('egg_never_give_up'),
    ('egg_developer_thanks'),
    ('egg_impossible'),
    ('egg_mascot_scout'),
    ('egg_veterans'),
    ('egg_welcome_home')
  ) AS t(discovery_id)
),
invalid AS (
  SELECT f.user_id, f.discovery_id, f.found_at
  FROM public.easter_egg_finds f
  LEFT JOIN proposed p ON p.discovery_id = f.discovery_id
  WHERE p.discovery_id IS NULL
)
SELECT
  i.user_id,
  coalesce(pr.display_name, '(no profile name)') AS display_name,
  count(*) AS invalid_find_count,
  string_agg(DISTINCT i.discovery_id, ', ' ORDER BY i.discovery_id) AS invalid_ids,
  min(i.found_at) AS first_invalid_at,
  max(i.found_at) AS last_invalid_at
FROM invalid i
LEFT JOIN public.profiles pr ON pr.id = i.user_id
GROUP BY i.user_id, pr.display_name
ORDER BY invalid_find_count DESC, i.user_id;

-- ── Block 6. Invalid-row counts summary ────────────────────────────────────
WITH proposed AS (
  SELECT discovery_id FROM (VALUES
    ('egg_anniversary'),
    ('egg_curiosity_trophy'),
    ('egg_vonnaggio_gold'),
    ('egg_hidden_headline'),
    ('egg_leap_day'),
    ('egg_birthday'),
    ('egg_sibling_supremacy'),
    ('egg_lucky_seven'),
    ('egg_obsession'),
    ('egg_halloween'),
    ('egg_christmas'),
    ('egg_thanksgiving'),
    ('egg_newyear'),
    ('egg_three_peat'),
    ('egg_never_give_up'),
    ('egg_developer_thanks'),
    ('egg_impossible'),
    ('egg_mascot_scout'),
    ('egg_veterans'),
    ('egg_welcome_home')
  ) AS t(discovery_id)
)
SELECT
  (SELECT count(*) FROM public.easter_egg_finds) AS total_find_rows,
  (
    SELECT count(*)
    FROM public.easter_egg_finds f
    JOIN proposed p ON p.discovery_id = f.discovery_id
  ) AS valid_find_rows,
  (
    SELECT count(*)
    FROM public.easter_egg_finds f
    LEFT JOIN proposed p ON p.discovery_id = f.discovery_id
    WHERE p.discovery_id IS NULL
  ) AS invalid_find_rows,
  (
    SELECT count(DISTINCT f.user_id)
    FROM public.easter_egg_finds f
    LEFT JOIN proposed p ON p.discovery_id = f.discovery_id
    WHERE p.discovery_id IS NULL
  ) AS users_with_invalid_finds,
  (SELECT count(*) FROM public.egg_milestone_flexes) AS total_flex_rows;

-- ── Block 7. Milestone flexes that may relate to invalid discoveries ───────
-- Flex rows do not store which egg fired them. Flag:
--   (a) flex owner has any invalid find
--   (b) flex.total not equal to proposed catalog size 20 (spoofed total signal)
--   (c) flex.found > user's valid (catalog) find count (over-count signal)
WITH proposed AS (
  SELECT discovery_id FROM (VALUES
    ('egg_anniversary'),
    ('egg_curiosity_trophy'),
    ('egg_vonnaggio_gold'),
    ('egg_hidden_headline'),
    ('egg_leap_day'),
    ('egg_birthday'),
    ('egg_sibling_supremacy'),
    ('egg_lucky_seven'),
    ('egg_obsession'),
    ('egg_halloween'),
    ('egg_christmas'),
    ('egg_thanksgiving'),
    ('egg_newyear'),
    ('egg_three_peat'),
    ('egg_never_give_up'),
    ('egg_developer_thanks'),
    ('egg_impossible'),
    ('egg_mascot_scout'),
    ('egg_veterans'),
    ('egg_welcome_home')
  ) AS t(discovery_id)
),
user_valid AS (
  SELECT f.user_id, count(*)::int AS valid_found
  FROM public.easter_egg_finds f
  JOIN proposed p ON p.discovery_id = f.discovery_id
  GROUP BY f.user_id
),
user_invalid AS (
  SELECT DISTINCT f.user_id
  FROM public.easter_egg_finds f
  LEFT JOIN proposed p ON p.discovery_id = f.discovery_id
  WHERE p.discovery_id IS NULL
)
SELECT
  fx.id AS flex_id,
  fx.finder_user_id,
  coalesce(pr.display_name, fx.finder_name) AS display_name,
  fx.finder_name AS stored_finder_name,
  fx.found AS flex_found,
  fx.total AS flex_total,
  fx.milestone,
  fx.created_at,
  coalesce(uv.valid_found, 0) AS user_valid_find_count,
  (ui.user_id IS NOT NULL) AS finder_has_invalid_finds,
  (fx.total IS DISTINCT FROM 20) AS flex_total_ne_proposed_20,
  (fx.found > coalesce(uv.valid_found, 0)) AS flex_found_gt_valid_count
FROM public.egg_milestone_flexes fx
LEFT JOIN user_valid uv ON uv.user_id = fx.finder_user_id
LEFT JOIN user_invalid ui ON ui.user_id = fx.finder_user_id
LEFT JOIN public.profiles pr ON pr.id = fx.finder_user_id
WHERE ui.user_id IS NOT NULL
   OR fx.total IS DISTINCT FROM 20
   OR fx.found > coalesce(uv.valid_found, 0)
ORDER BY fx.created_at DESC;

-- END D-02 PREFLIGHT SELECT ONLY
