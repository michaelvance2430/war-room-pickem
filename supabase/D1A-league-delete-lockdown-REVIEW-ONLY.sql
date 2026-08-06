-- =============================================================================
-- D1A — League deletion lockdown — REVIEW ONLY
-- =============================================================================
-- DO NOT APPLY without:
--   1) Running D0-rls-preflight-SELECT-ONLY.sql on the target DB
--   2) Archiving exact live DELETE policy names for public.leagues
--   3) Explicit Mike authorization
--
-- INTENT (product law):
--   Delete League is intentionally RETIRED permanently.
--   No future Delete League RPC is planned.
--   Future product direction: Archive League (separate design).
--   This migration only removes client DELETE via RLS — nothing else.
--
-- SCOPE: SMALLEST possible — leagues DELETE policies only.
-- DOES NOT: touch UPDATE/INSERT, Crystal Ball, picks, achievements, deputies,
--           sport immutability trigger, trophies, profiles.
--
-- IDEMPOTENT: safe to re-run (DROP IF EXISTS).
--
-- PREFLIGHT DEPENDENCY:
--   Replace the DROP list below with EXACT names from preflight if they differ.
--   Do NOT use wildcards that drop unrelated future policies.
-- =============================================================================

begin;

-- ── Verified names from repo archaeology + expected live ────────────────────
-- Preflight query:
--   SELECT policyname FROM pg_policies
--   WHERE schemaname='public' AND tablename='leagues' AND cmd='DELETE';
--
-- Only drop names that appear in that archive.

-- Known from leave-delete-policies.sql:
drop policy if exists "Commissioner deletes league" on public.leagues;

-- Optional variants only if preflight confirmed them (commented until verified):
-- drop policy if exists "Users delete own league" on public.leagues;
-- drop policy if exists "leagues_delete_commissioner" on public.leagues;

-- Intentionally NO replacement DELETE policy for authenticated/anon.

commit;

notify pgrst, 'reload schema';

-- =============================================================================
-- POST-APPLY VERIFY (run separately, SELECT only)
-- =============================================================================
-- SELECT policyname, cmd, qual FROM pg_policies
-- WHERE schemaname='public' AND tablename='leagues' AND cmd='DELETE';
-- -- Expect: zero rows
--
-- SELECT tgname, tgenabled FROM pg_trigger
-- WHERE tgname = 'leagues_sport_id_immutable_trg';
-- -- Expect: still present / enabled
--
-- SELECT policyname, cmd FROM pg_policies
-- WHERE schemaname='public' AND tablename='leagues' AND cmd IN ('INSERT','UPDATE');
-- -- Expect: create + ops/commish update still present

-- =============================================================================
-- EMERGENCY ROLLBACK FRAGMENT (DO NOT USE casually)
-- =============================================================================
-- WARNING: Restoring the following reopens a KNOWN DESTRUCTIVE capability:
-- authenticated commissioners can DELETE entire leagues via PostgREST,
-- cascading memberships, cards, picks, results, etc.
-- Product law: Delete League is retired. Prefer leave locked.
-- Archive League is the future direction — not this rollback.
--
-- drop policy if exists "Commissioner deletes league" on public.leagues;
-- create policy "Commissioner deletes league"
--   on public.leagues for delete to authenticated
--   using (commissioner_id = auth.uid());

-- END D1A REVIEW-ONLY
