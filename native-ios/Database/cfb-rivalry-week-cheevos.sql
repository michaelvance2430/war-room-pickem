-- CFB Rivalry Week: durable game designation, UUID/season history, four-tier
-- Cheevo certification, and creator-only Foundry staging.
alter table public.card_games
  add column if not exists is_rivalry boolean not null default false;

create table if not exists public.rivalry_week_history (
  id uuid primary key default gen_random_uuid(),
  league_id uuid references public.leagues(id) on delete set null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  season_key integer not null check (season_key between 2000 and 2200),
  card_completed boolean not null default false,
  rivalry_hits integer not null default 0 check (rivalry_hits >= 0),
  rivalry_best_bet_hits integer not null default 0 check (rivalry_best_bet_hits >= 0),
  certified_at timestamptz not null default clock_timestamp(),
  unique (league_id, user_id, season_key)
);

alter table public.rivalry_week_history enable row level security;
drop policy if exists rivalry_history_read_own on public.rivalry_week_history;
create policy rivalry_history_read_own on public.rivalry_week_history
for select to authenticated using (user_id = auth.uid());

create index if not exists rivalry_history_user_season_idx
  on public.rivalry_week_history(user_id, season_key);

create or replace function private.certify_rivalry_week_cheevos()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_league public.leagues%rowtype;
  v_season integer;
  v_card_completed boolean := false;
  v_hits integer := 0;
  v_best_bet_hits integer := 0;
  v_hit_seasons integer := 0;
  v_best_bet_seasons integer := 0;
begin
  select * into v_league from public.leagues where id = new.league_id;
  if not found or lower(coalesce(v_league.sport_id, '')) <> 'cfb'
     or (v_league.mode = 'foundry' and not coalesce(new.is_bot, false)) then
    return new;
  end if;

  select extract(year from wr.scored_at)::integer,
         count(distinct pg.card_game_id) = 5,
         count(*) filter (where cg.is_rivalry and gr.winner <> 'push' and pg.side = gr.winner),
         count(*) filter (where cg.is_rivalry and pg.is_best_bet and gr.winner <> 'push' and pg.side = gr.winner)
  into v_season, v_card_completed, v_hits, v_best_bet_hits
  from public.picks px
  join public.pick_games pg on pg.pick_id = px.id
  join public.card_games cg on cg.id = pg.card_game_id
  join public.week_results wr on wr.league_id = px.league_id and wr.week_number = px.week_number
  join public.game_results gr on gr.week_result_id = wr.id and gr.card_game_id = pg.card_game_id
  where px.league_id = new.league_id and px.user_id = new.user_id
    and px.week_number = 13 and px.locked_at is not null
  group by extract(year from wr.scored_at)::integer;

  if v_season is not null then
    insert into public.rivalry_week_history(
      league_id,user_id,season_key,card_completed,rivalry_hits,rivalry_best_bet_hits,certified_at
    ) values (
      new.league_id,new.user_id,v_season,v_card_completed,v_hits,v_best_bet_hits,clock_timestamp()
    )
    on conflict (league_id,user_id,season_key) do update set
      card_completed=excluded.card_completed,
      rivalry_hits=excluded.rivalry_hits,
      rivalry_best_bet_hits=excluded.rivalry_best_bet_hits,
      certified_at=excluded.certified_at;
  end if;

  select count(distinct season_key) filter(where rivalry_hits > 0),
         count(distinct season_key) filter(where rivalry_best_bet_hits > 0)
  into v_hit_seasons, v_best_bet_seasons
  from public.rivalry_week_history where user_id = new.user_id;

  insert into public.achievements(league_id,user_id,code,title,flavor)
  select new.league_id,new.user_id,r.code,r.title,r.flavor
  from (values
    ('hate_week_roll_call','Picked a Fight','Five grudges selected. The gravy boat has been moved out of punching range.',coalesce(v_card_completed,false)),
    ('rivalry_week','Family Group Chat Muted','One rivalry pick cashed. Notifications entered witness protection.',v_hit_seasons >= 1),
    ('grudge_veteran','Two-Year Restraining Order','The same bad blood survived two distinct CFB seasons.',v_hit_seasons >= 2),
    ('dynasty_of_spite','Generational Hater','Three distinct seasons of rivalry receipts, plus a Best Bet planted in enemy territory.',v_hit_seasons >= 3 and v_best_bet_seasons >= 1)
  ) as r(code,title,flavor,earned)
  where r.earned
  on conflict (league_id,user_id,code) do nothing;
  return new;
end;
$$;

revoke execute on function private.certify_rivalry_week_cheevos() from public,anon,authenticated;
drop trigger if exists certify_rivalry_week_cheevos_after_score on public.memberships;
create trigger certify_rivalry_week_cheevos_after_score
after update of total_points,weekly_points,ats_correct,best_bet_hits,best_bet_total,
  prop_hits,prop_total,weeks_played
on public.memberships
for each row execute function private.certify_rivalry_week_cheevos();

-- Every automatically-created CFB Foundry Week 13 card becomes a five-game
-- rivalry showcase. Production cards are never rewritten by this trigger.
create or replace function private.decorate_foundry_rivalry_game()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare v_week integer; v_sport text; v_mode text;
begin
  select wc.week_number,l.sport_id,l.mode into v_week,v_sport,v_mode
  from public.week_cards wc join public.leagues l on l.id=wc.league_id
  where wc.id=new.week_card_id;
  if v_mode='foundry' and lower(coalesce(v_sport,''))='cfb' and v_week=13 then
    new.is_rivalry := true;
    new.bookmaker := 'Foundry Rivalry Archive';
    case new.sort_order
      when 0 then new.away_team:='Auburn'; new.home_team:='Alabama'; new.spread:=7.5; new.favorite:='home';
      when 1 then new.away_team:='Michigan'; new.home_team:='Ohio State'; new.spread:=3.5; new.favorite:='home';
      when 2 then new.away_team:='Florida'; new.home_team:='Florida State'; new.spread:=2.5; new.favorite:='away';
      when 3 then new.away_team:='Kentucky'; new.home_team:='Louisville'; new.spread:=5.5; new.favorite:='home';
      else new.away_team:='Texas A&M'; new.home_team:='Texas'; new.spread:=6.5; new.favorite:='home';
    end case;
  end if;
  return new;
end;
$$;

drop trigger if exists decorate_foundry_rivalry_game_before_write on public.card_games;
create trigger decorate_foundry_rivalry_game_before_write
before insert or update on public.card_games
for each row execute function private.decorate_foundry_rivalry_game();

create or replace function public.publish_week_card_atomic(
  p_league_id uuid,p_week_number integer,p_games jsonb,p_prop_question text,
  p_prop_option_a text,p_prop_option_b text,p_prop_points integer
) returns jsonb
language plpgsql security definer set search_path=public
as $$
declare v_card_id uuid; v_game_count integer; v_games jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.is_league_ops(p_league_id) then raise exception 'Commissioner or deputy required'; end if;
  if p_week_number<0 or p_week_number>99 then raise exception 'Invalid week'; end if;
  if coalesce(btrim(p_prop_question),'')='' or coalesce(btrim(p_prop_option_a),'')=''
     or coalesce(btrim(p_prop_option_b),'')='' or p_prop_option_a=p_prop_option_b then raise exception 'Complete the weekly prop'; end if;
  if p_prop_points<0 or p_prop_points>25 then raise exception 'Invalid prop points'; end if;
  if jsonb_typeof(p_games)<>'array' then raise exception 'Games payload must be an array'; end if;
  select count(*) into v_game_count from jsonb_array_elements(p_games);
  if v_game_count<>5 then raise exception 'Select exactly five games'; end if;
  if exists(select 1 from jsonb_to_recordset(p_games) as g(sort_order integer,away_team text,home_team text,spread numeric,favorite text,start_time text,bookmaker text,away_rank integer,home_rank integer,is_rivalry boolean)
    where g.sort_order is null or g.sort_order<0 or g.sort_order>4 or coalesce(btrim(g.away_team),'')='' or coalesce(btrim(g.home_team),'')=''
      or g.away_team=g.home_team or g.spread is null or g.favorite not in ('home','away') or coalesce(btrim(g.start_time),'')='')
  then raise exception 'Every game needs valid teams, spread, favorite, and kickoff'; end if;
  if (select count(distinct g.sort_order) from jsonb_to_recordset(p_games) as g(sort_order integer))<>5 then raise exception 'Game order must be unique'; end if;
  if exists(select 1 from jsonb_to_recordset(p_games) as g(start_time text) where g.start_time::timestamptz<=clock_timestamp()) then raise exception 'Cannot publish a game after kickoff'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_league_id::text||':'||p_week_number::text,0));
  select id into v_card_id from public.week_cards where league_id=p_league_id and week_number=p_week_number for update;
  if v_card_id is not null and exists(select 1 from public.picks where league_id=p_league_id and week_number=p_week_number) then raise exception 'Card is locked because player picks already exist'; end if;
  if exists(select 1 from public.week_results where league_id=p_league_id and week_number=p_week_number) then raise exception 'Card is locked because the week is scored'; end if;
  if v_card_id is null then
    insert into public.week_cards(league_id,week_number,prop_question,prop_option_a,prop_option_b,prop_points,published_at)
    values(p_league_id,p_week_number,btrim(p_prop_question),btrim(p_prop_option_a),btrim(p_prop_option_b),p_prop_points,clock_timestamp()) returning id into v_card_id;
  else
    update public.week_cards set prop_question=btrim(p_prop_question),prop_option_a=btrim(p_prop_option_a),prop_option_b=btrim(p_prop_option_b),prop_points=p_prop_points,published_at=clock_timestamp() where id=v_card_id;
    delete from public.card_games where week_card_id=v_card_id;
  end if;
  insert into public.card_games(week_card_id,sort_order,away_team,home_team,spread,favorite,start_time,bookmaker,away_rank,home_rank,is_rivalry)
  select v_card_id,g.sort_order,btrim(g.away_team),btrim(g.home_team),g.spread,g.favorite,g.start_time,nullif(btrim(g.bookmaker),''),g.away_rank,g.home_rank,coalesce(g.is_rivalry,false)
  from jsonb_to_recordset(p_games) as g(sort_order integer,away_team text,home_team text,spread numeric,favorite text,start_time text,bookmaker text,away_rank integer,home_rank integer,is_rivalry boolean);
  update public.leagues set current_week=p_week_number where id=p_league_id;
  select jsonb_agg(jsonb_build_object('id',id,'sort_order',sort_order,'is_rivalry',is_rivalry) order by sort_order) into v_games from public.card_games where week_card_id=v_card_id;
  return jsonb_build_object('week_card_id',v_card_id,'games',v_games);
end;
$$;

revoke all on function public.publish_week_card_atomic(uuid,integer,jsonb,text,text,text,integer) from public,anon;
grant execute on function public.publish_week_card_atomic(uuid,integer,jsonb,text,text,text,integer) to authenticated;

create or replace function public.stage_foundry_rivalry_week(p_league_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_league public.leagues%rowtype; v_week integer; v_from integer; v_results jsonb; v_prop text; v_processed integer:=0;
begin
  if v_uid is null or v_uid<>'09544d2b-6eca-4131-a321-c000586c9029'::uuid then raise exception 'Creator Foundry only'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_league_id::text||':rivalry-stage',0));
  select * into v_league from public.leagues where id=p_league_id for update;
  if not found or v_league.mode<>'foundry' or lower(v_league.sport_id)<>'cfb' or v_league.commissioner_id<>v_uid then raise exception 'CFB Foundry only'; end if;
  if exists(select 1 from public.memberships where league_id=p_league_id and not is_bot and user_id<>v_uid) then raise exception 'Human roster detected'; end if;
  v_from:=v_league.current_week;
  if v_from>13 then raise exception 'Restore the CFB Foundry before staging Rivalry Week'; end if;
  if v_from<13 then
    for v_week in v_from..12 loop
      select jsonb_agg(jsonb_build_object('game_id',cg.id,'winner',case when (cg.sort_order+v_week)%2=0 then 'home' else 'away' end) order by cg.sort_order)
      into v_results from public.week_cards wc join public.card_games cg on cg.week_card_id=wc.id where wc.league_id=p_league_id and wc.week_number=v_week;
      if v_results is null then raise exception 'Foundry week % has no test card',v_week; end if;
      select case when v_week%2=0 then prop_option_a else prop_option_b end into v_prop from public.week_cards where league_id=p_league_id and week_number=v_week;
      perform public.process_foundry_week(p_league_id,v_week,v_results,v_prop);
      v_processed:=v_processed+1;
    end loop;
  end if;
  return jsonb_build_object('ok',true,'fromWeek',v_from,'rivalryWeek',13,'weeksProcessed',v_processed);
end;
$$;
revoke all on function public.stage_foundry_rivalry_week(uuid) from public,anon;
grant execute on function public.stage_foundry_rivalry_week(uuid) to authenticated;

create or replace function public.seed_foundry_rivalry_history(p_league_id uuid)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid(); v_year integer:=extract(year from current_date)::integer; v_count integer;
begin
  if v_uid is null or v_uid<>'09544d2b-6eca-4131-a321-c000586c9029'::uuid then raise exception 'Creator Foundry only'; end if;
  if not exists(select 1 from public.leagues where id=p_league_id and mode='foundry' and lower(sport_id)='cfb' and commissioner_id=v_uid) then raise exception 'CFB Foundry only'; end if;
  insert into public.rivalry_week_history(league_id,user_id,season_key,card_completed,rivalry_hits,rivalry_best_bet_hits)
  select p_league_id,m.user_id,y,true,1,case when y=v_year-1 then 1 else 0 end
  from public.memberships m cross join lateral (values(v_year-2),(v_year-1)) s(y)
  where m.league_id=p_league_id and m.is_bot
  on conflict(league_id,user_id,season_key) do update set card_completed=true,rivalry_hits=1,rivalry_best_bet_hits=excluded.rivalry_best_bet_hits,certified_at=clock_timestamp();
  get diagnostics v_count=row_count;
  update public.memberships set total_points=total_points where league_id=p_league_id and is_bot;
  return jsonb_build_object('ok',true,'historyRows',v_count,'pastSeasons',2);
end;
$$;
revoke all on function public.seed_foundry_rivalry_history(uuid) from public,anon;
grant execute on function public.seed_foundry_rivalry_history(uuid) to authenticated;
