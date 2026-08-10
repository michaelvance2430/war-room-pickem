-- War Room account deletion lifecycle disposable-branch proof.
-- TEST ONLY. Every fixture is rolled back at the end.

begin;

do $$
declare
  v_departing uuid := gen_random_uuid();
  v_successor uuid := gen_random_uuid();
  v_league uuid := gen_random_uuid();
  v_card uuid := gen_random_uuid();
  v_game uuid := gen_random_uuid();
  v_pick uuid := gen_random_uuid();
  v_count bigint;
  v_browser_blocked boolean := false;
  v_revoked_write_blocked boolean := false;
  v_active boolean;
begin
  insert into public.profiles (id, display_name, avatar_url, birthday_mmdd)
  values
    (v_departing, 'Disposable Departing Player', 'https://invalid.test/avatar.jpg', '01-02'),
    (v_successor, 'Disposable Successor', null, null);

  insert into public.leagues (
    id, name, code, commissioner_id, regular_season_weeks, current_week
  ) values (
    v_league, 'Disposable Account Deletion Room', 'DEL001', v_departing, 12, 1
  );

  insert into public.memberships (
    league_id, user_id, role, division, total_points
  ) values
    (v_league, v_departing, 'commissioner', 'North', 27),
    (v_league, v_successor, 'player', 'South', 21);

  insert into public.week_cards (
    id, league_id, week_number, published_at
  ) values (v_card, v_league, 1, now());

  insert into public.card_games (
    id, week_card_id, sort_order, away_team, home_team, spread, favorite
  ) values (v_game, v_card, 0, 'Away', 'Home', -3.5, 'home');

  insert into public.picks (
    id, league_id, user_id, week_number, best_bet_game_id, locked_at, total_points
  ) values (v_pick, v_league, v_departing, 1, v_game, now(), 8);

  insert into public.pick_games (
    pick_id, card_game_id, side, confidence, is_best_bet
  ) values (v_pick, v_game, 'home', 5, true);

  -- Gate 1: a commissioner cannot enter the destructive workflow.
  select count(*) into v_count
  from public.leagues
  where commissioner_id = v_departing;
  if v_count <> 1 then
    raise exception 'FAIL: commissioner ownership gate did not find the room';
  end if;

  -- Pass the Keys before lifecycle mutation.
  update public.leagues set commissioner_id = v_successor where id = v_league;
  update public.memberships set role = 'player'
    where league_id = v_league and user_id = v_departing;
  update public.memberships set role = 'commissioner'
    where league_id = v_league and user_id = v_successor;

  -- Gate 2: browser/authenticated role cannot set lifecycle fields.
  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claim.sub', v_departing::text, true);
    update public.profiles
      set account_state = 'deletion_in_progress'
      where id = v_departing;
  exception when others then
    v_browser_blocked := sqlerrm like '%server-managed%';
  end;
  reset role;
  if not v_browser_blocked then
    raise exception 'FAIL: browser role changed lifecycle fields';
  end if;

  -- Server begins deletion; old JWT must immediately fail the active gate.
  set local role service_role;
  update public.profiles
    set account_state = 'deletion_in_progress'
    where id = v_departing;
  reset role;

  perform set_config('request.jwt.claim.sub', v_departing::text, true);
  select private.is_active_account() into v_active;
  if v_active then
    raise exception 'FAIL: deletion-in-progress account remains active';
  end if;

  -- Gate 3: real RLS rejects writes made with the old still-valid JWT.
  begin
    execute 'set local role authenticated';
    perform set_config('request.jwt.claim.sub', v_departing::text, true);
    update public.picks set total_points = 999 where id = v_pick;
    if found then
      raise exception 'revoked JWT changed a protected row';
    end if;
  exception when others then
    v_revoked_write_blocked := true;
  end;
  reset role;
  if not v_revoked_write_blocked then
    -- A restrictive RLS policy may reject by returning zero rows instead of an
    -- exception; either result is safe as long as the receipt did not change.
    select count(*) into v_count from public.picks
      where id = v_pick and total_points = 8;
    if v_count <> 1 then
      raise exception 'FAIL: revoked JWT changed a protected row';
    end if;
  end if;

  -- Redact identity, but never delete the durable participant row.
  set local role service_role;
  update public.profiles
  set
    display_name = '[REDACTED]',
    avatar_url = null,
    birthday_mmdd = null,
    birthday_locked_at = null,
    last_seen_at = null,
    account_state = 'deleted',
    deleted_at = now()
  where id = v_departing;
  reset role;

  -- Gate 4: competitive receipts and room structure survive.
  select count(*) into v_count from public.profiles
    where id = v_departing and display_name = '[REDACTED]'
      and account_state = 'deleted' and deleted_at is not null;
  if v_count <> 1 then raise exception 'FAIL: tombstone profile missing'; end if;

  select count(*) into v_count from public.picks
    where id = v_pick and user_id = v_departing and total_points = 8;
  if v_count <> 1 then raise exception 'FAIL: competitive pick receipt was lost'; end if;

  select count(*) into v_count from public.pick_games
    where pick_id = v_pick and card_game_id = v_game and confidence = 5;
  if v_count <> 1 then raise exception 'FAIL: pick details were lost'; end if;

  select count(*) into v_count from public.memberships
    where league_id = v_league and user_id = v_departing and total_points = 27;
  if v_count <> 1 then raise exception 'FAIL: historical standings row was lost'; end if;

  select count(*) into v_count from public.leagues
    where id = v_league and commissioner_id = v_successor;
  if v_count <> 1 then raise exception 'FAIL: room ownership did not survive'; end if;
end;
$$;

rollback;

select 'PASS' as account_deletion_disposable_harness;
