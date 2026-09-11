-- Run through execute_sql against a database with shared-room fixture data.
-- No award, visit, or activity created by this regression test is committed.
begin;
-- Choose a real shared-room fixture, then roll back all test receipts.
select set_config('request.jwt.claims', (
  select jsonb_build_object('sub', p.id, 'role', 'authenticated')::text
  from public.profiles p where p.account_state = 'active'
    and not exists (select 1 from public.achievements a where a.user_id=p.id and a.code='profile_peeker')
    and (select count(distinct peer.user_id) from public.memberships own
      join public.memberships peer on peer.league_id=own.league_id
      where own.user_id=p.id and not coalesce(own.is_bot,false) and peer.user_id<>p.id) >= 2
  limit 1
), true);
set local role authenticated;
do $$
declare
  viewer uuid := auth.uid();
  target uuid;
  other_target uuid;
begin
  select peer.user_id into target from public.memberships own
  join public.memberships peer on peer.league_id=own.league_id
  where own.user_id=viewer and peer.user_id<>viewer and not coalesce(peer.is_bot,false)
  order by peer.user_id limit 1;
  if target is null then raise exception 'No shared-room fixture'; end if;
  insert into public.profile_visits(viewer_id,viewed_user_id) values(viewer,target) on conflict do nothing;
  if (select count(*) from public.achievements where user_id=viewer and code='profile_peeker')<>1
  then raise exception 'Profile visit failed to award'; end if;
  insert into public.profile_visits(viewer_id,viewed_user_id) values(viewer,target) on conflict do nothing;
  select peer.user_id into other_target from public.memberships own
  join public.memberships peer on peer.league_id=own.league_id
  where own.user_id=viewer and peer.user_id not in(viewer,target) order by peer.user_id limit 1;
  if other_target is not null then
    insert into public.profile_visits(viewer_id,viewed_user_id) values(viewer,other_target) on conflict do nothing;
  end if;
  if (select count(*) from public.achievements where user_id=viewer and code='profile_peeker')<>1
  then raise exception 'Repeat visits awarded duplicate points'; end if;
  begin
    insert into public.profile_visits(viewer_id,viewed_user_id) values(viewer,viewer);
    raise exception 'Self visit was accepted';
  exception when check_violation or insufficient_privilege then null; end;
  begin
    insert into public.profile_visits(viewer_id,viewed_user_id) values(target,viewer);
    raise exception 'Forged viewer was accepted';
  exception when insufficient_privilege then null; end;
  select p.id into other_target from public.profiles p where p.id<>viewer and not exists(
    select 1 from public.memberships own join public.memberships peer on own.league_id=peer.league_id
    where own.user_id=viewer and peer.user_id=p.id) limit 1;
  if other_target is null then raise exception 'No unrelated-profile fixture'; end if;
  begin
    insert into public.profile_visits(viewer_id,viewed_user_id) values(viewer,other_target);
    raise exception 'Unrelated profile was accepted';
  exception when insufficient_privilege then null; end;
end;
$$;
reset role;
rollback;
select 'PASS: authenticated profile visit awards once; repeat and multiple targets do not duplicate; self, forged viewer, and unrelated target rejected; all test writes rolled back' result;
