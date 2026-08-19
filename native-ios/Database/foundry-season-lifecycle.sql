-- Foundry is a complete season simulator, not merely a scoring shortcut.
-- This state is server-owned so reset, presentations, kickoff, scoring, and
-- postseason survive app relaunches and cannot drift from the lab league.

create table if not exists public.foundry_season_lifecycle (
  league_id uuid primary key references public.leagues(id) on delete cascade,
  run_number integer not null default 1 check (run_number > 0),
  stage text not null check (stage in (
    'season_opening', 'championship_cold_open', 'week_open', 'week_locked',
    'postseason_open', 'season_complete'
  )),
  week_number integer not null default 0 check (week_number >= 0),
  updated_at timestamptz not null default now()
);

alter table public.foundry_season_lifecycle enable row level security;
revoke all on table public.foundry_season_lifecycle from public, anon, authenticated;

insert into public.foundry_season_lifecycle(league_id, stage, week_number)
select l.id,
  case when l.current_week > l.regular_season_weeks then 'postseason_open' else 'week_open' end,
  l.current_week
from public.leagues l
where l.mode = 'foundry'
on conflict (league_id) do nothing;

create or replace function public.get_foundry_season_lifecycle(p_league_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare v_uid uuid := auth.uid(); v_state public.foundry_season_lifecycle%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not exists (
    select 1 from public.leagues l
    where l.id=p_league_id and l.mode='foundry' and l.commissioner_id=v_uid
  ) then raise exception 'Creator Foundry only'; end if;

  select * into v_state from public.foundry_season_lifecycle where league_id=p_league_id;
  if not found then
    insert into public.foundry_season_lifecycle(league_id,stage,week_number)
    select l.id,case when l.current_week>l.regular_season_weeks then 'postseason_open' else 'week_open' end,l.current_week
    from public.leagues l where l.id=p_league_id
    returning * into v_state;
  end if;
  return jsonb_build_object('leagueId',v_state.league_id,'runNumber',v_state.run_number,
    'stage',v_state.stage,'weekNumber',v_state.week_number,'updatedAt',v_state.updated_at);
end;
$function$;

revoke all on function public.get_foundry_season_lifecycle(uuid) from public, anon;
grant execute on function public.get_foundry_season_lifecycle(uuid) to authenticated;

create or replace function public.advance_foundry_presentation(p_league_id uuid, p_expected_stage text)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare v_uid uuid := auth.uid(); v_state public.foundry_season_lifecycle%rowtype; v_next text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not exists (
    select 1 from public.leagues l
    where l.id=p_league_id and l.mode='foundry' and l.commissioner_id=v_uid
  ) then raise exception 'Creator Foundry only'; end if;

  select * into v_state from public.foundry_season_lifecycle where league_id=p_league_id for update;
  if not found or v_state.stage<>p_expected_stage then raise exception 'Foundry presentation moved; reload the lab'; end if;
  v_next := case p_expected_stage
    when 'season_opening' then 'championship_cold_open'
    when 'championship_cold_open' then 'week_open'
    else null end;
  if v_next is null then raise exception 'No presentation transition available'; end if;
  update public.foundry_season_lifecycle set stage=v_next,updated_at=now() where league_id=p_league_id returning * into v_state;
  return jsonb_build_object('leagueId',v_state.league_id,'runNumber',v_state.run_number,
    'stage',v_state.stage,'weekNumber',v_state.week_number,'updatedAt',v_state.updated_at);
end;
$function$;

revoke all on function public.advance_foundry_presentation(uuid,text) from public, anon;
grant execute on function public.advance_foundry_presentation(uuid,text) to authenticated;

create or replace function public.lock_foundry_week(p_league_id uuid, p_week_number integer)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare v_uid uuid:=auth.uid(); v_league public.leagues%rowtype; v_card uuid; v_locked integer; v_kickoff timestamptz:=now()-interval '1 minute';
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select * into v_league from public.leagues where id=p_league_id for update;
  if not found or v_league.mode<>'foundry' or v_league.commissioner_id<>v_uid then raise exception 'Creator Foundry only'; end if;
  if v_league.current_week<>p_week_number then raise exception 'Foundry week moved; reload the lab'; end if;
  if exists(select 1 from public.memberships where league_id=p_league_id and not is_bot and user_id<>v_uid) then raise exception 'Human roster detected'; end if;
  select id into v_card from public.week_cards where league_id=p_league_id and week_number=p_week_number;
  if v_card is null then raise exception 'Foundry week has no card'; end if;
  select count(*) into v_locked from public.picks where league_id=p_league_id and week_number=p_week_number and locked_at is not null;
  if v_locked < 8 then raise exception 'Bot roster has not locked'; end if;
  if exists(select 1 from public.week_results where league_id=p_league_id and week_number=p_week_number) then raise exception 'Foundry week already scored'; end if;

  update public.week_cards set lock_time=v_kickoff::text where id=v_card;
  update public.card_games set start_time=(v_kickoff+(sort_order||' seconds')::interval)::text where week_card_id=v_card;
  insert into public.foundry_season_lifecycle(league_id,stage,week_number)
    values(p_league_id,'week_locked',p_week_number)
  on conflict(league_id) do update set stage='week_locked',week_number=excluded.week_number,updated_at=now();

  return jsonb_build_object('ok',true,'week',p_week_number,'lockedCards',v_locked,'kickoffAt',v_kickoff);
end;
$function$;

revoke all on function public.lock_foundry_week(uuid,integer) from public, anon;
grant execute on function public.lock_foundry_week(uuid,integer) to authenticated;

create or replace function public.score_foundry_week_simulated(p_league_id uuid, p_week_number integer)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare v_uid uuid:=auth.uid(); v_results jsonb; v_prop text; v_locked jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.leagues where id=p_league_id and mode='foundry' and commissioner_id=v_uid and current_week=p_week_number) then raise exception 'Creator Foundry only'; end if;
  if exists(select 1 from public.memberships where league_id=p_league_id and not is_bot and user_id<>v_uid) then raise exception 'Human roster detected'; end if;

  v_locked:=public.lock_foundry_week(p_league_id,p_week_number);
  select jsonb_agg(jsonb_build_object('game_id',cg.id,'winner',
    case when (cg.sort_order+p_week_number)%7=0 then 'push' when (cg.sort_order+p_week_number)%2=0 then 'home' else 'away' end
  ) order by cg.sort_order),
  case when p_week_number%2=0 then wc.prop_option_a else wc.prop_option_b end
  into v_results,v_prop
  from public.week_cards wc join public.card_games cg on cg.week_card_id=wc.id
  where wc.league_id=p_league_id and wc.week_number=p_week_number
  group by wc.prop_option_a,wc.prop_option_b;
  if v_results is null or v_prop is null then raise exception 'Foundry final simulation is incomplete'; end if;
  return public.process_foundry_week(p_league_id,p_week_number,v_results,v_prop);
end;
$function$;

revoke all on function public.score_foundry_week_simulated(uuid,integer) from public, anon;
grant execute on function public.score_foundry_week_simulated(uuid,integer) to authenticated;

create or replace function public.sync_foundry_lifecycle_week()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $function$
begin
  if new.mode='foundry' and new.current_week is distinct from old.current_week then
    insert into public.foundry_season_lifecycle(league_id,stage,week_number)
    values(new.id,case when new.current_week>new.regular_season_weeks then 'postseason_open' else 'week_open' end,new.current_week)
    on conflict(league_id) do update set stage=excluded.stage,week_number=excluded.week_number,updated_at=now();
  end if;
  return new;
end;
$function$;

drop trigger if exists sync_foundry_lifecycle_week on public.leagues;
create trigger sync_foundry_lifecycle_week after update of current_week on public.leagues
for each row execute function public.sync_foundry_lifecycle_week();

-- Reset now starts a new complete season presentation, not merely Week 0 data.
create or replace function public.reset_foundry_lab(p_league_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare v_uid uuid:=auth.uid(); v_seed json; v_bot uuid; v_run integer;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if v_uid <> '09544d2b-6eca-4131-a321-c000586c9029'::uuid then raise exception 'Creator Foundry only'; end if;
  if not exists(select 1 from public.leagues where id=p_league_id and mode='foundry' and commissioner_id=v_uid) then raise exception 'Creator Foundry only'; end if;
  if exists(select 1 from public.memberships where league_id=p_league_id and not is_bot and user_id<>v_uid) then raise exception 'Human roster detected'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_league_id::text||':reset',0));
  delete from public.gazette_editions where league_id=p_league_id;
  delete from public.week_results where league_id=p_league_id;
  delete from public.picks where league_id=p_league_id;
  delete from public.week_cards where league_id=p_league_id and week_number>0;
  delete from public.locker_messages where league_id=p_league_id;
  delete from public.crystal_ball_picks where league_id=p_league_id;
  delete from public.cfb_postseason_results where league_id=p_league_id;
  delete from public.postseason_scorecards where league_id=p_league_id;
  delete from public.cfb_postseason_entries where league_id=p_league_id;
  delete from public.cfb_postseason_slates where league_id=p_league_id;
  update public.memberships set total_points=0,weekly_points=array[]::integer[],weeks_played=0,ats_correct=0,ats_total=0,
    current_streak=0,best_week=0,worst_week=0,perfect_weeks=0,best_bet_hits=0,best_bet_total=0,prop_hits=0,prop_total=0
  where league_id=p_league_id;
  update public.leagues set current_week=0 where id=p_league_id;
  v_seed:=public.seed_bot_picks_for_week(p_league_id,0);
  select user_id into v_bot from public.memberships where league_id=p_league_id and is_bot order by user_id limit 1;
  if v_bot is not null then
    insert into public.locker_messages(league_id,user_id,body) values
      (p_league_id,v_bot,'Foundry reset. I remain undefeated in all weeks that no longer legally exist.'),
      (p_league_id,v_bot,'Lock your cards. I need fresh material for the Dispatch.');
  end if;
  insert into public.foundry_season_lifecycle(league_id,run_number,stage,week_number)
  values(p_league_id,1,'season_opening',0)
  on conflict(league_id) do update set run_number=public.foundry_season_lifecycle.run_number+1,
    stage='season_opening',week_number=0,updated_at=now()
  returning run_number into v_run;
  return jsonb_build_object('ok',true,'week',0,'botsSeeded',v_seed,'runNumber',v_run,'stage','season_opening');
end;
$function$;

revoke all on function public.reset_foundry_lab(uuid) from public, anon;
grant execute on function public.reset_foundry_lab(uuid) to authenticated;
