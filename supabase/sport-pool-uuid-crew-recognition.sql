-- UUID-based Crew recognition for commissioner-created follow-on leagues.
-- Original human rosters are snapshotted per poll. Members who later join the
-- created league through the lobby count toward the same 65% Crew line.

create table if not exists public.sport_pool_origin_members (
  poll_id uuid not null references public.sport_pool_polls(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  captured_at timestamptz not null default now(),
  primary key (poll_id,user_id)
);

create index if not exists sport_pool_origin_members_user_poll_idx
  on public.sport_pool_origin_members(user_id,poll_id);

alter table public.sport_pool_origin_members enable row level security;
revoke all on table public.sport_pool_origin_members from public,anon,authenticated;

alter table public.sport_pool_polls add column if not exists crew_required int;
alter table public.sport_pool_polls add column if not exists crew_overlap_count int not null default 0;
alter table public.sport_pool_polls add column if not exists crew_qualified_at timestamptz;

create index if not exists sport_pool_polls_created_league_idx
  on public.sport_pool_polls(created_league_id)
  where created_league_id is not null;

insert into public.sport_pool_origin_members(poll_id,user_id)
select p.id,m.user_id
from public.sport_pool_polls p
join public.memberships m on m.league_id=p.source_league_id
where coalesce(m.is_bot,false)=false
on conflict (poll_id,user_id) do nothing;

update public.sport_pool_polls p
set crew_required=greatest(1,ceil(x.member_count*0.65)::int)
from (
  select poll_id,count(*)::int member_count
  from public.sport_pool_origin_members
  group by poll_id
) x
where p.id=x.poll_id and p.crew_required is null;

create or replace function private.refresh_sport_pool_crew(p_poll_id uuid)
returns void
language plpgsql
security definer
set search_path=pg_catalog
as $function$
declare
  v_poll public.sport_pool_polls%rowtype;
  v_origin int;
  v_required int;
  v_overlap int := 0;
begin
  select * into v_poll
  from public.sport_pool_polls
  where id=p_poll_id
  for update;
  if not found then return; end if;

  select count(*)::int into v_origin
  from public.sport_pool_origin_members
  where poll_id=p_poll_id;
  v_required := greatest(1,ceil(v_origin*0.65)::int);

  if v_poll.created_league_id is not null then
    select count(*)::int into v_overlap
    from public.sport_pool_origin_members o
    join public.memberships m
      on m.league_id=v_poll.created_league_id
     and m.user_id=o.user_id
     and coalesce(m.is_bot,false)=false
    where o.poll_id=p_poll_id;
  end if;

  update public.sport_pool_polls
  set crew_required=v_required,
      crew_overlap_count=v_overlap,
      crew_qualified_at=case
        when crew_qualified_at is not null then crew_qualified_at
        when v_overlap>=v_required then now()
        else null
      end
  where id=p_poll_id;
end;
$function$;

revoke all on function private.refresh_sport_pool_crew(uuid) from public,anon,authenticated;

create or replace function private.refresh_crews_after_membership_change()
returns trigger
language plpgsql
security definer
set search_path=pg_catalog
as $function$
declare
  v_league_id uuid;
  v_poll_id uuid;
begin
  if tg_op='DELETE' then v_league_id := old.league_id;
  else v_league_id := new.league_id;
  end if;
  for v_poll_id in
    select id from public.sport_pool_polls
    where created_league_id=v_league_id
    order by id
  loop
    perform private.refresh_sport_pool_crew(v_poll_id);
  end loop;
  if tg_op='DELETE' then return old;
  else return new;
  end if;
end;
$function$;

revoke all on function private.refresh_crews_after_membership_change() from public,anon,authenticated;

drop trigger if exists refresh_crews_after_membership_change on public.memberships;
create trigger refresh_crews_after_membership_change
after insert or delete on public.memberships
for each row execute function private.refresh_crews_after_membership_change();

create or replace function public.create_sport_pool_poll(
  p_source_league_id uuid,
  p_target_sport_id text,
  p_proposed_name text,
  p_message text default ''
) returns jsonb
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_poll public.sport_pool_polls%rowtype;
  v_eligible int;
  v_required int;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.leagues where id=p_source_league_id and commissioner_id=v_uid) then raise exception 'Commissioner authority required'; end if;
  if lower(trim(p_target_sport_id)) not in ('cfb','nfl') then raise exception 'Unsupported sport'; end if;
  if trim(coalesce(p_proposed_name,''))='' or char_length(trim(p_proposed_name))>80 then raise exception 'Enter a league name'; end if;

  update public.sport_pool_polls set status='closed',closed_at=coalesce(closed_at,now())
  where source_league_id=p_source_league_id and status='open' and expires_at<=now();
  if exists(select 1 from public.sport_pool_polls where source_league_id=p_source_league_id and status='open') then raise exception 'This league already has an active sport vote'; end if;

  insert into public.sport_pool_polls(source_league_id,commissioner_id,target_sport_id,proposed_name,message,status,expires_at)
  values(p_source_league_id,v_uid,lower(trim(p_target_sport_id)),trim(p_proposed_name),left(trim(coalesce(p_message,'')),280),'open',now()+interval '7 days')
  returning * into v_poll;

  insert into public.sport_pool_origin_members(poll_id,user_id)
  select v_poll.id,m.user_id from public.memberships m
  where m.league_id=p_source_league_id and coalesce(m.is_bot,false)=false;
  get diagnostics v_eligible=row_count;
  v_required := greatest(1,ceil(v_eligible*0.65)::int);
  update public.sport_pool_polls set crew_required=v_required where id=v_poll.id;

  return jsonb_build_object(
    'id',v_poll.id,'sourceLeagueId',v_poll.source_league_id,'targetSportId',v_poll.target_sport_id,
    'proposedName',v_poll.proposed_name,'message',v_poll.message,'status',v_poll.status,'createdAt',v_poll.created_at,
    'expiresAt',v_poll.expires_at,'yesCount',0,'noCount',0,'eligibleCount',v_eligible,'requiredYes',v_required,
    'myVote',null,'yesVoters','[]'::jsonb,'canLaunch',false,
    'crewOverlapCount',0,'crewRequired',v_required,'crewQualified',false
  );
end;
$function$;

create or replace function public.get_sport_pool_poll(p_source_league_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_poll public.sport_pool_polls%rowtype;
  v_commissioner boolean;
  v_eligible int;
  v_yes int;
  v_no int;
  v_required int;
begin
  if v_uid is null or not public.is_league_member(p_source_league_id) then raise exception 'League membership required'; end if;
  select * into v_poll from public.sport_pool_polls where source_league_id=p_source_league_id order by created_at desc limit 1;
  if not found then return null; end if;

  select exists(select 1 from public.leagues where id=p_source_league_id and commissioner_id=v_uid) into v_commissioner;
  select count(*)::int into v_eligible from public.sport_pool_origin_members where poll_id=v_poll.id;
  select count(*) filter(where response='yes')::int,count(*) filter(where response='no')::int
  into v_yes,v_no from public.sport_pool_votes where poll_id=v_poll.id;
  v_required := greatest(1,coalesce(v_poll.crew_required,ceil(v_eligible*0.65)::int));

  return jsonb_build_object(
    'id',v_poll.id,'sourceLeagueId',v_poll.source_league_id,'targetSportId',v_poll.target_sport_id,
    'proposedName',v_poll.proposed_name,'message',v_poll.message,
    'status',case when v_poll.status='open' and now()>=v_poll.expires_at then 'expired' else v_poll.status end,
    'createdAt',v_poll.created_at,'expiresAt',v_poll.expires_at,
    'yesCount',v_yes,'noCount',v_no,'eligibleCount',v_eligible,'requiredYes',v_required,
    'myVote',(select response from public.sport_pool_votes where poll_id=v_poll.id and user_id=v_uid),
    'yesVoters',case when v_commissioner then coalesce((
      select jsonb_agg(jsonb_build_object('userId',m.user_id,'name',coalesce(m.display_name_override,p.display_name,'Player')) order by coalesce(m.display_name_override,p.display_name,'Player'))
      from public.sport_pool_votes v
      join public.memberships m on m.league_id=v_poll.source_league_id and m.user_id=v.user_id
      left join public.profiles p on p.id=v.user_id
      where v.poll_id=v_poll.id and v.response='yes'
    ),'[]'::jsonb) else '[]'::jsonb end,
    'canLaunch',v_commissioner and v_poll.status='open',
    'createdLeagueId',v_poll.created_league_id,
    'crewOverlapCount',v_poll.crew_overlap_count,
    'crewRequired',v_required,
    'crewQualified',v_poll.crew_qualified_at is not null
  );
end;
$function$;

create or replace function public.launch_sport_pool_league(p_poll_id uuid) returns jsonb
language plpgsql security definer set search_path=public,pg_temp
as $function$
declare
  v_poll public.sport_pool_polls%rowtype;
  v_launch jsonb;
begin
  select * into v_poll from public.sport_pool_polls where id=p_poll_id for update;
  if not found then raise exception 'Vote not found'; end if;
  if v_poll.commissioner_id<>(select auth.uid()) then raise exception 'Commissioner authority required'; end if;
  if v_poll.status<>'open' then raise exception 'This vote is closed'; end if;

  v_launch := public.spin_up_sport_pool_league(p_poll_id)::jsonb;
  perform private.refresh_sport_pool_crew(p_poll_id);
  select * into v_poll from public.sport_pool_polls where id=p_poll_id;
  return v_launch || jsonb_build_object(
    'crew_overlap_count',v_poll.crew_overlap_count,
    'crew_required',v_poll.crew_required,
    'crew_qualified',v_poll.crew_qualified_at is not null
  );
end;
$function$;

revoke all on function public.create_sport_pool_poll(uuid,text,text,text) from public,anon;
revoke all on function public.get_sport_pool_poll(uuid) from public,anon;
revoke all on function public.launch_sport_pool_league(uuid) from public,anon;
grant execute on function public.create_sport_pool_poll(uuid,text,text,text),public.get_sport_pool_poll(uuid),public.launch_sport_pool_league(uuid) to authenticated;

do $function$
declare v_id uuid;
begin
  for v_id in select id from public.sport_pool_polls where created_league_id is not null order by id loop
    perform private.refresh_sport_pool_crew(v_id);
  end loop;
end;
$function$;

notify pgrst,'reload schema';
