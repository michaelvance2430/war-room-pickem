-- =============================================================================
-- D1B-B / 12-disposable-rollback.sql
-- REVIEW ONLY — DISPOSABLE ONLY — REQUIRES SENTINEL
-- NEVER RUN ON PRODUCTION
-- =============================================================================

do $$
begin
  if not exists (
    select 1 from public.d1b_b_disposable_environment
  ) then
    raise exception
      'D1B-B disposable rollback: sentinel missing — refuse (would not be safe on production)';
  end if;
end $$;

begin;

-- Drop test results
drop schema if exists d1b_b_tests cascade;

-- D1B-B RPCs
drop function if exists public.list_open_leagues_public(text, integer);
drop function if exists public.join_open_league_by_id(uuid);
drop function if exists public.join_league_by_code(text);
drop function if exists public.create_league_with_commissioner_seat(text, text, boolean, boolean, integer, integer, integer);

-- Fair entry
drop function if exists public.d1b_b_fair_entry_points(uuid);
drop function if exists public.d1b_b_fair_entry_points(uuid, uuid);
drop function if exists public.d1b_b_freeze_band_if_needed(uuid, integer, text, integer, integer, integer, integer);
drop function if exists public.d1b_b_human_points_array(uuid, uuid);
drop function if exists public.d1b_b_percentile_value(integer[], numeric);
drop function if exists public.d1b_b_fair_entry_band(integer);
drop function if exists public.d1b_b_latest_scored_week(uuid);
drop function if exists public.d1b_b_fair_entry_season_year(uuid);
drop table if exists public.fair_entry_band_freezes cascade;

-- Helpers
drop function if exists public.d1b_b_max_human_members(uuid);
drop function if exists public.d1b_b_generate_league_code();
drop function if exists public.d1b_b_next_division(uuid);
drop function if exists public.d1b_b_human_member_count(uuid);
drop function if exists public.d1b_b_normalize_sport_id(text);
drop function if exists public.d1b_b_raise(text, text);
drop function if exists public.d1b_b_disp_clear_auth();
drop function if exists public.d1b_b_disp_set_auth(uuid);

-- D1B-B column
alter table public.leagues drop column if exists max_human_members;

-- Fixtures / registry
drop table if exists public.d1b_b_disp_fixture_registry cascade;

-- Baseline objects (order: children first)
drop function if exists public.record_league_first_join(uuid, uuid);
drop function if exists public.is_league_member(uuid);
drop table if exists public.league_first_joins cascade;
drop table if exists public.week_results cascade;
drop table if exists public.memberships cascade;
drop table if exists public.leagues cascade;
drop table if exists public.profiles cascade;
drop type if exists public.division;
drop type if exists public.member_role;

-- Sentinel last
drop table if exists public.d1b_b_disposable_environment cascade;

commit;

-- END 12 disposable rollback
-- After this, delete the Supabase preview branch itself.
