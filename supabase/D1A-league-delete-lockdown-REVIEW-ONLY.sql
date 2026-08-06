-- =============================================================================
-- D1A — League deletion lockdown — REVIEW ONLY (FINAL exact names)
-- =============================================================================
-- CLOSEOUT 2026-08-06: VERIFIED NO-OP / ALREADY ABSENT
--   SQL Editor preflight: zero DELETE policies on public.leagues.
--   "Commissioner deletes league" already absent. Block B was NOT run.
--   This session made no production change. See docs/D1A-VERIFICATION-NO-OP.md
--   Prior Pass 1.5 freeze had reported the policy live; drift cause UNKNOWN.
--
-- Historical intent (if policy ever reappears — Mike auth required again):
--   DROP the verified retired DELETE policy only.
--
-- Prior live evidence (Pass 1.5 — superseded by 2026-08-06 verify):
--   Exactly ONE DELETE policy on public.leagues:
--     policyname = 'Commissioner deletes league'
--     cmd        = DELETE
--     qual       = (commissioner_id = auth.uid())
--     with_check = null
--
-- Product law:
--   Delete League is intentionally RETIRED permanently.
--   No future Delete League RPC is planned.
--   Future direction: Archive League (separate design).
--   Removing this policy is the desired permanent behavior.
--
-- SCOPE: Drop that single verified policy. Nothing else.
-- DOES NOT: UPDATE/INSERT policies, sport trigger, picks, CB, deputies.
-- IDEMPOTENT: DROP POLICY IF EXISTS
--
-- EMERGENCY ROLLBACK WARNING:
--   Re-creating this policy reopens client-side destructive league DELETE
--   (CASCADE memberships, cards, picks, results). Prefer leave locked.
-- =============================================================================

begin;

-- Exact live name only (no wildcards, no unverified aliases)
drop policy if exists "Commissioner deletes league" on public.leagues;

commit;

notify pgrst, 'reload schema';

-- =============================================================================
-- POST-APPLY VERIFY (SELECT only — run separately)
-- =============================================================================
-- SELECT policyname, cmd, qual
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'leagues' AND cmd = 'DELETE';
-- -- Expect: zero rows
--
-- SELECT policyname, cmd
-- FROM pg_policies
-- WHERE schemaname = 'public' AND tablename = 'leagues'
-- ORDER BY cmd, policyname;
-- -- Expect INSERT/UPDATE/SELECT still present (Users create leagues,
-- -- Commissioner updates league, leagues_commish_update_sport,
-- -- Leagues readable authenticated)
--
-- SELECT tgname, tgenabled
-- FROM pg_trigger
-- WHERE tgname = 'leagues_sport_id_immutable_trg' AND NOT tgisinternal;
-- -- Expect: still present (enabled_code O/A preferred)

-- END D1A REVIEW-ONLY (FINAL)
