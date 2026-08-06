-- =============================================================================
-- D1B-B / 11-rollback-scripts.sql
-- REVIEW ONLY — ROLLBACK SKETCHES BY STAGE
-- DO NOT RUN BLINDLY ON PRODUCTION
-- =============================================================================

-- ── Rollback after Stage 6 (RPCs applied, INSERT still present) ─────────────
-- Safe-ish: drop new RPCs/helpers; leave legacy client paths working.

-- drop function if exists public.list_open_leagues_public(text, integer);
-- drop function if exists public.join_open_league_by_id(uuid);
-- drop function if exists public.join_league_by_code(text);
-- drop function if exists public.create_league_with_commissioner_seat(text, text, boolean, boolean, integer, integer, integer);
-- drop function if exists public.d1b_b_fair_entry_points(uuid);
-- drop function if exists public.d1b_b_max_human_members(uuid);
-- drop function if exists public.d1b_b_generate_league_code();
-- drop function if exists public.d1b_b_next_division(uuid);
-- drop function if exists public.d1b_b_human_member_count(uuid);
-- drop function if exists public.d1b_b_raise(text, text);
--
-- -- Optional: keep max_human_members column (harmless) or:
-- -- alter table public.leagues drop column if exists max_human_members;

-- ── Rollback after Stage 10 (INSERT removed) ────────────────────────────────
-- Restore legacy INSERT from pre-apply archive of policy text, e.g.:
--
-- create policy "Memberships insert own"
--   on public.memberships for insert to authenticated
--   with check (user_id = auth.uid());

-- ── Rollback after Stage 12 (UPDATE narrowed) ─────────────────────────────
-- Restore prior "Memberships update by commissioner or self" from catalog archive.
-- WARNING: security regression — last resort only.

-- ── Rollback after Stage 14 (SELECT tightened) ──────────────────────────────
-- Restore "Leagues readable authenticated" using (true) — re-exposes codes.

-- END 11 ROLLBACK SKETCHES
