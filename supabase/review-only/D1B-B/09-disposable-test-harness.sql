-- =============================================================================
-- D1B-B / 09-disposable-test-harness.sql
-- REVIEW ONLY — DISPOSABLE / EPHEMERAL DATABASE ONLY
-- DO NOT RUN AGAINST PRODUCTION
-- =============================================================================
-- Requires: 01–06 applied on disposable DB; JWT/auth simulation for multi-user.
-- Without auth.uid() simulation, mark tests NOT_RUN.
-- =============================================================================

create schema if not exists d1b_b_tests;

create table if not exists d1b_b_tests.results (
  test_id text primary key,
  status text not null check (status in ('PASS', 'FAIL', 'NOT_RUN', 'SKIP')),
  detail text,
  ran_at timestamptz default now()
);

create or replace function d1b_b_tests.record(p_id text, p_status text, p_detail text default null)
returns void language sql as $$
  insert into d1b_b_tests.results (test_id, status, detail)
  values (p_id, p_status, p_detail)
  on conflict (test_id) do update
    set status = excluded.status, detail = excluded.detail, ran_at = now();
$$;

-- Static: RPC definitions exist after apply on disposable
do $$
begin
  if to_regprocedure('public.join_league_by_code(text)') is not null then
    perform d1b_b_tests.record('STATIC-rpc-join-by-code', 'PASS', 'present');
  else
    perform d1b_b_tests.record('STATIC-rpc-join-by-code', 'FAIL', 'missing');
  end if;

  if to_regprocedure('public.join_open_league_by_id(uuid)') is not null then
    perform d1b_b_tests.record('STATIC-rpc-join-open', 'PASS', 'present');
  else
    perform d1b_b_tests.record('STATIC-rpc-join-open', 'FAIL', 'missing');
  end if;

  if to_regprocedure('public.create_league_with_commissioner_seat(text,text,boolean,boolean,integer,integer,integer)') is not null then
    perform d1b_b_tests.record('STATIC-rpc-create', 'PASS', 'present');
  else
    perform d1b_b_tests.record('STATIC-rpc-create', 'FAIL', 'missing');
  end if;

  if to_regprocedure('public.list_open_leagues_public(text,integer)') is not null then
    perform d1b_b_tests.record('STATIC-rpc-list-open', 'PASS', 'present');
  else
    perform d1b_b_tests.record('STATIC-rpc-list-open', 'FAIL', 'missing');
  end if;
end $$;

-- Auth-dependent cases — require disposable JWT harness
do $$
declare
  ids text[] := array[
    'T1-create-atomic-commissioner',
    'T2-create-rollback-no-orphan',
    'T3-join-code-success',
    'T4-join-bad-code',
    'T5-join-full-humans',
    'T6-concurrent-last-seat',
    'T7-rejoin-idempotent',
    'T8-open-when-open',
    'T9-open-when-closed',
    'T10-list-open-no-code-key',
    'T11-forced-defaults-no-privilege',
    'T12-bots-excluded-from-capacity'
  ];
  i text;
begin
  foreach i in array ids loop
    perform d1b_b_tests.record(
      i,
      'NOT_RUN',
      'Requires disposable multi-user auth.uid() simulation — not production'
    );
  end loop;
end $$;

select * from d1b_b_tests.results order by test_id;

-- END 09 — DISPOSABLE ONLY
