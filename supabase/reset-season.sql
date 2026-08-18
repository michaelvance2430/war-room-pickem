-- ============================================================
-- Reset season (keep members, wipe scores/picks/cards + pride picks)
-- Run once in Supabase → SQL Editor → Run (re-run after this update)
-- ============================================================

create or replace function public.reset_league_season(p_league_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_picks int := 0;
  v_cards int := 0;
  v_results int := 0;
  v_members int := 0;
  v_cb int := 0;
  v_ach int := 0;
  v_postseason int := 0;
  v_deleted int := 0;
  v_season_key int := case
    when extract(month from now()) < 7 then extract(year from now())::int - 1
    else extract(year from now())::int
  end;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.leagues l
    where l.id = p_league_id
      and l.commissioner_id = v_uid
  ) then
    raise exception 'Only the commissioner can reset the season';
  end if;

  -- Picks (+ pick_games via cascade)
  delete from public.picks
  where league_id = p_league_id;
  get diagnostics v_picks = row_count;

  -- Week results (+ game_results via cascade)
  delete from public.week_results
  where league_id = p_league_id;
  get diagnostics v_results = row_count;

  -- Week cards (+ card_games via cascade)
  delete from public.week_cards
  where league_id = p_league_id;
  get diagnostics v_cards = row_count;

  -- Season chatter
  begin
    delete from public.announcements where league_id = p_league_id;
  exception when undefined_table then null;
  end;

  -- Gazette archive for this season
  begin
    delete from public.gazette_editions where league_id = p_league_id;
  exception when undefined_table then null;
  end;

  -- Crystal Ball / Super Bowl pride picks + crown + league achievements
  begin
    delete from public.crystal_ball_picks where league_id = p_league_id;
    get diagnostics v_cb = row_count;
  exception when undefined_table then null;
  end;
  begin
    delete from public.crystal_ball_result where league_id = p_league_id;
  exception when undefined_table then null;
  end;
  begin
    delete from public.achievements where league_id = p_league_id;
    get diagnostics v_ach = row_count;
  exception when undefined_table then null;
  end;

  -- Current-season postseason board. Preserve prior-season trophies/history,
  -- but never let a rehearsal reset inherit a slate, entry, result, scorecard,
  -- frozen field, or durable closeout receipt from the same season key.
  begin
    delete from public.postseason_scorecards
    where league_id = p_league_id and season_key = v_season_key;
    get diagnostics v_deleted = row_count;
    v_postseason := v_postseason + v_deleted;
  exception when undefined_table then null;
  end;
  begin
    delete from public.cfb_postseason_results
    where league_id = p_league_id and season_key = v_season_key;
    get diagnostics v_deleted = row_count;
    v_postseason := v_postseason + v_deleted;
  exception when undefined_table then null;
  end;
  begin
    delete from public.cfb_postseason_entries
    where league_id = p_league_id and season_key = v_season_key;
    get diagnostics v_deleted = row_count;
    v_postseason := v_postseason + v_deleted;
  exception when undefined_table then null;
  end;
  begin
    delete from public.cfb_postseason_slates
    where league_id = p_league_id and season_key = v_season_key;
    get diagnostics v_deleted = row_count;
    v_postseason := v_postseason + v_deleted;
  exception when undefined_table then null;
  end;
  begin
    delete from public.league_season_closeouts
    where league_id = p_league_id and season_key = v_season_key;
    get diagnostics v_deleted = row_count;
    v_postseason := v_postseason + v_deleted;
  exception when undefined_table then null;
  end;
  begin
    delete from public.league_postseason_snapshots
    where league_id = p_league_id and season_key = v_season_key::text;
    get diagnostics v_deleted = row_count;
    v_postseason := v_postseason + v_deleted;
  exception when undefined_table then null;
  end;

  -- Locker board for this league (trial noise)
  begin
    delete from public.locker_messages where league_id = p_league_id;
  exception when undefined_table then null;
  end;

  -- Zero every member's season stats — keep membership / division / role
  -- These feed profile "deep stats" (ATS, weeks played, streaks, legacy math).
  update public.memberships
  set
    total_points = 0,
    weekly_points = array[]::int[],
    ats_correct = 0,
    ats_total = 0,
    current_streak = 0,
    best_week = 0,
    worst_week = 0,
    perfect_weeks = 0,
    best_bet_hits = 0,
    best_bet_total = 0,
    prop_hits = 0,
    prop_total = 0,
    weeks_played = 0,
    deployment_credit = 0,
    deployment_credit_breakdown = '[]'::jsonb,
    eligible_from_week = 0
  where league_id = p_league_id;
  get diagnostics v_members = row_count;

  -- Ready for first week (CFB 0 / app may bump NFL to 1 on client)
  update public.leagues
  set current_week = 0
  where id = p_league_id;

  return json_build_object(
    'ok', true,
    'membersKept', v_members,
    'picksDeleted', v_picks,
    'cardsDeleted', v_cards,
    'resultsDeleted', v_results,
    'postseasonDeleted', v_postseason,
    'crystalPicksDeleted', v_cb,
    'achievementsDeleted', v_ach
  );
end;
$$;

-- A normal Week 0 transition should clear only the active season's frozen
-- bracket authority. Older snapshots remain available for historical audit.
create or replace function public.clear_postseason_snapshot_on_season_reset()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_season_key int := case
    when extract(month from now()) < 7 then extract(year from now())::int - 1
    else extract(year from now())::int
  end;
begin
  if new.current_week = 0 and old.current_week <> 0 then
    delete from public.league_postseason_snapshots
    where league_id = new.id and season_key = v_season_key::text;
  end if;
  return new;
end;
$$;

revoke all on function public.clear_postseason_snapshot_on_season_reset() from public, anon, authenticated;

revoke all on function public.reset_league_season(uuid) from public;
grant execute on function public.reset_league_season(uuid) to authenticated;

notify pgrst, 'reload schema';
