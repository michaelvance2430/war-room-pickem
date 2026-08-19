-- Native Foundry weekly orchestration. Production leagues are explicitly rejected.
create or replace function public.process_foundry_week(
  p_league_id uuid,
  p_week_number integer,
  p_results jsonb,
  p_prop_result text
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_uid uuid := auth.uid();
  v_league public.leagues%rowtype;
  v_score jsonb;
  v_crown record;
  v_shame record;
  v_quote record;
  v_dispatch_id uuid;
  v_next integer;
  v_next_card uuid;
  v_phase text;
  v_bot_seed json;
  v_talker uuid;
  v_talk text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if v_uid <> '09544d2b-6eca-4131-a321-c000586c9029'::uuid then raise exception 'Creator Foundry only'; end if;
  select * into v_league from public.leagues where id=p_league_id for update;
  if not found or v_league.mode <> 'foundry' or v_league.commissioner_id <> v_uid then
    raise exception 'Creator Foundry only';
  end if;
  if v_league.current_week <> p_week_number then raise exception 'Foundry week moved; reload the room'; end if;
  if exists(select 1 from public.memberships m where m.league_id=p_league_id and not m.is_bot and m.user_id<>v_uid) then
    raise exception 'Human roster detected';
  end if;
  if (select count(*) from public.memberships m where m.league_id=p_league_id and m.is_bot) < 8 then
    raise exception 'Bot roster incomplete';
  end if;
  if exists(select 1 from public.week_results where league_id=p_league_id and week_number=p_week_number) then
    raise exception 'Foundry week already processed';
  end if;

  v_score := public.score_foundry_week_atomic(p_league_id,p_week_number,p_results,p_prop_result);
  perform public.write_foundry_regular_scorecards(p_league_id,p_week_number);

  select coalesce(pr.display_name,'Player') name, p.user_id, p.total_points points
    into v_crown
  from public.picks p left join public.profiles pr on pr.id=p.user_id
  where p.league_id=p_league_id and p.week_number=p_week_number and p.locked_at is not null
  order by p.total_points desc, coalesce(pr.display_name,'Player'),p.user_id limit 1;

  select coalesce(pr.display_name,'Player') name, p.user_id, p.total_points points
    into v_shame
  from public.picks p left join public.profiles pr on pr.id=p.user_id
  where p.league_id=p_league_id and p.week_number=p_week_number and p.locked_at is not null
  order by p.total_points asc, coalesce(pr.display_name,'Player'),p.user_id limit 1;

  select lm.body,coalesce(pr.display_name,'Anonymous Coward') name
    into v_quote
  from public.locker_messages lm left join public.profiles pr on pr.id=lm.user_id
  where lm.league_id=p_league_id
  order by lm.created_at desc,lm.id desc limit 1;

  insert into public.gazette_editions(league_id,week_number,week_label,volume_label,payload)
  values (
    p_league_id,p_week_number,'Week '||p_week_number,'Volume '||(p_week_number+1),
    jsonb_build_object(
      'weekIndex',p_week_number,'weekLabel','Week '||p_week_number,'volumeLabel','Volume '||(p_week_number+1),
      'coverageLine','Foundry Bot Lab · Week '||p_week_number||' final','masthead','THE WAR ROOM DISPATCH',
      'tagline','All the news that''s fit to roast','sportId',upper(coalesce(v_league.sport_id,'CFB')),
      'stampLine',case when p_week_number >= v_league.regular_season_weeks+1 then 'POSTSEASON EXTRA' else 'FINAL SCORES' end,
      'ritualName','Crown & Shame Filing','printedLine','Filed after atomic score certification',
      'crown',jsonb_build_object('names',jsonb_build_array(v_crown.name),'pts',v_crown.points,
        'headline',v_crown.name||' SEIZES THE CROWN','deck',v_crown.points||' points. Humility has left the building.','kind','crown'),
      'shame',jsonb_build_object('names',jsonb_build_array(v_shame.name),'pts',v_shame.points,
        'headline',v_shame.name||' REPORTS TO THE SHAME DESK','deck',v_shame.points||' points. The film room has questions.','kind','shame'),
      'swing',jsonb_build_object('names',jsonb_build_array(v_crown.name),'pts',v_crown.points,
        'headline',v_crown.name||' MADE THE WEEK ABOUT THEM','deck','A standings jump powered by confidence and absolutely no restraint.','kind','swing'),
      'rivalryWatch',jsonb_build_object('names',jsonb_build_array(v_crown.name,v_shame.name),
        'headline',v_crown.name||' SENDS '||v_shame.name||' TO THE BASEMENT','deck','One room. Two very different Sundays.','kind','rivalry'),
      'weather',jsonb_build_object('kicker','WAR ROOM WEATHER','body','High confidence, scattered excuses, and a strong chance of screenshots.'),
      'pullQuote',jsonb_build_object('text',coalesce(v_quote.body,'I was robbed and the spreadsheet knows it.'),'by',coalesce(v_quote.name,'The Locker Room')),
      'sideStories',jsonb_build_array(
        jsonb_build_object('kicker','LOCKER ROOM WIRE','headline','THE DISPATCH HEARD THE NOISE','body',coalesce(v_quote.name,'A player')||' said: '||coalesce(v_quote.body,'No comment. Suspicious.')),
        jsonb_build_object('kicker','DATA DESK','headline',(v_score->>'scoredCount')||' CARDS CERTIFIED','body','Standings were rebuilt from the scored slips, not advanced by theater.')
      ),
      'classifieds',jsonb_build_array(
        'WANTED: accountability. Last seen before the prop result.',
        'FOR SALE: one lock of the week, lightly used, completely incorrect.',
        'LOST: shame. If found, return it to '||v_crown.name||'.'
      )
    )
  )
  on conflict(league_id,week_number) do update set
    week_label=excluded.week_label,volume_label=excluded.volume_label,payload=excluded.payload,created_at=now()
  returning id into v_dispatch_id;

  v_next := p_week_number+1;
  v_phase := case when v_next > v_league.regular_season_weeks then 'postseason' else 'regular_season' end;

  if v_next <= v_league.regular_season_weeks+4 then
    select id into v_next_card from public.week_cards where league_id=p_league_id and week_number=v_next;
    if v_next_card is null then
      insert into public.week_cards(league_id,week_number,lock_time,prop_question,prop_option_a,prop_option_b,prop_points,published_at)
      select p_league_id,v_next,(now()+interval '7 days')::text,
        case when v_phase='postseason' then 'Will postseason pressure create at least one push?' else 'Will the room blame the commissioner before Monday?' end,
        'Yes — dignity is already gone','No — a shocking display of restraint',3,now()
      from public.week_cards where league_id=p_league_id and week_number=p_week_number
      returning id into v_next_card;

      insert into public.card_games(week_card_id,sort_order,away_team,home_team,spread,favorite,start_time,bookmaker,away_rank,home_rank)
      select v_next_card,sort_order,away_team,home_team,
        spread + case when v_next%2=0 then 0.5 else -0.5 end,
        case when (sort_order+v_next)%3=0 then case favorite when 'home' then 'away' else 'home' end else favorite end,
        (now()+interval '7 days'+(sort_order||' hours')::interval)::text,'Foundry Simulation',away_rank,home_rank
      from public.card_games cg join public.week_cards wc on wc.id=cg.week_card_id
      where wc.league_id=p_league_id and wc.week_number=p_week_number order by sort_order;
    end if;
    v_bot_seed := public.seed_bot_picks_for_week(p_league_id,v_next);
  end if;

  select m.user_id into v_talker from public.memberships m join public.profiles p on p.id=m.user_id
  where m.league_id=p_league_id and m.is_bot order by case when p.display_name='Confidence King' then 0 else 1 end,p.display_name limit 1;
  v_talk := 'Week '||v_next||': '||(array[
    'I have reviewed the standings and concluded the rest of you are decorative.',
    'Another week, another opportunity for everyone to pretend variance is a personality.',
    'The Dispatch can quote me correctly: I carried this room emotionally and statistically.',
    'Please lock early so I have more time to study your mistakes.',
    'I do not fear the postseason. The postseason should probably fear my group chat.'
  ])[1+(v_next%5)];
  if v_talker is not null and v_next <= v_league.regular_season_weeks+4 then
    insert into public.locker_messages(league_id,user_id,body,created_at) values(p_league_id,v_talker,v_talk,clock_timestamp());
  end if;

  update public.leagues set current_week=v_next where id=p_league_id;
  return v_score || jsonb_build_object(
    'dispatchId',v_dispatch_id,'crownName',v_crown.name,'crownPoints',v_crown.points,
    'shameName',v_shame.name,'shamePoints',v_shame.points,'lockerQuote',coalesce(v_quote.body,''),
    'nextWeek',v_next,'phase',v_phase,'nextCardReady',v_next_card is not null
  );
end;
$function$;

revoke all on function public.process_foundry_week(uuid,integer,jsonb,text) from public,anon;
grant execute on function public.process_foundry_week(uuid,integer,jsonb,text) to authenticated;

create or replace function public.reset_foundry_lab(p_league_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare v_uid uuid:=auth.uid(); v_seed json; v_bot uuid;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if v_uid <> '09544d2b-6eca-4131-a321-c000586c9029'::uuid then raise exception 'Creator Foundry only'; end if;
  if not exists(select 1 from public.leagues where id=p_league_id and mode='foundry' and commissioner_id=v_uid) then raise exception 'Creator Foundry only'; end if;
  if exists(select 1 from public.memberships where league_id=p_league_id and not is_bot and user_id<>v_uid) then raise exception 'Human roster detected'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_league_id::text||':reset',0));
  delete from public.gazette_editions where league_id=p_league_id;
  delete from public.postseason_scorecards where league_id=p_league_id;
  delete from public.week_results where league_id=p_league_id;
  delete from public.picks where league_id=p_league_id;
  delete from public.week_cards where league_id=p_league_id and week_number>0;
  delete from public.locker_messages where league_id=p_league_id;
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
  return jsonb_build_object('ok',true,'week',0,'botsSeeded',v_seed);
end;
$function$;

revoke all on function public.reset_foundry_lab(uuid) from public,anon;
grant execute on function public.reset_foundry_lab(uuid) to authenticated;

-- Creator-only time machine. Every skipped week still travels through the
-- authoritative score -> standings -> Dispatch -> next-card pipeline.
create or replace function public.complete_foundry_regular_season(p_league_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_uid uuid := auth.uid();
  v_league public.leagues%rowtype;
  v_week integer;
  v_from integer;
  v_results jsonb;
  v_prop text;
  v_processed integer := 0;
  v_last jsonb;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if v_uid <> '09544d2b-6eca-4131-a321-c000586c9029'::uuid then raise exception 'Creator Foundry only'; end if;

  perform pg_advisory_xact_lock(hashtextextended(p_league_id::text || ':regular-season-skip', 0));
  select * into v_league from public.leagues where id = p_league_id for update;
  if not found or v_league.mode <> 'foundry' or v_league.commissioner_id <> v_uid then
    raise exception 'Creator Foundry only';
  end if;
  if exists(select 1 from public.memberships where league_id=p_league_id and not is_bot and user_id<>v_uid) then
    raise exception 'Human roster detected';
  end if;

  v_from := v_league.current_week;
  if v_from > v_league.regular_season_weeks then
    return jsonb_build_object('ok',true,'fromWeek',v_from,'postseasonWeek',v_from,'weeksProcessed',0);
  end if;

  for v_week in v_from..v_league.regular_season_weeks loop
    select jsonb_agg(
      jsonb_build_object(
        'game_id', cg.id,
        'winner', case when (cg.sort_order + v_week) % 7 = 0 then 'push'
                       when (cg.sort_order + v_week) % 2 = 0 then 'home'
                       else 'away' end
      ) order by cg.sort_order
    ) into v_results
    from public.week_cards wc
    join public.card_games cg on cg.week_card_id = wc.id
    where wc.league_id = p_league_id and wc.week_number = v_week;

    if v_results is null then raise exception 'Foundry week % has no test card', v_week; end if;

    select case when v_week % 2 = 0 then prop_option_a else prop_option_b end
      into v_prop
    from public.week_cards
    where league_id = p_league_id and week_number = v_week;

    v_last := public.process_foundry_week(p_league_id, v_week, v_results, v_prop);
    v_processed := v_processed + 1;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'fromWeek', v_from,
    'postseasonWeek', v_league.regular_season_weeks + 1,
    'weeksProcessed', v_processed,
    'lastWeek', v_last
  );
end;
$function$;

revoke all on function public.complete_foundry_regular_season(uuid) from public, anon;
grant execute on function public.complete_foundry_regular_season(uuid) to authenticated;
