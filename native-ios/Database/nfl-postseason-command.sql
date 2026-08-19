-- Native NFL Final Thirteen: official 14-team field, cloud brackets, JDAM ledger,
-- commissioner results, scoring receipts, and a sport-aware season reset.
begin;

create table if not exists public.nfl_postseason_slates (
  league_id uuid not null references public.leagues(id) on delete cascade,
  season_key integer not null,
  teams jsonb not null check (jsonb_typeof(teams)='array'),
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (league_id,season_key)
);

create table if not exists public.nfl_postseason_entries (
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  season_key integer not null,
  picks jsonb not null default '{}'::jsonb check (jsonb_typeof(picks)='object'),
  used_jdam boolean not null default false,
  locked_at timestamptz,
  score integer,
  updated_at timestamptz not null default now(),
  primary key (league_id,user_id,season_key),
  foreign key (league_id,season_key) references public.nfl_postseason_slates(league_id,season_key) on delete cascade
);

create table if not exists public.nfl_postseason_results (
  league_id uuid not null references public.leagues(id) on delete cascade,
  season_key integer not null,
  winners jsonb not null default '{}'::jsonb check (jsonb_typeof(winners)='object'),
  updated_at timestamptz not null default now(),
  primary key (league_id,season_key),
  foreign key (league_id,season_key) references public.nfl_postseason_slates(league_id,season_key) on delete cascade
);

create table if not exists public.nfl_postseason_scorecards (
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  season_key integer not null,
  wild_card_points integer not null default 0,
  divisional_points integer not null default 0,
  conference_points integer not null default 0,
  super_bowl_points integer not null default 0,
  total_points integer not null default 0,
  used_jdam boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (league_id,user_id,season_key)
);

alter table public.nfl_postseason_slates enable row level security;
alter table public.nfl_postseason_entries enable row level security;
alter table public.nfl_postseason_results enable row level security;
alter table public.nfl_postseason_scorecards enable row level security;

revoke all on public.nfl_postseason_slates,public.nfl_postseason_entries,public.nfl_postseason_results,public.nfl_postseason_scorecards from public,anon,authenticated;
grant select,insert,update on public.nfl_postseason_slates,public.nfl_postseason_entries,public.nfl_postseason_results to authenticated;
grant select on public.nfl_postseason_scorecards to authenticated;

drop policy if exists "Members read NFL postseason slate" on public.nfl_postseason_slates;
create policy "Members read NFL postseason slate" on public.nfl_postseason_slates for select to authenticated
using (public.is_league_member(league_id));
drop policy if exists "Commissioner writes NFL postseason slate" on public.nfl_postseason_slates;
create policy "Commissioner writes NFL postseason slate" on public.nfl_postseason_slates for all to authenticated
using (exists(select 1 from public.leagues l where l.id=league_id and l.commissioner_id=(select auth.uid())))
with check (exists(select 1 from public.leagues l where l.id=league_id and l.commissioner_id=(select auth.uid())));

drop policy if exists "Players read own NFL bracket" on public.nfl_postseason_entries;
create policy "Players read own NFL bracket" on public.nfl_postseason_entries for select to authenticated
using (user_id=(select auth.uid()) and public.is_league_member(league_id));
drop policy if exists "Players create own NFL bracket" on public.nfl_postseason_entries;
create policy "Players create own NFL bracket" on public.nfl_postseason_entries for insert to authenticated
with check (user_id=(select auth.uid()) and public.is_league_member(league_id));
drop policy if exists "Players update own unlocked NFL bracket" on public.nfl_postseason_entries;
create policy "Players update own unlocked NFL bracket" on public.nfl_postseason_entries for update to authenticated
using (user_id=(select auth.uid()) and public.is_league_member(league_id) and locked_at is null)
with check (user_id=(select auth.uid()) and public.is_league_member(league_id));

drop policy if exists "Members read NFL results" on public.nfl_postseason_results;
create policy "Members read NFL results" on public.nfl_postseason_results for select to authenticated using (public.is_league_member(league_id));
drop policy if exists "Commissioner writes NFL results" on public.nfl_postseason_results;
create policy "Commissioner writes NFL results" on public.nfl_postseason_results for all to authenticated
using (exists(select 1 from public.leagues l where l.id=league_id and l.commissioner_id=(select auth.uid())))
with check (exists(select 1 from public.leagues l where l.id=league_id and l.commissioner_id=(select auth.uid())));

drop policy if exists "Members read NFL scorecards" on public.nfl_postseason_scorecards;
create policy "Members read NFL scorecards" on public.nfl_postseason_scorecards for select to authenticated
using (public.is_league_member(league_id));

create or replace function public.validate_nfl_postseason_slate() returns trigger
language plpgsql security invoker set search_path=public,pg_temp as $function$
declare v_conf text;
begin
  if tg_op='UPDATE' and exists(select 1 from public.nfl_postseason_entries e where e.league_id=old.league_id and e.season_key=old.season_key and e.locked_at is not null)
    and new.teams is distinct from old.teams then raise exception 'The playoff field is frozen after the first bracket lock'; end if;
  if jsonb_array_length(new.teams)<>14 then raise exception 'The NFL playoff field requires 14 teams'; end if;
  if (select count(distinct t->>'id') from jsonb_array_elements(new.teams)t)<>14 or
     exists(select 1 from jsonb_array_elements(new.teams)t where coalesce(trim(t->>'id'),'')='' or coalesce(trim(t->>'name'),'')='' or t->>'conference' not in ('AFC','NFC') or (t->>'seed')::integer not between 1 and 7) then
    raise exception 'Every NFL playoff team needs a unique id, name, AFC/NFC conference, and seed 1–7';
  end if;
  foreach v_conf in array array['AFC','NFC'] loop
    if (select count(*) from jsonb_array_elements(new.teams)t where t->>'conference'=v_conf)<>7 or
       (select count(distinct (t->>'seed')::integer) from jsonb_array_elements(new.teams)t where t->>'conference'=v_conf)<>7 then
      raise exception '% requires exactly one team at every seed from 1 through 7',v_conf;
    end if;
  end loop;
  new.updated_at=now(); return new;
end;$function$;
revoke all on function public.validate_nfl_postseason_slate() from public,anon,authenticated;
drop trigger if exists validate_nfl_postseason_slate on public.nfl_postseason_slates;
create trigger validate_nfl_postseason_slate before insert or update on public.nfl_postseason_slates for each row execute function public.validate_nfl_postseason_slate();

create or replace function public.publish_nfl_postseason_slate(p_league_id uuid,p_season_key integer,p_teams jsonb)
returns public.nfl_postseason_slates language plpgsql security invoker set search_path=public,pg_temp as $function$
declare v_slate public.nfl_postseason_slates;
begin
  if not exists(select 1 from public.leagues l where l.id=p_league_id and l.sport_id='nfl' and l.commissioner_id=(select auth.uid())) then raise exception 'NFL commissioner authority required'; end if;
  insert into public.nfl_postseason_slates(league_id,season_key,teams,published_at) values(p_league_id,p_season_key,p_teams,now())
  on conflict(league_id,season_key) do update set teams=excluded.teams,published_at=now(),updated_at=now() returning * into v_slate;
  return v_slate;
end;$function$;
revoke all on function public.publish_nfl_postseason_slate(uuid,integer,jsonb) from public,anon;
grant execute on function public.publish_nfl_postseason_slate(uuid,integer,jsonb) to authenticated;

create or replace function public.save_nfl_postseason_bracket(p_league_id uuid,p_season_key integer,p_picks jsonb,p_used_jdam boolean default false)
returns public.nfl_postseason_entries language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_uid uuid:=(select auth.uid()); v_entry public.nfl_postseason_entries; v_league public.leagues%rowtype; v_slate public.nfl_postseason_slates%rowtype;
begin
  select * into v_league from public.leagues where id=p_league_id;
  if v_uid is null or not found or v_league.sport_id<>'nfl' or not public.is_league_member(p_league_id) then raise exception 'NFL league membership required'; end if;
  if v_league.current_week<19 then raise exception 'The Final Thirteen opens after Week 18'; end if;
  select * into v_slate from public.nfl_postseason_slates where league_id=p_league_id and season_key=p_season_key;
  if not found then raise exception 'The commissioner has not published the official playoff field'; end if;
  if jsonb_typeof(p_picks)<>'object' or (select count(*) from jsonb_object_keys(p_picks))<>13 then raise exception 'The Final Thirteen requires all 13 decisions'; end if;
  if exists(select 1 from jsonb_each_text(p_picks)p where not exists(select 1 from jsonb_array_elements(v_slate.teams)t where t->>'id'=p.value)) then raise exception 'A bracket pick is not in the official field'; end if;
  insert into public.nfl_postseason_entries(league_id,user_id,season_key,picks,used_jdam,locked_at)
  values(p_league_id,v_uid,p_season_key,p_picks,p_used_jdam,now())
  on conflict(league_id,user_id,season_key) do update set picks=excluded.picks,used_jdam=excluded.used_jdam,locked_at=excluded.locked_at,updated_at=now()
  where public.nfl_postseason_entries.locked_at is null returning * into v_entry;
  if not found then raise exception 'This NFL bracket is already sealed'; end if;
  if p_used_jdam then
    insert into public.weapon_service_events(user_id,league_id,league_name,sport_id,season_year,week_number,weapon_type,phase,source_event_id,decisions_changed,fact_payload)
    values(v_uid,p_league_id,v_league.name,'nfl',p_season_key,v_league.current_week,'jdam','postseason','nfl-jdam-'||p_league_id||'-'||v_uid||'-'||p_season_key,13,jsonb_build_object('entry','final_thirteen'))
    on conflict(source_event_id) do nothing;
    insert into public.weapon_service_totals(user_id,jdams,total_authorizations) values(v_uid,1,1)
    on conflict(user_id) do update set jdams=public.weapon_service_totals.jdams+1,total_authorizations=public.weapon_service_totals.total_authorizations+1,updated_at=now();
  end if;
  return v_entry;
end;$function$;
revoke all on function public.save_nfl_postseason_bracket(uuid,integer,jsonb,boolean) from public,anon;
grant execute on function public.save_nfl_postseason_bracket(uuid,integer,jsonb,boolean) to authenticated;

create or replace function public.save_nfl_postseason_results(p_league_id uuid,p_season_key integer,p_winners jsonb)
returns public.nfl_postseason_results language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_uid uuid:=(select auth.uid()); v_row public.nfl_postseason_results; v_old jsonb:='{}'::jsonb; v_entry record; v_wc integer; v_div integer; v_conf integer; v_sb integer; v_total integer;
begin
  if not exists(select 1 from public.leagues l where l.id=p_league_id and l.sport_id='nfl' and l.commissioner_id=v_uid) then raise exception 'NFL commissioner authority required'; end if;
  if jsonb_typeof(p_winners)<>'object' or exists(select 1 from jsonb_object_keys(p_winners)k where k not in ('AFC-WC-2-7','AFC-WC-3-6','AFC-WC-4-5','NFC-WC-2-7','NFC-WC-3-6','NFC-WC-4-5','AFC-DIV-1','AFC-DIV-2','NFC-DIV-1','NFC-DIV-2','AFC-CONF','NFC-CONF','SUPER-BOWL')) then raise exception 'Invalid NFL result key'; end if;
  select winners into v_old from public.nfl_postseason_results where league_id=p_league_id and season_key=p_season_key;
  v_old:=coalesce(v_old,'{}'::jsonb);
  if exists(select 1 from jsonb_each_text(v_old)o where p_winners->>o.key is distinct from o.value) then raise exception 'Recorded NFL winners are permanent'; end if;
  insert into public.nfl_postseason_results(league_id,season_key,winners) values(p_league_id,p_season_key,p_winners)
  on conflict(league_id,season_key) do update set winners=excluded.winners,updated_at=now() returning * into v_row;
  if (select count(*) from jsonb_object_keys(p_winners))=13 then
    for v_entry in select e.*,m.total_points from public.nfl_postseason_entries e join public.memberships m on m.league_id=e.league_id and m.user_id=e.user_id where e.league_id=p_league_id and e.season_key=p_season_key loop
      select count(*)::integer into v_wc from jsonb_each_text(p_winners)r where r.key like '%-WC-%' and v_entry.picks->>r.key=r.value;
      select (count(*)*2)::integer into v_div from jsonb_each_text(p_winners)r where r.key like '%-DIV-%' and v_entry.picks->>r.key=r.value;
      select (count(*)*4)::integer into v_conf from jsonb_each_text(p_winners)r where r.key like '%-CONF' and v_entry.picks->>r.key=r.value;
      select (count(*)*8)::integer into v_sb from jsonb_each_text(p_winners)r where r.key='SUPER-BOWL' and v_entry.picks->>r.key=r.value;
      v_total:=v_wc+v_div+v_conf+v_sb;
      if not exists(select 1 from public.nfl_postseason_scorecards s where s.league_id=p_league_id and s.user_id=v_entry.user_id and s.season_key=p_season_key) then
        insert into public.nfl_postseason_scorecards values(p_league_id,v_entry.user_id,p_season_key,v_wc,v_div,v_conf,v_sb,v_total,v_entry.used_jdam,now());
        update public.memberships set total_points=total_points+v_total,weekly_points=array_append(weekly_points,v_total),weeks_played=weeks_played+1 where league_id=p_league_id and user_id=v_entry.user_id;
        update public.nfl_postseason_entries set score=v_total,updated_at=now() where league_id=p_league_id and user_id=v_entry.user_id and season_key=p_season_key;
      end if;
    end loop;
  end if;
  return v_row;
end;$function$;
revoke all on function public.save_nfl_postseason_results(uuid,integer,jsonb) from public,anon;
grant execute on function public.save_nfl_postseason_results(uuid,integer,jsonb) to authenticated;

create or replace function public.reset_league_season_guarded(p_league_id uuid,p_confirm_name text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_uid uuid:=(select auth.uid()); v_league public.leagues%rowtype; v_members integer; v_opening integer;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select * into v_league from public.leagues where id=p_league_id for update;
  if not found or v_league.commissioner_id<>v_uid then raise exception 'Commissioner authority required'; end if;
  if trim(coalesce(p_confirm_name,''))<>v_league.name then raise exception 'League name confirmation did not match'; end if;
  delete from public.nfl_postseason_results where league_id=p_league_id;
  delete from public.nfl_postseason_scorecards where league_id=p_league_id;
  delete from public.nfl_postseason_entries where league_id=p_league_id;
  delete from public.nfl_postseason_slates where league_id=p_league_id;
  delete from public.cfb_postseason_results where league_id=p_league_id;
  delete from public.cfb_postseason_entries where league_id=p_league_id;
  delete from public.cfb_postseason_slates where league_id=p_league_id;
  delete from public.crystal_ball_result where league_id=p_league_id;
  delete from public.crystal_ball_picks where league_id=p_league_id;
  delete from public.gazette_editions where league_id=p_league_id;
  delete from public.week_results where league_id=p_league_id;
  delete from public.picks where league_id=p_league_id;
  delete from public.week_cards where league_id=p_league_id;
  delete from public.announcements where league_id=p_league_id;
  update public.memberships set total_points=0,weekly_points='{}'::integer[],weeks_played=0,ats_correct=0,ats_total=0,current_streak=0,best_week=0,worst_week=0,perfect_weeks=0,best_bet_hits=0,best_bet_total=0,prop_hits=0,prop_total=0 where league_id=p_league_id;
  get diagnostics v_members=row_count;
  v_opening:=case when v_league.sport_id='nfl' then 1 else 0 end;
  update public.leagues set current_week=v_opening where id=p_league_id;
  return jsonb_build_object('ok',true,'membersKept',v_members,'week',v_opening,'preserved',jsonb_build_array('roster','trophies','achievements','ranks','locker room','weapon history'));
end;$function$;
revoke all on function public.reset_league_season_guarded(uuid,text) from public,anon;
grant execute on function public.reset_league_season_guarded(uuid,text) to authenticated;

commit;
