-- Foundry parity: a missing weekly card is infrastructure, not a creator task.
-- Creator-only, Foundry-only, idempotent, and permanently barred from production.
create or replace function public.bootstrap_foundry_week(
  p_league_id uuid,
  p_week_number integer
) returns jsonb
language plpgsql
security definer
set search_path = pg_catalog, public, pg_temp
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_league public.leagues%rowtype;
  v_card_id uuid;
  v_bot_seed json;
  v_created boolean := false;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if v_uid <> '09544d2b-6eca-4131-a321-c000586c9029'::uuid then
    raise exception 'Creator Foundry only';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_league_id::text || ':week:' || p_week_number::text, 0));
  select * into v_league from public.leagues where id = p_league_id for update;
  if not found or v_league.mode <> 'foundry' or v_league.commissioner_id <> v_uid then
    raise exception 'Creator Foundry only';
  end if;
  if p_week_number <> v_league.current_week then raise exception 'Foundry week moved; reload the room'; end if;
  if exists(select 1 from public.memberships where league_id=p_league_id and not is_bot and user_id<>v_uid) then
    raise exception 'Human roster detected';
  end if;
  if (select count(*) from public.memberships where league_id=p_league_id and is_bot) < 8 then
    raise exception 'Bot roster incomplete';
  end if;

  select id into v_card_id from public.week_cards
  where league_id=p_league_id and week_number=p_week_number;

  if v_card_id is null then
    insert into public.week_cards(
      league_id,week_number,lock_time,prop_question,prop_option_a,prop_option_b,prop_points,published_at
    ) values (
      p_league_id,p_week_number,(clock_timestamp()+interval '5 days')::text,
      case when lower(v_league.sport_id)='nfl'
        then 'Will at least one prime-time game be decided by 3 points or fewer?'
        else 'Will at least one ranked game be decided by 7 points or fewer?' end,
      'Yes — keep the remote close','No — somebody gets comfortable',3,clock_timestamp()
    ) returning id into v_card_id;
    v_created := true;
  end if;

  if not exists(select 1 from public.card_games where week_card_id=v_card_id) then
    if lower(v_league.sport_id)='nfl' then
      insert into public.card_games(
        week_card_id,sort_order,away_team,home_team,spread,favorite,start_time,bookmaker,away_rank,home_rank,is_rivalry
      ) values
        (v_card_id,1,'Buffalo Bills','Kansas City Chiefs',2.5,'home',(clock_timestamp()+interval '2 days 1 hour')::text,'Foundry Simulation',null,null,false),
        (v_card_id,2,'Baltimore Ravens','Cincinnati Bengals',1.5,'away',(clock_timestamp()+interval '4 days')::text,'Foundry Simulation',null,null,true),
        (v_card_id,3,'Green Bay Packers','Chicago Bears',3.0,'away',(clock_timestamp()+interval '4 days 3 hours')::text,'Foundry Simulation',null,null,true),
        (v_card_id,4,'Philadelphia Eagles','Dallas Cowboys',2.5,'home',(clock_timestamp()+interval '4 days 7 hours')::text,'Foundry Simulation',null,null,true),
        (v_card_id,5,'San Francisco 49ers','Los Angeles Rams',1.5,'away',(clock_timestamp()+interval '5 days 7 hours')::text,'Foundry Simulation',null,null,true);
    else
      insert into public.card_games(
        week_card_id,sort_order,away_team,home_team,spread,favorite,start_time,bookmaker,away_rank,home_rank,is_rivalry
      ) values
        (v_card_id,1,'Texas Longhorns','Ohio State Buckeyes',2.5,'home',(clock_timestamp()+interval '3 days')::text,'Foundry Simulation',4,2,false),
        (v_card_id,2,'Georgia Bulldogs','Alabama Crimson Tide',1.5,'away',(clock_timestamp()+interval '3 days 3 hours')::text,'Foundry Simulation',3,6,true),
        (v_card_id,3,'Michigan Wolverines','Penn State Nittany Lions',3.0,'home',(clock_timestamp()+interval '3 days 5 hours')::text,'Foundry Simulation',8,7,false),
        (v_card_id,4,'Oregon Ducks','USC Trojans',4.5,'away',(clock_timestamp()+interval '3 days 8 hours')::text,'Foundry Simulation',5,12,true),
        (v_card_id,5,'LSU Tigers','Florida Gators',2.0,'away',(clock_timestamp()+interval '3 days 10 hours')::text,'Foundry Simulation',11,18,true);
    end if;
  end if;

  v_bot_seed := public.seed_bot_picks_for_week(p_league_id,p_week_number);
  return jsonb_build_object(
    'ok',true,'week',p_week_number,'sportId',lower(v_league.sport_id),
    'cardId',v_card_id,'cardCreated',v_created,'botsSeeded',coalesce(v_bot_seed,'[]'::json)
  );
end;
$function$;

revoke all on function public.bootstrap_foundry_week(uuid,integer) from public,anon;
grant execute on function public.bootstrap_foundry_week(uuid,integer) to authenticated;

-- Repair the current NFL lab immediately. The app also calls the RPC whenever
-- it detects a missing Foundry card, so future restores cannot regress.
