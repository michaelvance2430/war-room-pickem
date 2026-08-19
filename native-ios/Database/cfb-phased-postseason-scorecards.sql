-- Week 16-20 CFB postseason scoring receipts.
-- Every scored phase is immutable, auditable, and contributes exactly once.

create table if not exists public.postseason_scorecards (
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  season_key integer not null,
  week_number integer not null,
  phase text not null check (phase in ('bowl_opening','bowl_finale_round1','quarterfinals','semifinals','championship')),
  components jsonb not null check (jsonb_typeof(components)='array'),
  weekly_total integer not null,
  season_total_before integer not null,
  season_total_after integer not null,
  rank_before integer,
  rank_after integer,
  created_at timestamptz not null default now(),
  primary key (league_id,user_id,season_key,week_number)
);

alter table public.postseason_scorecards enable row level security;
revoke all on table public.postseason_scorecards from public,anon,authenticated;
grant select on table public.postseason_scorecards to authenticated;
drop policy if exists "League members read postseason scorecards" on public.postseason_scorecards;
create policy "League members read postseason scorecards" on public.postseason_scorecards
for select to authenticated using (public.is_league_member(league_id));

create or replace function public.get_postseason_scorecards(
  p_league_id uuid,
  p_season_key integer,
  p_user_id uuid default null
) returns setof public.postseason_scorecards
language sql stable security invoker set search_path=public,pg_temp as $function$
  select s.* from public.postseason_scorecards s
  where s.league_id=p_league_id and s.season_key=p_season_key
    and (p_user_id is null or s.user_id=p_user_id)
  order by s.week_number desc,s.user_id;
$function$;
revoke all on function public.get_postseason_scorecards(uuid,integer,uuid) from public,anon;
grant execute on function public.get_postseason_scorecards(uuid,integer,uuid) to authenticated;

create or replace function public.lock_foundry_postseason_week(p_league_id uuid,p_season_key integer) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_uid uuid:=(select auth.uid()); v_league public.leagues%rowtype; v_phase text; v_seed jsonb;
begin
  select * into v_league from public.leagues where id=p_league_id for update;
  if not found or v_uid<>'09544d2b-6eca-4131-a321-c000586c9029'::uuid or v_league.mode<>'foundry' or v_league.commissioner_id<>v_uid then raise exception 'Creator Foundry only'; end if;
  if exists(select 1 from public.memberships where league_id=p_league_id and not is_bot and user_id<>v_uid) then raise exception 'Human roster detected'; end if;
  if not exists(select 1 from public.cfb_postseason_slates where league_id=p_league_id and season_key=p_season_key) then raise exception 'Open Bowl Mania once to stage the Foundry postseason field'; end if;
  v_phase:=case v_league.current_week-v_league.regular_season_weeks when 2 then 'bowl_opening' when 3 then 'bowl_finale_round1' when 4 then 'quarterfinals' when 5 then 'semifinals' when 6 then 'championship' end;
  if v_phase is null then raise exception 'No lockable Foundry postseason week is active'; end if;
  v_seed:=public.seed_foundry_cfb_postseason(p_league_id,p_season_key);
  if v_phase<>'bowl_opening' then update public.cfb_postseason_entries set cfp_locked_at=coalesce(cfp_locked_at,now()),updated_at=now() where league_id=p_league_id and season_key=p_season_key and user_id in(select user_id from public.memberships where league_id=p_league_id and is_bot); end if;
  return jsonb_build_object('ok',true,'week',v_league.current_week,'phase',v_phase,'lockedCards',(select count(*) from public.cfb_postseason_entries where league_id=p_league_id and season_key=p_season_key and case when v_phase='bowl_opening' then bowl_locked_at is not null else cfp_locked_at is not null end));
end;$function$;
revoke all on function public.lock_foundry_postseason_week(uuid,integer) from public,anon;
grant execute on function public.lock_foundry_postseason_week(uuid,integer) to authenticated;

create or replace function public.score_foundry_postseason_week(p_league_id uuid,p_season_key integer) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $function$
declare
  v_uid uuid:=(select auth.uid()); v_league public.leagues%rowtype; v_slate public.cfb_postseason_slates%rowtype;
  v_phase text; v_bowl jsonb:='{}'::jsonb; v_cfp jsonb:='{}'::jsonb; v_add jsonb:='{}'::jsonb; v_seeds jsonb;
  v_next integer; v_dispatch_id uuid; v_entry record; v_crown record; v_shame record; v_bowl_open integer; v_bowl_rest integer; v_dead integer; v_cfp_round integer; v_delta integer; v_before integer;
begin
  select * into v_league from public.leagues where id=p_league_id for update;
  if not found or v_uid<>'09544d2b-6eca-4131-a321-c000586c9029'::uuid or v_league.mode<>'foundry' or v_league.commissioner_id<>v_uid then raise exception 'Creator Foundry only'; end if;
  if exists(select 1 from public.memberships where league_id=p_league_id and not is_bot and user_id<>v_uid) then raise exception 'Human roster detected'; end if;
  select * into v_slate from public.cfb_postseason_slates where league_id=p_league_id and season_key=p_season_key;
  if not found then raise exception 'Foundry postseason field is missing'; end if;
  v_phase:=case v_league.current_week-v_league.regular_season_weeks when 2 then 'bowl_opening' when 3 then 'bowl_finale_round1' when 4 then 'quarterfinals' when 5 then 'semifinals' when 6 then 'championship' end;
  if v_phase is null then raise exception 'No scoreable Foundry postseason week is active'; end if;
  if exists(select 1 from public.postseason_scorecards where league_id=p_league_id and season_key=p_season_key and week_number=v_league.current_week) then raise exception 'This postseason week is already certified'; end if;
  if not exists(select 1 from public.cfb_postseason_entries where league_id=p_league_id and season_key=p_season_key and case when v_phase='bowl_opening' then bowl_locked_at is not null else cfp_locked_at is not null end) then raise exception 'Lock Week before Score Week'; end if;
  select coalesce(bowl_results,'{}'::jsonb),coalesce(cfp_results,'{}'::jsonb) into v_bowl,v_cfp from public.cfb_postseason_results where league_id=p_league_id and season_key=p_season_key;
  v_bowl:=coalesce(v_bowl,'{}'::jsonb); v_cfp:=coalesce(v_cfp,'{}'::jsonb);
  if v_phase like 'bowl_%' then
    select coalesce(jsonb_object_agg(game->>'id',case when ord%2=0 then game->>'away' else game->>'home' end),'{}'::jsonb) into v_add from jsonb_array_elements(v_slate.bowl_games) with ordinality g(game,ord) where (v_phase='bowl_opening' and ord<=15) or (v_phase='bowl_finale_round1' and ord>15);
    v_bowl:=v_add||v_bowl;
  end if;
  v_seeds:=v_slate.cfp_seeds;
  if v_phase='bowl_finale_round1' then v_add:=jsonb_build_object('r1a',v_seeds->>4,'r1b',v_seeds->>7,'r1c',v_seeds->>6,'r1d',v_seeds->>5); v_cfp:=v_add||v_cfp;
  elsif v_phase='quarterfinals' then v_add:=jsonb_build_object('q1',v_seeds->>3,'q2',v_seeds->>0,'q3',v_seeds->>1,'q4',v_seeds->>2); v_cfp:=v_add||v_cfp;
  elsif v_phase='semifinals' then v_add:=jsonb_build_object('s1',v_seeds->>3,'s2',v_seeds->>1); v_cfp:=v_add||v_cfp;
  elsif v_phase='championship' then v_add:=jsonb_build_object('final',v_seeds->>3); v_cfp:=v_add||v_cfp; end if;
  insert into public.cfb_postseason_results(league_id,season_key,bowl_results,cfp_results) values(p_league_id,p_season_key,v_bowl,v_cfp)
  on conflict(league_id,season_key) do update set bowl_results=excluded.bowl_results,cfp_results=excluded.cfp_results,updated_at=now();

  for v_entry in select e.*,m.total_points from public.cfb_postseason_entries e join public.memberships m on m.league_id=e.league_id and m.user_id=e.user_id where e.league_id=p_league_id and e.season_key=p_season_key loop
    select coalesce(sum((v_entry.bowl_allocations->>r.key)::integer),0) into v_bowl_open from jsonb_each_text(v_bowl) r join lateral (select ord from jsonb_array_elements(v_slate.bowl_games) with ordinality g(game,ord) where game->>'id'=r.key) x on true where x.ord<=15 and v_entry.bowl_picks->>r.key=r.value;
    select coalesce(sum((v_entry.bowl_allocations->>r.key)::integer),0) into v_bowl_rest from jsonb_each_text(v_bowl) r join lateral (select ord from jsonb_array_elements(v_slate.bowl_games) with ordinality g(game,ord) where game->>'id'=r.key) x on true where x.ord>15 and v_entry.bowl_picks->>r.key=r.value;
    v_dead:=case when v_entry.dead_hand and (select count(*) from jsonb_object_keys(v_bowl))=25 then
      (case when v_bowl_open+v_bowl_rest>=60 then round((v_bowl_open+v_bowl_rest)*1.5)::integer else round((v_bowl_open+v_bowl_rest)*0.5)::integer end)-v_bowl_open-v_bowl_rest else 0 end;
    v_cfp_round:=coalesce((select sum(case when r.key like 'r1%' then 1 when r.key like 'q%' then 2 when r.key like 's%' then 4 when r.key='final' then 8 else 0 end) from jsonb_each_text(v_add) r where v_entry.cfp_picks->>r.key=r.value),0);
    v_delta:=case v_phase when 'bowl_opening' then v_bowl_open when 'bowl_finale_round1' then v_bowl_rest+v_dead+v_cfp_round else v_cfp_round end;
    v_before:=v_entry.total_points;
    insert into public.postseason_scorecards(league_id,user_id,season_key,week_number,phase,components,weekly_total,season_total_before,season_total_after)
    values(p_league_id,v_entry.user_id,p_season_key,v_league.current_week,v_phase,
      case v_phase
        when 'bowl_opening' then jsonb_build_array(jsonb_build_object('label','Opening 15 bowl picks','points',v_bowl_open))
        when 'bowl_finale_round1' then jsonb_build_array(jsonb_build_object('label','Final 10 bowl picks','points',v_bowl_rest),jsonb_build_object('label',case when v_entry.dead_hand then 'Dead Hand adjustment' else 'Dead Hand not armed' end,'points',v_dead),jsonb_build_object('label','CFP Round 1 bracket','points',v_cfp_round))
        when 'quarterfinals' then jsonb_build_array(jsonb_build_object('label','CFP quarterfinal bracket','points',v_cfp_round))
        when 'semifinals' then jsonb_build_array(jsonb_build_object('label','CFP semifinal bracket','points',v_cfp_round))
        else jsonb_build_array(jsonb_build_object('label','National Championship bracket','points',v_cfp_round)) end,
      v_delta,v_before,v_before+v_delta);
    update public.memberships set total_points=total_points+v_delta,weekly_points=array_append(weekly_points,v_delta),weeks_played=weeks_played+1,best_week=greatest(coalesce(best_week,v_delta),v_delta),worst_week=least(coalesce(worst_week,v_delta),v_delta) where league_id=p_league_id and user_id=v_entry.user_id;
  end loop;
  with ranked_before as (select user_id,row_number() over(order by season_total_before desc,user_id)::integer r from public.postseason_scorecards where league_id=p_league_id and season_key=p_season_key and week_number=v_league.current_week)
  update public.postseason_scorecards s set rank_before=r.r from ranked_before r where s.league_id=p_league_id and s.season_key=p_season_key and s.week_number=v_league.current_week and s.user_id=r.user_id;
  with ranked as (select user_id,row_number() over(order by total_points desc,coalesce(display_name_override,''),user_id)::integer r from public.memberships where league_id=p_league_id)
  update public.postseason_scorecards s set rank_after=r.r from ranked r where s.league_id=p_league_id and s.season_key=p_season_key and s.week_number=v_league.current_week and s.user_id=r.user_id;
  select coalesce(p.display_name,'Foundry Bot') name,s.weekly_total points into v_crown from public.postseason_scorecards s left join public.profiles p on p.id=s.user_id where s.league_id=p_league_id and s.season_key=p_season_key and s.week_number=v_league.current_week order by s.weekly_total desc,coalesce(p.display_name,'Foundry Bot'),s.user_id limit 1;
  select coalesce(p.display_name,'Foundry Bot') name,s.weekly_total points into v_shame from public.postseason_scorecards s left join public.profiles p on p.id=s.user_id where s.league_id=p_league_id and s.season_key=p_season_key and s.week_number=v_league.current_week order by s.weekly_total asc,coalesce(p.display_name,'Foundry Bot'),s.user_id limit 1;

  insert into public.gazette_editions(league_id,week_number,week_label,volume_label,payload) values(p_league_id,v_league.current_week,
    case v_phase when 'bowl_opening' then 'Bowl Week' when 'bowl_finale_round1' then 'Bowls + CFP Round 1' when 'quarterfinals' then 'CFP Quarterfinals' when 'semifinals' then 'CFP Semifinals' else 'National Championship' end,
    'Postseason Special',jsonb_build_object('weekIndex',v_league.current_week,'weekLabel',upper(replace(v_phase,'_',' ')),'volumeLabel','Postseason Special','sportId','cfb','masthead','THE WAR ROOM DISPATCH','tagline','THE PHASE CHANGED. THE PAPER GOT LOUDER.','coverageLine',upper(replace(v_phase,'_',' ')),'stampLine',case when v_phase='championship' then 'A CHAMPION HAS BEEN CROWNED' else 'SURVIVE AND ADVANCE' end,
      'crown',jsonb_build_object('headline',v_crown.name||' OWNS THIS ROUND','names',jsonb_build_array(v_crown.name),'pts',v_crown.points,'deck',v_crown.points||' certified points. The postseason has a new loudest person.'),
      'shame',jsonb_build_object('headline',v_shame.name||' REPORTS TO THE SHAME DESK','names',jsonb_build_array(v_shame.name),'pts',v_shame.points,'deck',v_shame.points||' points. The bracket has requested privacy.'),
      'rivalryWatch',jsonb_build_object('headline',v_crown.name||' PUTS '||v_shame.name||' ON NOTICE','names',jsonb_build_array(v_crown.name,v_shame.name),'deck','The margin for error is gone. The screenshots remain.'),
      'pullQuote',jsonb_build_object('text','Every postseason point now comes with a receipt. The excuses do not.','by','THE POSTSEASON DESK'),'sideStories',jsonb_build_array(jsonb_build_object('kicker','SCORECARD','headline','EVERY POINT CERTIFIED','body','Bowl allocations, Dead Hand, and bracket points were audited before the room advanced.')),
      'classifieds',jsonb_build_array('WANTED: a bracket without emotional damage.','FOR SALE: postseason guarantees, all expired.','LOST: perspective. Last seen before kickoff.')))
  on conflict(league_id,week_number) do update set week_label=excluded.week_label,volume_label=excluded.volume_label,payload=excluded.payload,created_at=now() returning id into v_dispatch_id;
  v_next:=v_league.current_week+1; update public.leagues set current_week=v_next where id=p_league_id;
  return jsonb_build_object('ok',true,'week',v_league.current_week,'phase',v_phase,'nextWeek',v_next,'scoredCards',(select count(*) from public.postseason_scorecards where league_id=p_league_id and season_key=p_season_key and week_number=v_league.current_week),'dispatchId',v_dispatch_id);
end;$function$;
revoke all on function public.score_foundry_postseason_week(uuid,integer) from public,anon;
grant execute on function public.score_foundry_postseason_week(uuid,integer) to authenticated;

-- Foundry mirror scores follow the phased receipts immediately. The production
-- postseason scoreboard remains untouched and retains its existing final-score rules.
create or replace function public.get_foundry_cfb_postseason_standings(p_league_id uuid,p_season_key integer)
returns table(user_id uuid,display_name text,dead_hand boolean,bowl_locked boolean,cfp_locked boolean,bowl_picks jsonb,cfp_picks jsonb,bowl_score integer,cfp_score integer,total_score integer)
language plpgsql security definer set search_path=public,pg_temp as $function$
begin
  if (select auth.uid())<>'09544d2b-6eca-4131-a321-c000586c9029'::uuid or not exists(select 1 from public.leagues l where l.id=p_league_id and l.mode='foundry' and l.commissioner_id=(select auth.uid())) then raise exception 'Creator Foundry only'; end if;
  return query select e.user_id,coalesce(p.display_name,'Foundry Bot'),e.dead_hand,e.bowl_locked_at is not null,e.cfp_locked_at is not null,e.bowl_picks,e.cfp_picks,
    case when count(s.*) filter(where s.phase in('bowl_opening','bowl_finale_round1'))=0 then null else coalesce(sum(s.weekly_total) filter(where s.phase in('bowl_opening','bowl_finale_round1')),0)::integer end,
    case when count(s.*) filter(where s.phase in('bowl_finale_round1','quarterfinals','semifinals','championship'))=0 then null else coalesce(sum((select coalesce(sum((x->>'points')::integer),0) from jsonb_array_elements(s.components) x where x->>'label' ilike '%CFP%' or x->>'label' ilike '%Championship%')),0)::integer end,
    coalesce(sum(s.weekly_total),0)::integer
  from public.cfb_postseason_entries e join public.memberships m on m.league_id=e.league_id and m.user_id=e.user_id left join public.profiles p on p.id=e.user_id
  left join public.postseason_scorecards s on s.league_id=e.league_id and s.user_id=e.user_id and s.season_key=e.season_key
  where e.league_id=p_league_id and e.season_key=p_season_key
  group by e.user_id,p.display_name,e.dead_hand,e.bowl_locked_at,e.cfp_locked_at,e.bowl_picks,e.cfp_picks
  order by coalesce(sum(s.weekly_total),0) desc,coalesce(p.display_name,'Foundry Bot');
end;$function$;
revoke all on function public.get_foundry_cfb_postseason_standings(uuid,integer) from public,anon;
grant execute on function public.get_foundry_cfb_postseason_standings(uuid,integer) to authenticated;
