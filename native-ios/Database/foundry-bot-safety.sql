-- Native Foundry safety gates installed on 2026-08-16.
-- The lab itself is league f0000000-0000-4000-8000-000000000001.
-- Saturday Situation Room is production and must never be marked foundry.

create or replace function public.score_foundry_week_atomic(
  p_league_id uuid, p_week_number integer, p_results jsonb, p_prop_result text
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare v_uid uuid:=auth.uid();
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not exists (
    select 1 from public.leagues l
    where l.id=p_league_id and l.mode='foundry' and l.commissioner_id=v_uid
  ) then raise exception 'Creator Foundry only'; end if;
  if exists (
    select 1 from public.memberships m
    where m.league_id=p_league_id and not m.is_bot and m.user_id<>v_uid
  ) then raise exception 'Human roster detected'; end if;
  if not exists (
    select 1 from public.memberships m where m.league_id=p_league_id and m.is_bot
  ) then raise exception 'Bot roster required'; end if;
  return public.score_league_week_atomic(p_league_id,p_week_number,p_results,p_prop_result);
end; $$;

revoke all on function public.score_foundry_week_atomic(uuid,integer,jsonb,text) from public,anon;
grant execute on function public.score_foundry_week_atomic(uuid,integer,jsonb,text) to authenticated;

create or replace function public.seed_bot_locker_talk(p_league_id uuid,p_posts jsonb)
returns json language plpgsql security definer set search_path=public,pg_temp as $$
declare
  v_uid uuid:=auth.uid(); v_item jsonb; v_bot uuid; v_body text;
  v_mins int; v_inserted int:=0; v_skipped int:=0;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not exists (
    select 1 from public.leagues l
    where l.id=p_league_id and l.commissioner_id=v_uid and l.mode='foundry'
  ) then raise exception 'Creator Foundry only'; end if;
  if exists (
    select 1 from public.memberships m
    where m.league_id=p_league_id and not m.is_bot and m.user_id<>v_uid
  ) then raise exception 'Human roster detected'; end if;
  if p_posts is null or jsonb_typeof(p_posts)<>'array' then raise exception 'Posts must be an array'; end if;
  for v_item in select * from jsonb_array_elements(p_posts) loop
    begin v_bot:=(v_item->>'user_id')::uuid;
    exception when others then v_skipped:=v_skipped+1; continue; end;
    v_body:=trim(coalesce(v_item->>'body',''));
    if v_body='' or char_length(v_body)>280 then v_skipped:=v_skipped+1; continue; end if;
    if not exists (
      select 1 from public.memberships m
      where m.league_id=p_league_id and m.user_id=v_bot and m.is_bot
    ) then v_skipped:=v_skipped+1; continue; end if;
    v_mins:=greatest(0,least(10000,coalesce((v_item->>'minutes_ago')::int,0)));
    insert into public.locker_messages(league_id,user_id,body,created_at)
    values(p_league_id,v_bot,v_body,now()-(v_mins||' minutes')::interval);
    v_inserted:=v_inserted+1;
  end loop;
  return json_build_object('ok',true,'inserted',v_inserted,'skipped',v_skipped);
end; $$;

revoke all on function public.seed_bot_locker_talk(uuid,jsonb) from public,anon;
grant execute on function public.seed_bot_locker_talk(uuid,jsonb) to authenticated;
