-- =============================================================================
-- D1B-B / 09-full-test-runner.sql
-- REVIEW ONLY — DISPOSABLE ONLY — REQUIRES SENTINEL
-- NEVER RUN ON PRODUCTION
-- =============================================================================
-- Prerequisites: 00 baseline, 00b fixtures, 01–06 applied on disposable branch.
-- =============================================================================

do $$
begin
  if not exists (select 1 from public.d1b_b_disposable_environment) then
    raise exception 'D1B-B test runner: sentinel missing — refuse (not disposable)';
  end if;
end $$;

create schema if not exists d1b_b_tests;

create table if not exists d1b_b_tests.results (
  test_id text primary key,
  expected text,
  actual text,
  status text not null check (status in ('PASS', 'FAIL', 'NOT_RUN', 'SKIP', 'ERROR')),
  error_code text,
  detail text,
  ran_at timestamptz not null default now()
);

create or replace function d1b_b_tests.record(
  p_id text,
  p_expected text,
  p_actual text,
  p_status text,
  p_error text default null,
  p_detail text default null
) returns void
language sql
as $$
  insert into d1b_b_tests.results (test_id, expected, actual, status, error_code, detail)
  values (p_id, p_expected, p_actual, p_status, p_error, p_detail)
  on conflict (test_id) do update set
    expected = excluded.expected,
    actual = excluded.actual,
    status = excluded.status,
    error_code = excluded.error_code,
    detail = excluded.detail,
    ran_at = now();
$$;

create or replace function d1b_b_tests.assert_true(
  p_id text, p_expected text, p_cond boolean, p_actual text default null
) returns void
language plpgsql as $$
begin
  if p_cond then
    perform d1b_b_tests.record(p_id, p_expected, coalesce(p_actual, 'true'), 'PASS');
  else
    perform d1b_b_tests.record(p_id, p_expected, coalesce(p_actual, 'false'), 'FAIL');
  end if;
end;
$$;

-- Clear prior run
truncate d1b_b_tests.results;

-- ── Baseline / schema ───────────────────────────────────────────────────────
select d1b_b_tests.assert_true(
  'BASE-sentinel',
  'sentinel present',
  exists (select 1 from public.d1b_b_disposable_environment)
);

select d1b_b_tests.assert_true(
  'BASE-cut-check',
  'cut_percent 10-75',
  exists (
    select 1 from pg_constraint
    where conrelid = 'public.leagues'::regclass
      and pg_get_constraintdef(oid) ilike '%cut_percent%10%75%'
  )
);

select d1b_b_tests.assert_true(
  'BASE-rpcs',
  'join RPCs present',
  to_regprocedure('public.join_league_by_code(text)') is not null
  and to_regprocedure('public.create_league_with_commissioner_seat(text,text,boolean,boolean,integer,integer,integer)') is not null
  and to_regprocedure('public.join_open_league_by_id(uuid)') is not null
  and to_regprocedure('public.list_open_leagues_public(text,integer)') is not null
);

-- ── Auth uid simulation ─────────────────────────────────────────────────────
do $$
declare
  v uuid := 'aaaaaaaa-bbbb-cccc-dddd-000000000001';
begin
  perform public.d1b_b_disp_set_auth(v);
  if auth.uid() is not distinct from v then
    perform d1b_b_tests.record('JWT-set-uid', 'auth.uid=creator', auth.uid()::text, 'PASS');
  else
    perform d1b_b_tests.record('JWT-set-uid', 'auth.uid=creator', coalesce(auth.uid()::text, 'null'), 'FAIL');
  end if;
  perform public.d1b_b_disp_clear_auth();
  if auth.uid() is null then
    perform d1b_b_tests.record('JWT-clear', 'auth.uid null', 'null', 'PASS');
  else
    perform d1b_b_tests.record('JWT-clear', 'auth.uid null', auth.uid()::text, 'FAIL');
  end if;
end $$;

-- ── cut_percent / sport validation via create RPC ───────────────────────────
do $$
declare
  v_creator uuid := 'aaaaaaaa-bbbb-cccc-dddd-000000000001';
  v_json json;
  v_msg text;
begin
  perform public.d1b_b_disp_set_auth(v_creator);

  -- default cut 50
  begin
    v_json := public.create_league_with_commissioner_seat('Disp Create Default Cut', 'cfb', false, true, 0, null, 32);
    if (v_json->>'ok')::boolean and (v_json->>'cut_percent')::int = 50 then
      perform d1b_b_tests.record('CUT-default', '50', v_json->>'cut_percent', 'PASS');
    else
      perform d1b_b_tests.record('CUT-default', '50', v_json::text, 'FAIL');
    end if;
  exception when others then
    perform d1b_b_tests.record('CUT-default', '50', SQLERRM, 'ERROR', SQLSTATE);
  end;

  foreach v_msg in array array['10','50','75']
  loop
    begin
      v_json := public.create_league_with_commissioner_seat(
        'Disp Cut ' || v_msg, 'nfl', false, true, 0, v_msg::int, 32
      );
      if (v_json->>'ok')::boolean and (v_json->>'cut_percent') = v_msg then
        perform d1b_b_tests.record('CUT-ok-' || v_msg, v_msg, v_json->>'cut_percent', 'PASS');
      else
        perform d1b_b_tests.record('CUT-ok-' || v_msg, v_msg, v_json::text, 'FAIL');
      end if;
    exception when others then
      perform d1b_b_tests.record('CUT-ok-' || v_msg, v_msg, SQLERRM, 'ERROR', SQLSTATE);
    end;
  end loop;

  foreach v_msg in array array['9','76','-1','100']
  loop
    begin
      v_json := public.create_league_with_commissioner_seat(
        'Disp Cut Bad ' || v_msg, 'cfb', false, true, 0, v_msg::int, 32
      );
      perform d1b_b_tests.record('CUT-bad-' || v_msg, 'validation_failed', v_json::text, 'FAIL');
    exception when others then
      if SQLERRM like '%d1b_b:validation_failed%' then
        perform d1b_b_tests.record('CUT-bad-' || v_msg, 'd1b_b:validation_failed', SQLERRM, 'PASS');
      else
        perform d1b_b_tests.record('CUT-bad-' || v_msg, 'd1b_b:validation_failed', SQLERRM, 'FAIL', SQLSTATE);
      end if;
    end;
  end loop;

  -- sports
  begin
    v_json := public.create_league_with_commissioner_seat('Disp Sport CFB', 'CFB', false, true, 0, 50, 32);
    perform d1b_b_tests.record('SPORT-cfb', 'ok cfb', v_json->>'sport_id', 
      case when v_json->>'sport_id' = 'cfb' then 'PASS' else 'FAIL' end);
  exception when others then
    perform d1b_b_tests.record('SPORT-cfb', 'ok', SQLERRM, 'ERROR');
  end;

  begin
    v_json := public.create_league_with_commissioner_seat('Disp Sport Bad', 'soccer_wwc', false, true, 0, 50, 32);
    perform d1b_b_tests.record('SPORT-reject-wwc', 'validation_failed', v_json::text, 'FAIL');
  exception when others then
    perform d1b_b_tests.record(
      'SPORT-reject-wwc', 'd1b_b:validation_failed', SQLERRM,
      case when SQLERRM like '%validation_failed%' then 'PASS' else 'FAIL' end
    );
  end;

  perform public.d1b_b_disp_clear_auth();
end $$;

-- ── Fair-entry percentile SQL parity (static) ───────────────────────────────
do $$
begin
  perform d1b_b_tests.assert_true(
    'FE-pct-empty', '0',
    public.d1b_b_percentile_value(array[]::int[], 75) = 0,
    public.d1b_b_percentile_value(array[]::int[], 75)::text
  );
  perform d1b_b_tests.assert_true(
    'FE-pct-one', '42',
    public.d1b_b_percentile_value(array[42], 75) = 42
  );
  perform d1b_b_tests.assert_true(
    'FE-pct-p75', '75',
    public.d1b_b_percentile_value(array[0,100], 75) = 75
  );
  perform d1b_b_tests.assert_true(
    'FE-pct-multi', '25',
    public.d1b_b_percentile_value(array[0,10,20,40], 75) = 25
  );
  perform d1b_b_tests.assert_true(
    'FE-pct-ties', '13',
    public.d1b_b_percentile_value(array[5,5,20,20], 50) = 13
  );
end $$;

-- ── Join flows ──────────────────────────────────────────────────────────────
do $$
declare
  v_creator uuid := 'aaaaaaaa-bbbb-cccc-dddd-000000000001';
  v_a uuid := 'aaaaaaaa-bbbb-cccc-dddd-000000000002';
  v_b uuid := 'aaaaaaaa-bbbb-cccc-dddd-000000000003';
  v_json json;
  v_code text;
  v_lid uuid;
  v_hum int;
  v_open uuid;
begin
  -- unauthenticated
  perform public.d1b_b_disp_clear_auth();
  begin
    perform public.create_league_with_commissioner_seat('No Auth', 'cfb');
    perform d1b_b_tests.record('AUTH-unauth-create', 'not_authenticated', 'ok', 'FAIL');
  exception when others then
    perform d1b_b_tests.record(
      'AUTH-unauth-create', 'd1b_b:not_authenticated', SQLERRM,
      case when SQLERRM like '%not_authenticated%' then 'PASS' else 'FAIL' end
    );
  end;

  -- create + commissioner
  perform public.d1b_b_disp_set_auth(v_creator);
  v_json := public.create_league_with_commissioner_seat('Join Flow League', 'cfb', false, true, 0, 50, 3);
  v_lid := (v_json->>'league_id')::uuid;
  v_code := v_json->>'code';
  perform d1b_b_tests.assert_true(
    'JOIN-create-atomic',
    'commissioner seat',
    exists (
      select 1 from public.memberships m
      where m.league_id = v_lid and m.user_id = v_creator and m.role = 'commissioner'
        and m.total_points = 0 and coalesce(m.is_bot, false) = false
    )
  );
  insert into public.d1b_b_disp_fixture_registry(key, league_id, note)
  values ('closed_code_league', v_lid, v_code)
  on conflict (key) do update set league_id = excluded.league_id, note = excluded.note;

  -- join by code
  perform public.d1b_b_disp_set_auth(v_a);
  v_json := public.join_league_by_code(v_code);
  perform d1b_b_tests.assert_true(
    'JOIN-code-ok',
    'player seat',
    (v_json->>'ok')::boolean
    and exists (
      select 1 from public.memberships m
      where m.league_id = v_lid and m.user_id = v_a and m.role = 'player'
    )
  );

  -- invalid code
  begin
    perform public.join_league_by_code('ZZZZZZ');
    perform d1b_b_tests.record('JOIN-bad-code', 'invalid_code', 'ok', 'FAIL');
  exception when others then
    perform d1b_b_tests.record(
      'JOIN-bad-code', 'invalid_code', SQLERRM,
      case when SQLERRM like '%invalid_code%' then 'PASS' else 'FAIL' end
    );
  end;

  -- rejoin
  v_json := public.join_league_by_code(v_code);
  perform d1b_b_tests.assert_true(
    'JOIN-rejoin',
    'already_member',
    (v_json->>'already_member')::boolean = true
  );

  -- capacity: max_human=3 → creator+A = 2; B joins; third human should fail after full
  -- set max to 2 for capacity test on this league
  update public.leagues set max_human_members = 2 where id = v_lid;
  perform public.d1b_b_disp_set_auth(v_b);
  begin
    v_json := public.join_league_by_code(v_code);
    perform d1b_b_tests.record('CAP-full', 'league_full', v_json::text, 'FAIL');
  exception when others then
    perform d1b_b_tests.record(
      'CAP-full', 'league_full', SQLERRM,
      case when SQLERRM like '%league_full%' then 'PASS' else 'FAIL' end
    );
  end;

  -- bots excluded: add bot, raise max to 3, B should join (humans were 2)
  insert into public.memberships (league_id, user_id, role, is_bot, division)
  values (v_lid, 'aaaaaaaa-bbbb-cccc-dddd-0000000000b1', 'player', true, 'East')
  on conflict do nothing;
  update public.leagues set max_human_members = 3 where id = v_lid;
  perform public.d1b_b_disp_set_auth(v_b);
  begin
    v_json := public.join_league_by_code(v_code);
    v_hum := public.d1b_b_human_member_count(v_lid);
    perform d1b_b_tests.assert_true(
      'CAP-bots-excluded',
      'B joins; humans=3',
      (v_json->>'ok')::boolean and v_hum = 3,
      'humans=' || v_hum::text
    );
  exception when others then
    perform d1b_b_tests.record('CAP-bots-excluded', 'join ok', SQLERRM, 'ERROR');
  end;

  -- open join
  perform public.d1b_b_disp_set_auth(v_creator);
  v_json := public.create_league_with_commissioner_seat('Open Room League', 'nfl', true, true, 0, 50, 32);
  v_open := (v_json->>'league_id')::uuid;
  update public.leagues set is_open = true where id = v_open;
  perform public.d1b_b_disp_set_auth(v_a);
  -- clear A from closed league? A already member elsewhere; open is different league
  v_json := public.join_open_league_by_id(v_open);
  perform d1b_b_tests.assert_true('OPEN-join', 'ok', (v_json->>'ok')::boolean);

  update public.leagues set is_open = false where id = v_open;
  perform public.d1b_b_disp_set_auth(v_b);
  begin
    perform public.join_open_league_by_id(v_open);
    perform d1b_b_tests.record('OPEN-closed', 'not_open', 'ok', 'FAIL');
  exception when others then
    perform d1b_b_tests.record(
      'OPEN-closed', 'not_open', SQLERRM,
      case when SQLERRM like '%not_open%' then 'PASS' else 'FAIL' end
    );
  end;

  -- discovery no code
  perform public.d1b_b_disp_set_auth(v_a);
  update public.leagues set is_open = true where id = v_open;
  v_json := public.list_open_leagues_public('nfl', 40);
  perform d1b_b_tests.assert_true(
    'DISC-no-code',
    'no code key',
    v_json::text not ilike '%"code"%',
    left(v_json::text, 120)
  );

  -- FE preseason points 0
  perform d1b_b_tests.assert_true(
    'FE-preseason-zero',
    '0',
    public.d1b_b_fair_entry_points(v_open, v_b) = 0
  );

  -- FE midseason + freeze reuse
  insert into public.week_results (league_id, week_number)
  values (v_open, 2)
  on conflict do nothing;
  update public.memberships set total_points = 0 where league_id = v_open and user_id = v_creator;
  -- add human scores via direct update (disposable)
  update public.memberships set total_points = 40 where league_id = v_open and user_id = v_a;
  -- points for new joiner B under lock simulation
  declare
    v_p1 int;
    v_p2 int;
  begin
    v_p1 := public.d1b_b_fair_entry_points(v_open, v_b);
    v_p2 := public.d1b_b_fair_entry_points(v_open, v_b);
    perform d1b_b_tests.assert_true(
      'FE-freeze-reuse',
      'same points',
      v_p1 = v_p2 and v_p1 >= 0,
      v_p1::text || '/' || v_p2::text
    );
  end;

  -- season isolation: freeze under year A vs B
  insert into public.fair_entry_band_freezes (
    league_id, season_year, band_id, points, latest_scored_week, human_sample_size, percentile
  ) values (
    v_open, 1999, '1-2', 999, 2, 2, 75
  ) on conflict do nothing;
  -- current season resolve should not use 1999 unless season_year is 1999
  perform d1b_b_tests.assert_true(
    'FE-season-isolation',
    'not forced 999',
    public.d1b_b_fair_entry_points(v_open, v_b) is distinct from 999
      or public.d1b_b_fair_entry_season_year(v_open) = 1999,
    'pts=' || public.d1b_b_fair_entry_points(v_open, v_b)::text
  );

  -- privilege: join cannot set role commissioner (forced player)
  perform d1b_b_tests.assert_true(
    'PRIV-no-commish-on-join',
    'player only',
    not exists (
      select 1 from public.memberships m
      where m.user_id = v_a and m.league_id = v_lid and m.role = 'commissioner'
    )
  );

  -- grants: anon should not have execute (check privileges)
  perform d1b_b_tests.assert_true(
    'GRANT-no-anon-join',
    'anon denied',
    not exists (
      select 1 from information_schema.routine_privileges
      where routine_schema = 'public'
        and routine_name = 'join_league_by_code'
        and grantee = 'anon'
        and privilege_type = 'EXECUTE'
    )
  );

  -- first-join integration
  perform d1b_b_tests.assert_true(
    'FIRST-join-row',
    'league_first_joins exists for creator',
    exists (
      select 1 from public.league_first_joins f
      where f.league_id = v_lid and f.user_id = v_creator
    )
  );

  perform public.d1b_b_disp_clear_auth();
end $$;

-- Concurrent final seat: best-effort sequential simulation (true parallel needs two sessions)
do $$
begin
  perform d1b_b_tests.record(
    'RACE-final-seat',
    'exactly one of two',
    'sequential simulation only — use two sessions for true race',
    'NOT_RUN',
    null,
    'Documented: FOR UPDATE + unique; run two clients against disposable'
  );
end $$;

select test_id, status, expected, actual, error_code, left(detail, 80) as detail
from d1b_b_tests.results
order by
  case status when 'FAIL' then 0 when 'ERROR' then 1 when 'NOT_RUN' then 2 else 3 end,
  test_id;

-- END 09-full-test-runner
