-- ============================================================
-- ONE-SHOT: mods + deputies (paste entire file → Run)
-- Fixes: columns, RPC, schema cache reload
-- ============================================================

-- 1) Columns
alter table public.memberships
  add column if not exists is_moderator boolean not null default false;
alter table public.memberships
  add column if not exists locker_muted boolean not null default false;
alter table public.memberships
  add column if not exists is_deputy boolean not null default false;

-- 2) Drop EVERY overload so PostgREST sees one clean RPC
drop function if exists public.set_member_moderation(uuid, uuid, boolean, boolean);
drop function if exists public.set_member_moderation(uuid, uuid, boolean, boolean, boolean);

-- 3) Single RPC: mute / mod / deputy
create or replace function public.set_member_moderation(
  p_league_id uuid,
  p_user_id uuid,
  p_is_moderator boolean default null,
  p_locker_muted boolean default null,
  p_is_deputy boolean default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_commish boolean;
  v_is_mod boolean;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_is_deputy is null and p_is_moderator is null and p_locker_muted is null then
    raise exception 'Nothing to update';
  end if;

  select exists (
    select 1 from public.leagues l
    where l.id = p_league_id and l.commissioner_id = v_uid
  ) into v_is_commish;

  select exists (
    select 1 from public.memberships m
    where m.league_id = p_league_id
      and m.user_id = v_uid
      and coalesce(m.is_moderator, false) = true
  ) into v_is_mod;

  if p_is_deputy is not null and not v_is_commish then
    raise exception 'Only the commissioner can appoint deputies';
  end if;
  if p_is_moderator is not null and not v_is_commish then
    raise exception 'Only the commissioner can appoint moderators';
  end if;
  if p_locker_muted is not null and not v_is_commish and not v_is_mod then
    raise exception 'Only the commissioner or a moderator can mute players';
  end if;
  if not v_is_commish and not v_is_mod then
    raise exception 'Only the commissioner or a moderator can do that';
  end if;

  if exists (
    select 1 from public.leagues l
    where l.id = p_league_id and l.commissioner_id = p_user_id
  ) then
    raise exception 'Cannot moderate the commissioner';
  end if;

  if not exists (
    select 1 from public.memberships m
    where m.league_id = p_league_id and m.user_id = p_user_id
  ) then
    raise exception 'Player is not in this league';
  end if;

  update public.memberships
  set
    is_moderator = case when p_is_moderator is null then is_moderator else p_is_moderator end,
    locker_muted = case when p_locker_muted is null then locker_muted else p_locker_muted end,
    is_deputy = case when p_is_deputy is null then is_deputy else p_is_deputy end
  where league_id = p_league_id and user_id = p_user_id;

  return json_build_object(
    'ok', true,
    'userId', p_user_id,
    'isModerator', (select is_moderator from public.memberships where league_id = p_league_id and user_id = p_user_id),
    'lockerMuted', (select locker_muted from public.memberships where league_id = p_league_id and user_id = p_user_id),
    'isDeputy', (select is_deputy from public.memberships where league_id = p_league_id and user_id = p_user_id)
  );
end;
$$;

grant execute on function public.set_member_moderation(uuid, uuid, boolean, boolean, boolean) to authenticated;

-- 4) Ops helpers (for cards/results when deputy is appointed)
create or replace function public.is_league_ops(p_league_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.leagues l
    where l.id = p_league_id and l.commissioner_id = auth.uid()
  )
  or exists (
    select 1 from public.memberships m
    where m.league_id = p_league_id
      and m.user_id = auth.uid()
      and coalesce(m.is_deputy, false) = true
  );
$$;
grant execute on function public.is_league_ops(uuid) to authenticated;

create or replace function public.is_league_staff(p_league_id uuid)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.leagues l
    where l.id = p_league_id and l.commissioner_id = auth.uid()
  )
  or exists (
    select 1 from public.memberships m
    where m.league_id = p_league_id
      and m.user_id = auth.uid()
      and coalesce(m.is_moderator, false) = true
  );
$$;
grant execute on function public.is_league_staff(uuid) to authenticated;

-- 5) Force API to see new function (critical)
notify pgrst, 'reload schema';

-- 6) Quick check — should return one row with 5-arg signature
select
  p.proname as function_name,
  pg_get_function_identity_arguments(p.oid) as args
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.proname = 'set_member_moderation';
