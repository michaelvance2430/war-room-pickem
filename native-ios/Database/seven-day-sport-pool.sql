-- Seven-day, member-only vote for carrying willing players into another sport.
alter table public.sport_pool_polls
  add column if not exists expires_at timestamptz;

update public.sport_pool_polls
set expires_at = created_at + interval '7 days'
where expires_at is null;

alter table public.sport_pool_polls
  alter column expires_at set default (now() + interval '7 days'),
  alter column expires_at set not null;

create unique index if not exists one_open_sport_pool_per_source
on public.sport_pool_polls(source_league_id)
where status = 'open';

create or replace function public.create_sport_pool_poll(
  p_source_league_id uuid,
  p_target_sport_id text,
  p_proposed_name text,
  p_message text default ''
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_uid uuid := (select auth.uid()); v_poll public.sport_pool_polls%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.leagues where id=p_source_league_id and commissioner_id=v_uid) then
    raise exception 'Commissioner authority required';
  end if;
  if lower(trim(p_target_sport_id)) not in ('cfb','nfl') then raise exception 'Unsupported sport'; end if;
  if trim(coalesce(p_proposed_name,''))='' or char_length(trim(p_proposed_name))>80 then raise exception 'Enter a league name'; end if;
  if exists(select 1 from public.sport_pool_polls where source_league_id=p_source_league_id and status='open') then
    raise exception 'This league already has an active sport vote';
  end if;
  insert into public.sport_pool_polls(source_league_id,commissioner_id,target_sport_id,proposed_name,message,status,expires_at)
  values(p_source_league_id,v_uid,lower(trim(p_target_sport_id)),trim(p_proposed_name),left(trim(coalesce(p_message,'')),280),'open',now()+interval '7 days')
  returning * into v_poll;
  return jsonb_build_object('id',v_poll.id,'sourceLeagueId',v_poll.source_league_id,'targetSportId',v_poll.target_sport_id,
    'proposedName',v_poll.proposed_name,'message',v_poll.message,'status',v_poll.status,'createdAt',v_poll.created_at,
    'expiresAt',v_poll.expires_at,'yesCount',0,'noCount',0,'myVote',null,'yesVoters','[]'::jsonb,'canLaunch',false);
end;$function$;

create or replace function public.vote_sport_pool(p_poll_id uuid,p_response text) returns jsonb
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_uid uuid := (select auth.uid()); v_poll public.sport_pool_polls%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select * into v_poll from public.sport_pool_polls where id=p_poll_id for update;
  if not found then raise exception 'Vote not found'; end if;
  if v_poll.status<>'open' or now()>=v_poll.expires_at then raise exception 'This vote is closed'; end if;
  if lower(trim(p_response)) not in ('yes','no') then raise exception 'Vote must be yes or no'; end if;
  if not public.is_league_member(v_poll.source_league_id) then raise exception 'League membership required'; end if;
  insert into public.sport_pool_votes(poll_id,user_id,response) values(p_poll_id,v_uid,lower(trim(p_response)))
  on conflict(poll_id,user_id) do update set response=excluded.response,created_at=now();
  return jsonb_build_object('ok',true,'pollId',v_poll.id,'myVote',lower(trim(p_response)));
end;$function$;

create or replace function public.get_sport_pool_poll(p_source_league_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_uid uuid := (select auth.uid()); v_poll public.sport_pool_polls%rowtype; v_commissioner boolean;
begin
  if v_uid is null or not public.is_league_member(p_source_league_id) then raise exception 'League membership required'; end if;
  select * into v_poll from public.sport_pool_polls where source_league_id=p_source_league_id order by created_at desc limit 1;
  if not found then return null; end if;
  select exists(select 1 from public.leagues where id=p_source_league_id and commissioner_id=v_uid) into v_commissioner;
  return jsonb_build_object('id',v_poll.id,'sourceLeagueId',v_poll.source_league_id,'targetSportId',v_poll.target_sport_id,
    'proposedName',v_poll.proposed_name,'message',v_poll.message,
    'status',case when v_poll.status='open' and now()>=v_poll.expires_at then 'expired' else v_poll.status end,
    'createdAt',v_poll.created_at,'expiresAt',v_poll.expires_at,
    'yesCount',(select count(*) from public.sport_pool_votes where poll_id=v_poll.id and response='yes'),
    'noCount',(select count(*) from public.sport_pool_votes where poll_id=v_poll.id and response='no'),
    'myVote',(select response from public.sport_pool_votes where poll_id=v_poll.id and user_id=v_uid),
    'yesVoters',case when v_commissioner then coalesce((select jsonb_agg(jsonb_build_object('userId',m.user_id,'name',coalesce(m.display_name_override,p.display_name,'Player')) order by coalesce(m.display_name_override,p.display_name,'Player')) from public.sport_pool_votes v join public.memberships m on m.league_id=v_poll.source_league_id and m.user_id=v.user_id left join public.profiles p on p.id=v.user_id where v.poll_id=v_poll.id and v.response='yes'),'[]'::jsonb) else '[]'::jsonb end,
    'canLaunch',v_commissioner and v_poll.status='open' and now()>=v_poll.expires_at,
    'createdLeagueId',v_poll.created_league_id);
end;$function$;

create or replace function public.launch_sport_pool_league(p_poll_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare v_poll public.sport_pool_polls%rowtype;
begin
  select * into v_poll from public.sport_pool_polls where id=p_poll_id;
  if not found then raise exception 'Vote not found'; end if;
  if v_poll.commissioner_id<>(select auth.uid()) then raise exception 'Commissioner authority required'; end if;
  if now()<v_poll.expires_at then raise exception 'The seven-day vote is still open'; end if;
  return public.spin_up_sport_pool_league(p_poll_id)::jsonb;
end;$function$;

revoke all on function public.create_sport_pool_poll(uuid,text,text,text) from public,anon;
revoke all on function public.vote_sport_pool(uuid,text) from public,anon;
revoke all on function public.get_sport_pool_poll(uuid) from public,anon;
revoke all on function public.launch_sport_pool_league(uuid) from public,anon;
revoke all on function public.spin_up_sport_pool_league(uuid) from public,anon,authenticated;
grant execute on function public.create_sport_pool_poll(uuid,text,text,text),public.vote_sport_pool(uuid,text),public.get_sport_pool_poll(uuid),public.launch_sport_pool_league(uuid) to authenticated;
