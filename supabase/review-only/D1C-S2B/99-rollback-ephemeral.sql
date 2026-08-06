-- =============================================================================
-- D1C-S2B / 99-rollback-ephemeral.sql
-- REVIEW ONLY — NON-PRODUCTION — DO NOT APPLY TO LIVE SUPABASE
-- =============================================================================
-- Ephemeral rollback rehearsal:
-- - Drop NEW D1C policies / functions / optional tables
-- - Does NOT delete crystal_ball_picks or crystal_ball_result rows
-- - Does NOT restore pre-S2b legacy policies (ephemeral has no prod history);
--   for production rollback later, re-apply archived policy definitions.
-- =============================================================================

-- Drop policies introduced by 03
drop policy if exists "Members read crystal ball state" on public.crystal_ball_state;
drop policy if exists "Members read own crystal ball" on public.crystal_ball_picks;
drop policy if exists "Members read crystal ball when revealed" on public.crystal_ball_picks;
drop policy if exists "Users insert own crystal ball" on public.crystal_ball_picks;
drop policy if exists "Users update own crystal ball" on public.crystal_ball_picks;
drop policy if exists "Members read crystal result" on public.crystal_ball_result;
drop policy if exists "Members read season deadlines" on public.crystal_ball_season_deadlines;
drop policy if exists "Platform staff self-read" on public.platform_staff;
drop policy if exists "Platform staff read deadline corrections" on public.crystal_ball_deadline_corrections;

-- Drop functions (RPCs / helpers)
drop function if exists public.correct_crystal_ball_deadline(uuid, timestamptz, text, integer);
drop function if exists public.crown_crystal_ball_champion(uuid, text);
-- NOTE: seed_bot_crystal_ball_picks may pre-exist; ephemeral may DROP or leave.
-- Prefer leave seed function if shared; document carefully in real rollback.
drop function if exists public.crystal_ball_propose_lock_from_schedule(uuid);
drop function if exists public.crystal_ball_apply_lock_candidate(uuid, integer, timestamptz, text, text, timestamptz, timestamptz, boolean);
drop function if exists public.crystal_ball_opening_week_first_kickoff(uuid, integer);
drop function if exists public.crystal_ball_parse_iso_timestamptz(text);
drop function if exists public.crystal_ball_lock_state(uuid, integer);
drop function if exists public.crystal_ball_is_peers_revealed(uuid, integer);
drop function if exists public.crystal_ball_is_write_open(uuid, integer);
drop function if exists public.crystal_ball_ensure_state(uuid, integer);
drop function if exists public.crystal_ball_resolve_season_year(uuid);
drop function if exists public.is_league_commissioner_uid(uuid);
drop function if exists public.is_platform_staff();

-- Leave NEW tables inert or drop (picks/results untouched)
-- Option A (inert): keep tables, no policies → deny by default for roles without grants
-- Option B (drop tables):

-- drop table if exists public.crystal_ball_result_repair_log;
-- drop table if exists public.crystal_ball_deadline_corrections;
-- drop table if exists public.crystal_ball_state;
-- drop table if exists public.crystal_ball_season_deadlines;
-- drop table if exists public.platform_staff;

-- DO NOT:
-- delete from public.crystal_ball_picks;
-- delete from public.crystal_ball_result;
-- drop table public.crystal_ball_picks;
-- drop table public.crystal_ball_result;

-- =============================================================================
-- END 99-rollback-ephemeral.sql — REVIEW ONLY — NON-PRODUCTION
-- =============================================================================
