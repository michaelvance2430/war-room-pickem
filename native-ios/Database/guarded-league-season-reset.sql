-- Commissioner-only season restart. Permanent identity, hardware, cheevos, roster, and social history survive.
create or replace function public.reset_league_season_guarded(p_league_id uuid,p_confirm_name text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_uid uuid := (select auth.uid()); v_league public.leagues%rowtype; v_members integer; v_opening integer;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select * into v_league from public.leagues where id=p_league_id for update;
  if not found or v_league.commissioner_id<>v_uid then raise exception 'Commissioner authority required'; end if;
  if trim(coalesce(p_confirm_name,''))<>v_league.name then raise exception 'League name confirmation did not match'; end if;

  delete from public.cfb_postseason_results where league_id=p_league_id;
  delete from public.cfb_postseason_entries where league_id=p_league_id;
  delete from public.cfb_postseason_slates where league_id=p_league_id;
  delete from public.nfl_postseason_results where league_id=p_league_id;
  delete from public.nfl_postseason_scorecards where league_id=p_league_id;
  delete from public.nfl_postseason_entries where league_id=p_league_id;
  delete from public.nfl_postseason_slates where league_id=p_league_id;
  delete from public.crystal_ball_result where league_id=p_league_id;
  delete from public.crystal_ball_picks where league_id=p_league_id;
  delete from public.gazette_editions where league_id=p_league_id;
  delete from public.week_results where league_id=p_league_id;
  delete from public.picks where league_id=p_league_id;
  delete from public.week_cards where league_id=p_league_id;
  delete from public.announcements where league_id=p_league_id;

  update public.memberships set total_points=0,weekly_points='{}'::integer[],weeks_played=0,
    ats_correct=0,ats_total=0,current_streak=0,best_week=0,worst_week=0,perfect_weeks=0,
    best_bet_hits=0,best_bet_total=0,prop_hits=0,prop_total=0
  where league_id=p_league_id;
  get diagnostics v_members=row_count;
  v_opening:=case when v_league.sport_id='nfl' then 1 else 0 end;
  update public.leagues set current_week=v_opening where id=p_league_id;

  return jsonb_build_object('ok',true,'membersKept',v_members,'week',v_opening,
    'preserved',jsonb_build_array('roster','trophies','achievements','ranks','locker room','weapon history'));
end;$function$;

revoke all on function public.reset_league_season_guarded(uuid,text) from public,anon;
grant execute on function public.reset_league_season_guarded(uuid,text) to authenticated;
revoke all on function public.reset_league_season(uuid) from public,anon,authenticated;
