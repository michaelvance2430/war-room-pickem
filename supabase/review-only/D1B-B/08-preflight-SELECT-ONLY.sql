-- =============================================================================
-- D1B-B / 08-preflight-SELECT-ONLY.sql
-- REVIEW ONLY PREFLIGHT before ANY stage apply
-- SELECT only — safe on production
-- =============================================================================

-- Schema readiness for max_human_members
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'leagues'
  AND column_name = 'max_human_members';

-- Membership INSERT / UPDATE policies (baseline)
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'memberships'
ORDER BY policyname;

-- Leagues SELECT policy
SELECT policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'leagues'
ORDER BY policyname;

-- RPC presence (expect false before stage 6 apply)
SELECT
  to_regprocedure('public.create_league_with_commissioner_seat(text,text,boolean,boolean,integer,integer,integer)') IS NOT NULL AS has_create_rpc,
  to_regprocedure('public.join_league_by_code(text)') IS NOT NULL AS has_join_code_rpc,
  to_regprocedure('public.join_open_league_by_id(uuid)') IS NOT NULL AS has_join_open_rpc,
  to_regprocedure('public.list_open_leagues_public(text,integer)') IS NOT NULL AS has_list_open_rpc;

-- Human counts vs total (capacity planning)
SELECT
  count(*) AS leagues,
  count(*) FILTER (WHERE is_open IS TRUE) AS open_leagues
FROM public.leagues;

SELECT
  count(*) AS memberships,
  count(*) FILTER (WHERE coalesce(is_bot, false) = false) AS humans,
  count(*) FILTER (WHERE coalesce(is_bot, false) = true) AS bots
FROM public.memberships;

-- END 08 PREFLIGHT
