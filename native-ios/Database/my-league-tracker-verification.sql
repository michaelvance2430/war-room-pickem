begin;
do $test$
declare
  v_league uuid; v_user uuid; v_other uuid; v_sport text; v_closeout uuid;
  v_count integer; v_ended boolean; v_hidden boolean; v_blocked boolean := false;
begin
  select l.id, l.commissioner_id, l.sport_id into v_league,v_user,v_sport
  from public.leagues l
  where l.mode='foundry' and l.sport_id in ('cfb','nfl','ncaam','ncaaw')
    and exists(select 1 from public.week_cards c where c.league_id=l.id)
    and exists(select 1 from public.memberships m where m.league_id=l.id and m.user_id=l.commissioner_id)
  limit 1;
  if v_league is null then raise exception 'No isolated Foundry fixture available'; end if;
  select id into v_other from public.profiles where id<>v_user limit 1;
  perform set_config('request.jwt.claim.sub',v_user::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_user,'role','authenticated')::text,true);
  insert into public.league_season_closeouts(league_id,season_key,sport_id,readiness_version,national_champion,league_champion_id,toilet_bowl_champion_id,closed_by,league_champion_ids,toilet_bowl_champion_ids)
    values(v_league,2099,v_sport,'tracker-rollback-test','Tracker test',v_user,v_user,v_user,array[v_user],array[v_user])
    returning id into v_closeout;
  set local role authenticated;
  select season_ended into v_ended from public.get_my_league_tracker_settings() where league_id=v_league;
  if v_ended is distinct from true then raise exception 'Completed league was not removed'; end if;
  reset role;
  update public.league_season_closeouts set closed_at='1900-01-01' where id=v_closeout;
  set local role authenticated;
  select season_ended into v_ended from public.get_my_league_tracker_settings() where league_id=v_league;
  if v_ended is distinct from false then raise exception 'Fresh card did not restore returning league'; end if;
  insert into public.league_tracker_preferences(user_id,league_id,hidden) values(v_user,v_league,true)
    on conflict(user_id,league_id) do update set hidden=true;
  select hidden into v_hidden from public.get_my_league_tracker_settings() where league_id=v_league;
  if v_hidden is distinct from true then raise exception 'Hide preference did not persist'; end if;
  update public.league_tracker_preferences set hidden=false where user_id=v_user and league_id=v_league;
  select hidden into v_hidden from public.get_my_league_tracker_settings() where league_id=v_league;
  if v_hidden is distinct from false then raise exception 'Restore preference did not persist'; end if;
  perform set_config('request.jwt.claim.sub',v_other::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',v_other,'role','authenticated')::text,true);
  select count(*) into v_count from public.league_tracker_preferences where user_id=v_user;
  if v_count<>0 then raise exception 'Other player could read preferences'; end if;
  update public.league_tracker_preferences set hidden=true where user_id=v_user and league_id=v_league;
  get diagnostics v_count=row_count;
  if v_count<>0 then raise exception 'Other player could change preferences'; end if;
  begin
    insert into public.league_tracker_preferences(user_id,league_id,hidden) values(v_user,v_league,true);
  exception when insufficient_privilege then v_blocked:=true;
  end;
  if not v_blocked then raise exception 'Other player could insert preferences for owner'; end if;
  reset role;
end;$test$;
select 'PASS: official closeout, new-season card, hide, restore, owner-only read/write/insert. All fixture writes rolled back.' as verification;
rollback;
