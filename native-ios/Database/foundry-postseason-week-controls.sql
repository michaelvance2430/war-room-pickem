-- Preserve the Foundry's Lock Week -> Score Week rhythm through CFB postseason.
-- Creator-only and Foundry-only. Production leagues are rejected before mutation.

create or replace function public.lock_foundry_postseason_week(
  p_league_id uuid,
  p_season_key integer
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $function$
declare
  v_uid uuid := (select auth.uid());
  v_league public.leagues%rowtype;
  v_phase text;
  v_seed jsonb;
begin
  select * into v_league from public.leagues where id=p_league_id for update;
  if not found or v_uid<>'09544d2b-6eca-4131-a321-c000586c9029'::uuid or
     v_league.mode<>'foundry' or v_league.commissioner_id<>v_uid then
    raise exception 'Creator Foundry only';
  end if;
  if exists(select 1 from public.memberships where league_id=p_league_id and not is_bot and user_id<>v_uid) then
    raise exception 'Human roster detected';
  end if;
  if not exists(select 1 from public.cfb_postseason_slates where league_id=p_league_id and season_key=p_season_key) then
    raise exception 'Open Bowl Mania once to stage the Foundry postseason field';
  end if;

  v_phase := case
    when v_league.current_week=v_league.regular_season_weeks+2 then 'bowl'
    when v_league.current_week=v_league.regular_season_weeks+3 then 'playoff'
    else null end;
  if v_phase is null then raise exception 'No lockable Foundry postseason week is active'; end if;

  v_seed := public.seed_foundry_cfb_postseason(p_league_id,p_season_key);
  if v_phase='playoff' then
    update public.cfb_postseason_entries
      set cfp_locked_at=coalesce(cfp_locked_at,now()),updated_at=now()
      where league_id=p_league_id and season_key=p_season_key and
        user_id in (select user_id from public.memberships where league_id=p_league_id and is_bot);
  end if;
  return jsonb_build_object(
    'ok',true,'week',v_league.current_week,'phase',v_phase,
    'lockedCards',(select count(*) from public.cfb_postseason_entries
      where league_id=p_league_id and season_key=p_season_key and
      case when v_phase='bowl' then bowl_locked_at is not null else cfp_locked_at is not null end)
  );
end;$function$;

revoke all on function public.lock_foundry_postseason_week(uuid,integer) from public,anon;
grant execute on function public.lock_foundry_postseason_week(uuid,integer) to authenticated;

create or replace function public.score_foundry_postseason_week(
  p_league_id uuid,
  p_season_key integer
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $function$
declare
  v_uid uuid := (select auth.uid());
  v_league public.leagues%rowtype;
  v_slate public.cfb_postseason_slates%rowtype;
  v_phase text;
  v_results jsonb;
  v_existing_results jsonb := '{}'::jsonb;
  v_seeds jsonb;
  v_next integer;
  v_dispatch_id uuid;
  v_crown record;
  v_shame record;
begin
  select * into v_league from public.leagues where id=p_league_id for update;
  if not found or v_uid<>'09544d2b-6eca-4131-a321-c000586c9029'::uuid or
     v_league.mode<>'foundry' or v_league.commissioner_id<>v_uid then
    raise exception 'Creator Foundry only';
  end if;
  if exists(select 1 from public.memberships where league_id=p_league_id and not is_bot and user_id<>v_uid) then
    raise exception 'Human roster detected';
  end if;
  select * into v_slate from public.cfb_postseason_slates
    where league_id=p_league_id and season_key=p_season_key;
  if not found then raise exception 'Foundry postseason field is missing'; end if;

  v_phase := case
    when v_league.current_week=v_league.regular_season_weeks+2 then 'bowl'
    when v_league.current_week=v_league.regular_season_weeks+3 then 'playoff'
    else null end;
  if v_phase is null then raise exception 'No scoreable Foundry postseason week is active'; end if;
  if not exists(select 1 from public.cfb_postseason_entries where league_id=p_league_id and season_key=p_season_key and
      case when v_phase='bowl' then bowl_locked_at is not null else cfp_locked_at is not null end) then
    raise exception 'Lock Week before Score Week';
  end if;

  if v_phase='bowl' then
    select jsonb_object_agg(game->>'id',case when ord%2=0 then game->>'away' else game->>'home' end)
      into v_results from jsonb_array_elements(v_slate.bowl_games) with ordinality g(game,ord);
    select coalesce(bowl_results,'{}'::jsonb) into v_existing_results
      from public.cfb_postseason_results where league_id=p_league_id and season_key=p_season_key;
    -- Results already entered through the Results Desk are receipts, not scratch paper.
    -- Simulate only missing games; the right-hand object wins for duplicate keys.
    v_results:=coalesce(v_results,'{}'::jsonb) || coalesce(v_existing_results,'{}'::jsonb);
    insert into public.cfb_postseason_results(league_id,season_key,bowl_results,cfp_results)
    values(p_league_id,p_season_key,v_results,'{}'::jsonb)
    on conflict(league_id,season_key) do update set bowl_results=excluded.bowl_results,updated_at=now();
  else
    v_seeds:=v_slate.cfp_seeds;
    v_results:=jsonb_build_object(
      'r1a',v_seeds->>4,'r1b',v_seeds->>7,'r1c',v_seeds->>6,'r1d',v_seeds->>5,
      'q1',v_seeds->>3,'q2',v_seeds->>0,'q3',v_seeds->>1,'q4',v_seeds->>2,
      's1',v_seeds->>3,'s2',v_seeds->>1,'final',v_seeds->>3
    );
    update public.cfb_postseason_results set cfp_results=v_results,updated_at=now()
      where league_id=p_league_id and season_key=p_season_key;
    if not found then raise exception 'Score the Bowl Week before the Playoff Week'; end if;
  end if;

  select coalesce(p.display_name,'Foundry Bot') name,
    case when v_phase='bowl' then e.bowl_score else e.cfp_score end points
    into v_crown
  from public.cfb_postseason_entries e left join public.profiles p on p.id=e.user_id
  where e.league_id=p_league_id and e.season_key=p_season_key and
    case when v_phase='bowl' then e.bowl_score is not null else e.cfp_score is not null end
  order by points desc,coalesce(p.display_name,'Foundry Bot'),e.user_id limit 1;

  select coalesce(p.display_name,'Foundry Bot') name,
    case when v_phase='bowl' then e.bowl_score else e.cfp_score end points
    into v_shame
  from public.cfb_postseason_entries e left join public.profiles p on p.id=e.user_id
  where e.league_id=p_league_id and e.season_key=p_season_key and
    case when v_phase='bowl' then e.bowl_score is not null else e.cfp_score is not null end
  order by points asc,coalesce(p.display_name,'Foundry Bot'),e.user_id limit 1;

  insert into public.gazette_editions(league_id,week_number,week_label,volume_label,payload)
  values(
    p_league_id,v_league.current_week,
    case when v_phase='bowl' then 'Bowl Week' else 'Playoff Week' end,
    'Postseason Special',
    jsonb_build_object(
      'weekIndex',v_league.current_week,
      'weekLabel',case when v_phase='bowl' then 'Bowl Week' else 'Playoff Week' end,
      'volumeLabel','Postseason Special','sportId','cfb','masthead','THE WAR ROOM DISPATCH',
      'tagline','THE PHASE CHANGED. THE PAPER GOT LOUDER.',
      'coverageLine',case when v_phase='bowl' then 'BOWL MANIA CERTIFIED' else 'THE PLAYOFFS ARE LIVE' end,
      'stampLine',case when v_phase='bowl' then '10 DAYS UNTIL THE PLAYOFFS' else 'SURVIVE AND ADVANCE' end,
      'crown',jsonb_build_object('headline',coalesce(v_crown.name,'POSTSEASON')||case when v_phase='bowl' then ' OWNS BOWL MANIA' else ' SURVIVES THE BRACKET' end,'names',jsonb_build_array(coalesce(v_crown.name,'POSTSEASON')),'pts',coalesce(v_crown.points,0),'deck',coalesce(v_crown.points,0)||' points. The postseason now has a person to blame.'),
      'shame',jsonb_build_object('headline',coalesce(v_shame.name,'THE FIELD')||' REPORTS TO THE POSTSEASON SHAME DESK','names',jsonb_build_array(coalesce(v_shame.name,'THE FIELD')),'pts',coalesce(v_shame.points,0),'deck',coalesce(v_shame.points,0)||' points. The bracket requests privacy.'),
      'rivalryWatch',jsonb_build_object('headline',coalesce(v_crown.name,'THE LEADER')||' PUTS '||coalesce(v_shame.name,'THE FIELD')||' ON NOTICE','names',jsonb_build_array(coalesce(v_crown.name,'THE LEADER'),coalesce(v_shame.name,'THE FIELD')),'deck','The postseason removed the margin for error and replaced it with screenshots.'),
      'pullQuote',jsonb_build_object('text',case when v_phase='bowl' then 'Twenty-five bowls later, the alibis have become a full-time job.' else 'The bracket is a receipt with increasingly expensive consequences.' end,'by','THE POSTSEASON DESK'),
      'sideStories',jsonb_build_array(
        jsonb_build_object('kicker','PHASE REPORT','headline',case when v_phase='bowl' then 'BOWL MANIA LEFT A CRATER' else 'THE FIELD HAS BEEN REDUCED' end,'body','Every scored card survived the same Foundry pipeline. The dignity count remains unofficial.'),
        jsonb_build_object('kicker','DATA DESK','headline','POSTSEASON SCORES CERTIFIED','body','Standings, Crown, Shame, and the archive were rebuilt from the completed phase.')
      ),
      'classifieds',jsonb_build_array('WANTED: a bracket without emotional damage.','FOR SALE: several postseason guarantees, all expired.','LOST: perspective. Last seen before kickoff.')
    )
  )
  on conflict(league_id,week_number) do update set
    week_label=excluded.week_label,volume_label=excluded.volume_label,payload=excluded.payload,created_at=now()
  returning id into v_dispatch_id;

  v_next:=v_league.current_week+1;
  update public.leagues set current_week=v_next where id=p_league_id;
  return jsonb_build_object(
    'ok',true,'week',v_league.current_week,'phase',v_phase,'nextWeek',v_next,
    'scoredCards',(select count(*) from public.cfb_postseason_entries where league_id=p_league_id and season_key=p_season_key),
    'dispatchId',v_dispatch_id
  );
end;$function$;

revoke all on function public.score_foundry_postseason_week(uuid,integer) from public,anon;
grant execute on function public.score_foundry_postseason_week(uuid,integer) to authenticated;
