-- Server-only RPC disposable proof. All fixtures roll back.

begin;

do $$
declare
  v_departing uuid := gen_random_uuid();
  v_successor uuid := gen_random_uuid();
  v_operation uuid := gen_random_uuid();
  v_league uuid := gen_random_uuid();
  v_card uuid := gen_random_uuid();
  v_game uuid := gen_random_uuid();
  v_pick uuid := gen_random_uuid();
  v_result jsonb;
  v_count integer;
  v_permission_blocked boolean := false;
begin
  insert into public.profiles (id, display_name, avatar_url, birthday_mmdd)
  values
    (v_departing, 'RPC Departing Player', 'https://invalid.test/a.jpg', '02-03'),
    (v_successor, 'RPC Successor', null, null);

  insert into public.leagues (
    id, name, code, commissioner_id, regular_season_weeks,
    open_room_nudge_pending, open_room_nudge_left_name, open_room_nudge_at
  ) values (
    v_league, 'RPC Deletion Room', 'RPC001', v_departing, 12,
    true, 'RPC Departing Player', now()
  );
  insert into public.memberships (
    league_id, user_id, role, division, total_points, display_name_override
  ) values
    (v_league, v_departing, 'commissioner', 'North', 31, 'The Departing Alias'),
    (v_league, v_successor, 'player', 'South', 22, null);

  insert into public.week_cards (id, league_id, week_number)
  values (v_card, v_league, 1);
  insert into public.card_games (
    id, week_card_id, away_team, home_team, spread, favorite
  ) values (v_game, v_card, 'Away', 'Home', -2.5, 'home');
  insert into public.picks (
    id, league_id, user_id, week_number, best_bet_game_id, total_points
  ) values (v_pick, v_league, v_departing, 1, v_game, 9);

  -- RPCs must not be executable by a normal signed-in database role.
  begin
    execute 'set local role authenticated';
    perform public.begin_account_deletion(v_departing, v_operation);
  exception when insufficient_privilege then
    v_permission_blocked := true;
  end;
  reset role;
  if not v_permission_blocked then
    raise exception 'FAIL: authenticated role executed service-only deletion RPC';
  end if;

  -- Commissioner is blocked, with no lifecycle mutation.
  select public.begin_account_deletion(v_departing, v_operation) into v_result;
  if v_result->>'blocked' <> 'commissioner' then
    raise exception 'FAIL: begin RPC did not block commissioner';
  end if;
  if (select account_state from public.profiles where id = v_departing) <> 'active' then
    raise exception 'FAIL: blocked commissioner lifecycle changed';
  end if;

  update public.leagues set commissioner_id = v_successor where id = v_league;
  update public.memberships set role = 'player'
    where league_id = v_league and user_id = v_departing;
  update public.memberships set role = 'commissioner'
    where league_id = v_league and user_id = v_successor;

  select public.begin_account_deletion(v_departing, v_operation) into v_result;
  if v_result->>'stage' <> 'revoking_sessions' then
    raise exception 'FAIL: begin RPC did not enter revocation stage';
  end if;

  -- Recursive JSON redaction catches both exact fields and prose.
  if private.redact_jsonb_text(
    '{"name":"RPC Departing Player","story":"RPC Departing Player won"}'::jsonb,
    'RPC Departing Player'
  )::text like '%RPC Departing Player%' then
    raise exception 'FAIL: recursive JSON redaction leaked a name';
  end if;

  select public.redact_account_data(v_departing, v_operation) into v_result;
  if v_result->>'stage' <> 'deleting_auth_user' then
    raise exception 'FAIL: redaction RPC did not reach Auth deletion stage: %', v_result;
  end if;

  select count(*) into v_count from public.profiles
  where id = v_departing and display_name = '[REDACTED]'
    and avatar_url is null and birthday_mmdd is null
    and account_state = 'deleted';
  if v_count <> 1 then raise exception 'FAIL: RPC tombstone is incomplete'; end if;

  select count(*) into v_count from public.picks
  where id = v_pick and user_id = v_departing and total_points = 9;
  if v_count <> 1 then raise exception 'FAIL: RPC erased pick history'; end if;

  select count(*) into v_count from public.memberships
  where league_id = v_league and user_id = v_departing
    and total_points = 31 and display_name_override is null;
  if v_count <> 1 then raise exception 'FAIL: RPC standings/alias redaction failed'; end if;

  select count(*) into v_count from public.leagues
  where id = v_league and commissioner_id = v_successor
    and open_room_nudge_left_name is null
    and open_room_nudge_pending = false;
  if v_count <> 1 then raise exception 'FAIL: RPC room/nudge cleanup failed'; end if;

  select public.complete_account_deletion(v_departing, v_operation) into v_result;
  if v_result->>'stage' <> 'complete' then
    raise exception 'FAIL: completion RPC failed';
  end if;

  -- Completion and redaction are retry-safe.
  select public.redact_account_data(v_departing, v_operation) into v_result;
  if v_result->>'stage' <> 'complete' then
    raise exception 'FAIL: completed operation is not idempotent';
  end if;
end;
$$;

rollback;

select 'PASS' as account_deletion_server_rpc_harness;

