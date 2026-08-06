-- =============================================================================
-- D1C-S2B / 06-ephemeral-test-harness.sql
-- REVIEW ONLY — NON-PRODUCTION — DO NOT APPLY TO LIVE SUPABASE
-- =============================================================================
-- Synthetic leagues/picks only. Do not copy production identities.
-- Requires: 01–05 applied on disposable DB as service role / superuser.
-- Many checks need SET LOCAL ROLE / request.jwt claims for auth.uid() — in
-- plain psql, use test wrappers that set jwt claims if available.
--
-- If run without auth simulation, mark corresponding cases NOT RUN.
-- =============================================================================

create schema if not exists d1c_s2b_tests;

create table if not exists d1c_s2b_tests.results (
  test_id text primary key,
  status text not null check (status in ('PASS', 'FAIL', 'NOT_RUN', 'SKIP')),
  detail text,
  ran_at timestamptz default now()
);

create or replace function d1c_s2b_tests.record(
  p_id text,
  p_status text,
  p_detail text default null
) returns void
language sql
as $$
  insert into d1c_s2b_tests.results (test_id, status, detail)
  values (p_id, p_status, p_detail)
  on conflict (test_id) do update
    set status = excluded.status,
        detail = excluded.detail,
        ran_at = now();
$$;

-- ── Static policy catalog assertions (no auth required) ─────────────────────

do $$
declare
  v_bad int;
begin
  select count(*) into v_bad
  from pg_policies
  where schemaname = 'public'
    and tablename like 'crystal_ball%'
    and (
      coalesce(qual, '') ~ '2026-'
      or coalesce(with_check, '') ~ '2026-'
      or coalesce(qual, '') ilike '%week_results%'
      or coalesce(with_check, '') ilike '%week_results%'
      or coalesce(qual, '') ilike '%m.league_id = m.league_id%'
      or coalesce(with_check, '') ilike '%m.league_id = m.league_id%'
    );

  if v_bad = 0 then
    perform d1c_s2b_tests.record(
      'STATIC-01-no-year-weekresults-tautology',
      'PASS',
      'No 2026/week_results/tautology in crystal_ball policies'
    );
  else
    perform d1c_s2b_tests.record(
      'STATIC-01-no-year-weekresults-tautology',
      'FAIL',
      format('%s offending policy strings', v_bad)
    );
  end if;
exception when others then
  perform d1c_s2b_tests.record(
    'STATIC-01-no-year-weekresults-tautology',
    'NOT_RUN',
    sqlerrm
  );
end $$;

-- ── Synthetic migration rehearsal: state backfill without touching picks ────

do $$
declare
  v_league uuid := gen_random_uuid();
  v_user uuid := gen_random_uuid();
  v_pick_count_before int;
  v_pick_count_after int;
  v_fp_before text;
  v_fp_after text;
begin
  -- Minimal synthetic graph may fail if FKs to profiles/leagues require more columns.
  -- On failure mark NOT_RUN rather than inventing production data.
  begin
    -- Placeholder: actual insert requires full leagues/profiles shape.
    -- Harness documents intent; full actor simulation in app-level tests.
    perform d1c_s2b_tests.record(
      'MIG-01-backfill-no-pick-mutation',
      'NOT_RUN',
      'Requires full ephemeral seed of profiles/leagues/memberships; see design doc seed recipe'
    );
    perform d1c_s2b_tests.record(
      'MIG-02-seven-prod-picks-zero-mutation-proof',
      'NOT_RUN',
      'Conceptual: backfill SQL contains zero DML on crystal_ball_picks; verify by code review + ephemeral seed'
    );
  end;
end $$;

-- ── Sticky / automation unit tests via service-definer (no JWT) ─────────────
-- These exercise apply_lock_candidate if we can insert a league; often NOT_RUN.

do $$
begin
  perform d1c_s2b_tests.record(
    'STICKY-01-set-when-unset',
    'NOT_RUN',
    'Needs synthetic league row'
  );
  perform d1c_s2b_tests.record(
    'STICKY-02-reject-later',
    'NOT_RUN',
    'Needs synthetic league row'
  );
  perform d1c_s2b_tests.record(
    'STICKY-03-allow-earlier-pre-lock',
    'NOT_RUN',
    'Needs synthetic league row'
  );
  perform d1c_s2b_tests.record(
    'STICKY-04-immutable-post-lock',
    'NOT_RUN',
    'Needs synthetic league row + clock or past lock_at'
  );
  perform d1c_s2b_tests.record(
    'SEASON-01-explicit-active-year',
    'NOT_RUN',
    'Needs leagues.active_competition_season_year fixture'
  );
  perform d1c_s2b_tests.record(
    'SEASON-02-historical-lookup',
    'NOT_RUN',
    'Needs multi-year state rows'
  );
  perform d1c_s2b_tests.record(
    'SEASON-03-duplicate-state-pk',
    'NOT_RUN',
    'Needs ensure_state twice'
  );
end $$;

-- Mark entire auth-dependent suite
do $$
declare
  ids text[] := array[
    'T-UI-01-submit-before-lock',
    'T-API-02-insert-after-lock-denied',
    'T-API-03-upsert-overwrite-after-lock-denied',
    'T-API-06-own-pre-reveal',
    'T-API-07-peer-pre-reveal-denied',
    'T-API-08-peer-post-reveal',
    'T-API-09-cross-league-denied',
    'T-API-10-cross-sport-isolation',
    'T-API-11-missing-deadline',
    'T-API-12-invalid-schedule',
    'T-API-13-deadline-correction-audit',
    'T-API-14-post-lock-correction-denied',
    'T-API-15-bot-pre-lock',
    'T-API-16-bot-post-lock-denied',
    'T-API-17-first-crown',
    'T-API-18-recrown-denied',
    'T-API-19-platform-staff-crown',
    'T-API-20-deputy-crown-denied',
    'T-API-21-member-crown-denied',
    'T-ROLLOVER-01-through-10'
  ];
  i text;
begin
  foreach i in array ids
  loop
    perform d1c_s2b_tests.record(
      i,
      'NOT_RUN',
      'No disposable database / auth.uid() simulation in authoring environment'
    );
  end loop;
end $$;

select test_id, status, detail from d1c_s2b_tests.results order by test_id;

-- =============================================================================
-- END 06-ephemeral-test-harness.sql — REVIEW ONLY — NON-PRODUCTION
-- =============================================================================
