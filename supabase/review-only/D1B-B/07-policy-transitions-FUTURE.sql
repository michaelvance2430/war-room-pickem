-- =============================================================================
-- D1B-B / 07-policy-transitions-FUTURE.sql
-- REVIEW ONLY — FUTURE STAGES 10 / 12 / 14
-- DO NOT APPLY WITH STAGE-6 RPC PACKAGE
-- DO NOT APPLY TO LIVE WITHOUT EXPLICIT STAGE AUTHORIZATION
-- =============================================================================
-- These sketches run ONLY after:
--   Stage 10: RPCs + app cutover verified
--   Stage 12: narrow UPDATE writers mapped
--   Stage 14: discovery cutover complete
-- =============================================================================

-- ── STAGE 10 — Remove direct human membership INSERT ───────────────────────
-- Prerequisites: create/join/open RPCs live; app uses them only; disposable tests green.

-- drop policy if exists "Memberships insert own" on public.memberships;
-- drop policy if exists "Users insert own membership" on public.memberships;
--
-- -- Optional: deny-all explicit (no INSERT policy = deny under RLS)
-- -- Bot/DEFINER paths bypass RLS.
--
-- notify pgrst, 'reload schema';

-- ── STAGE 12 — Replace broad self-or-commissioner UPDATE ───────────────────
-- Prerequisites: set_my_league_display_name for player alias; set_member_moderation;
-- scoring/reset/division via DEFINER or ops-only paths; no player needs table UPDATE.

-- drop policy if exists "Memberships update by commissioner or self" on public.memberships;
--
-- -- Commissioner/ops manage staff-ish fields (example — refine with live policy audit)
-- create policy "Ops update memberships staff fields"
--   on public.memberships for update to authenticated
--   using (public.is_league_ops(league_id) or public.is_league_commissioner(league_id))
--   with check (public.is_league_ops(league_id) or public.is_league_commissioner(league_id));
--
-- -- Prefer NO player UPDATE policy at all; alias via set_my_league_display_name only.
--
-- notify pgrst, 'reload schema';

-- ── STAGE 14 — Tighten leagues SELECT (codes private) ───────────────────────
-- Prerequisites: list_open_leagues_public + member/commissioner league fetch paths;
-- no app select * / open-room code listing.

-- drop policy if exists "Leagues readable authenticated" on public.leagues;
--
-- create policy "Members read own leagues"
--   on public.leagues for select to authenticated
--   using (
--     public.is_league_member(id)
--     or commissioner_id = auth.uid()
--   );
--
-- -- Open discovery must NOT use this table SELECT for codes; use list_open_leagues_public.
-- -- Optional: allow authenticated to read open leagues WITHOUT code via SECURITY BARRIER view.
--
-- notify pgrst, 'reload schema';

-- END 07 — FUTURE STAGES ONLY — REVIEW ONLY
