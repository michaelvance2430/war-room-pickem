-- Foundry certification reset: one disposable run must begin at the opening
-- presentation and contain no residue from a prior regular/postseason season.

create or replace function public.reset_foundry_lab(p_league_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_seed json;
  v_bot uuid;
  v_run integer;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if v_uid <> '09544d2b-6eca-4131-a321-c000586c9029'::uuid then
    raise exception 'Creator Foundry only';
  end if;
  if not exists (
    select 1 from public.leagues
    where id = p_league_id and mode = 'foundry' and commissioner_id = v_uid
  ) then raise exception 'Creator Foundry only'; end if;
  if exists (
    select 1 from public.memberships
    where league_id = p_league_id and not is_bot and user_id <> v_uid
  ) then raise exception 'Human roster detected'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_league_id::text || ':reset', 0));

  delete from public.gazette_editions where league_id = p_league_id;
  delete from public.postseason_scorecards where league_id = p_league_id;
  delete from public.cfb_postseason_results where league_id = p_league_id;
  delete from public.cfb_postseason_entries where league_id = p_league_id;
  delete from public.cfb_postseason_slates where league_id = p_league_id;
  delete from public.week_results where league_id = p_league_id;
  delete from public.picks where league_id = p_league_id;
  delete from public.week_cards where league_id = p_league_id and week_number > 0;
  delete from public.locker_messages where league_id = p_league_id;

  begin
    delete from public.achievements where league_id = p_league_id;
  exception when undefined_table then null;
  end;
  begin
    delete from public.league_trophies where league_id = p_league_id;
  exception when undefined_table then null;
  end;

  update public.memberships set
    total_points = 0,
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

  update public.leagues set current_week = 0 where id = p_league_id;

  insert into public.foundry_season_lifecycle (
    league_id, run_number, stage, week_number, updated_at
  ) values (
    p_league_id, 1, 'season_opening', 0, now()
  )
  on conflict (league_id) do update set
    run_number = public.foundry_season_lifecycle.run_number + 1,
    stage = 'season_opening',
    week_number = 0,
    updated_at = now()
  returning run_number into v_run;

  v_seed := public.seed_bot_picks_for_week(p_league_id, 0);
  select user_id into v_bot
  from public.memberships
  where league_id = p_league_id and is_bot
  order by user_id limit 1;

  if v_bot is not null then
    insert into public.locker_messages (league_id, user_id, body) values
      (p_league_id, v_bot, 'Foundry reset. I remain undefeated in all weeks that no longer legally exist.'),
      (p_league_id, v_bot, 'Lock your cards. I need fresh material for the Dispatch.');
  end if;

  return jsonb_build_object(
    'ok', true,
    'week', 0,
    'runNumber', v_run,
    'stage', 'season_opening',
    'botsSeeded', v_seed
  );
end;
$$;

revoke all on function public.reset_foundry_lab(uuid) from public;
grant execute on function public.reset_foundry_lab(uuid) to authenticated;

notify pgrst, 'reload schema';
