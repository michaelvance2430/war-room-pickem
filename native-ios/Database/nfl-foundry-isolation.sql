-- Keep Foundry resets sport-aware. NFL always restarts at Week 1 and clears
-- only into its own regular-season and Final Thirteen pipeline.

create or replace function public.reset_foundry_lab(p_league_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_league public.leagues%rowtype;
  v_seed json;
  v_bot uuid;
  v_run integer;
  v_opening integer;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if v_uid <> '09544d2b-6eca-4131-a321-c000586c9029'::uuid then raise exception 'Creator Foundry only'; end if;

  select * into v_league
  from public.leagues
  where id = p_league_id
  for update;

  if not found or v_league.mode <> 'foundry' or v_league.commissioner_id <> v_uid then
    raise exception 'Creator Foundry only';
  end if;
  if exists (
    select 1 from public.memberships
    where league_id = p_league_id and not is_bot and user_id <> v_uid
  ) then raise exception 'Human roster detected'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_league_id::text || ':reset', 0));

  delete from public.gazette_editions where league_id = p_league_id;
  delete from public.week_results where league_id = p_league_id;
  delete from public.picks where league_id = p_league_id;
  delete from public.week_cards where league_id = p_league_id;
  delete from public.locker_messages where league_id = p_league_id;
  delete from public.crystal_ball_picks where league_id = p_league_id;
  delete from public.crystal_ball_result where league_id = p_league_id;

  delete from public.cfb_postseason_results where league_id = p_league_id;
  delete from public.postseason_scorecards where league_id = p_league_id;
  delete from public.cfb_postseason_entries where league_id = p_league_id;
  delete from public.cfb_postseason_slates where league_id = p_league_id;

  delete from public.nfl_postseason_results where league_id = p_league_id;
  delete from public.nfl_postseason_scorecards where league_id = p_league_id;
  delete from public.nfl_postseason_entries where league_id = p_league_id;
  delete from public.nfl_postseason_slates where league_id = p_league_id;

  update public.memberships
  set total_points = 0,
      weekly_points = array[]::integer[],
      weeks_played = 0,
      ats_correct = 0,
      ats_total = 0,
      current_streak = 0,
      best_week = 0,
      worst_week = 0,
      perfect_weeks = 0,
      best_bet_hits = 0,
      best_bet_total = 0,
      prop_hits = 0,
      prop_total = 0
  where league_id = p_league_id;

  v_opening := case when lower(v_league.sport_id) = 'nfl' then 1 else 0 end;
  update public.leagues set current_week = v_opening where id = p_league_id;

  -- Restore parity with CFB: the test week is infrastructure. Rebuild its
  -- five-game card and every bot slip before the reset returns.
  v_seed := (public.bootstrap_foundry_week(p_league_id, v_opening)->'botsSeeded')::json;

  select user_id into v_bot
  from public.memberships
  where league_id = p_league_id and is_bot
  order by user_id
  limit 1;

  if v_bot is not null then
    insert into public.locker_messages(league_id, user_id, body) values
      (p_league_id, v_bot, case when lower(v_league.sport_id) = 'nfl'
        then 'Sunday Foundry reset. Week 1 and every bot slip are staged.'
        else 'Foundry reset. I remain undefeated in all weeks that no longer legally exist.' end),
      (p_league_id, v_bot, case when lower(v_league.sport_id) = 'nfl'
        then 'No bowls. No preseason. Eighteen weeks, then the Final Thirteen.'
        else 'Lock your cards. I need fresh material for the Dispatch.' end);
  end if;

  insert into public.foundry_season_lifecycle(league_id, run_number, stage, week_number)
  values(p_league_id, 1, 'season_opening', v_opening)
  on conflict(league_id) do update
    set run_number = public.foundry_season_lifecycle.run_number + 1,
        stage = 'season_opening',
        week_number = v_opening,
        updated_at = now()
  returning run_number into v_run;

  return jsonb_build_object(
    'ok', true,
    'week', v_opening,
    'botsSeeded', coalesce(v_seed, '[]'::json),
    'runNumber', v_run,
    'stage', 'season_opening',
    'sportId', lower(v_league.sport_id)
  );
end;
$function$;

revoke all on function public.reset_foundry_lab(uuid) from public, anon;
grant execute on function public.reset_foundry_lab(uuid) to authenticated;
