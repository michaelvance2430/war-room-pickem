-- ============================================================
-- Moderators + troll controls (Locker mute, mod delete posts)
-- Run once in Supabase → SQL Editor → Run
-- ============================================================

alter table public.memberships
  add column if not exists is_moderator boolean not null default false;

alter table public.memberships
  add column if not exists locker_muted boolean not null default false;

comment on column public.memberships.is_moderator is
  'Appointed by commissioner. Can mute locker + delete any locker posts. Cannot run full commissioner tools.';
comment on column public.memberships.locker_muted is
  'Muted players cannot post in Locker Room. Can still pick and view standings.';

-- Staff helper: commissioner or moderator in this league
create or replace function public.is_league_staff(p_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
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

revoke all on function public.is_league_staff(uuid) from public;
grant execute on function public.is_league_staff(uuid) to authenticated;

-- Locker: post only if not muted (and not a bot)
drop policy if exists "Members post locker" on public.locker_messages;
create policy "Members post locker"
  on public.locker_messages for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.memberships m
      where m.league_id = locker_messages.league_id
        and m.user_id = auth.uid()
        and coalesce(m.is_bot, false) = false
        and coalesce(m.locker_muted, false) = false
    )
    and char_length(trim(body)) >= 1
    and char_length(body) <= 280
  );

-- Locker: author, commissioner, or moderator can delete
drop policy if exists "Author or commish delete locker" on public.locker_messages;
drop policy if exists "Author or staff delete locker" on public.locker_messages;
create policy "Author or staff delete locker"
  on public.locker_messages for delete to authenticated
  using (
    user_id = auth.uid()
    or public.is_league_staff(locker_messages.league_id)
  );

-- Staff can update memberships for mute/mod flags (not themselves as sole path)
-- Prefer reusing commissioner remove; add update policy for staff on mute fields only via RPC

create or replace function public.set_member_moderation(
  p_league_id uuid,
  p_user_id uuid,
  p_is_moderator boolean default null,
  p_locker_muted boolean default null
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

  if not v_is_commish and not v_is_mod then
    raise exception 'Only the commissioner or a moderator can do that';
  end if;

  -- Only commissioner can appoint/remove moderators
  if p_is_moderator is not null and not v_is_commish then
    raise exception 'Only the commissioner can appoint moderators';
  end if;

  -- Cannot mute or demote the commissioner
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
    is_moderator = case
      when p_is_moderator is null then is_moderator
      else p_is_moderator
    end,
    locker_muted = case
      when p_locker_muted is null then locker_muted
      else p_locker_muted
    end
  where league_id = p_league_id and user_id = p_user_id;

  return json_build_object(
    'ok', true,
    'userId', p_user_id,
    'isModerator', (
      select is_moderator from public.memberships
      where league_id = p_league_id and user_id = p_user_id
    ),
    'lockerMuted', (
      select locker_muted from public.memberships
      where league_id = p_league_id and user_id = p_user_id
    )
  );
end;
$$;

revoke all on function public.set_member_moderation(uuid, uuid, boolean, boolean) from public;
grant execute on function public.set_member_moderation(uuid, uuid, boolean, boolean) to authenticated;

-- Roster RPC: include mod flags if function exists (recreate safe version)
create or replace function public.get_league_roster(p_league_id uuid)
returns table (
  membership_id uuid,
  user_id uuid,
  display_name text,
  avatar_url text,
  role text,
  division text,
  total_points int,
  is_bot boolean,
  is_moderator boolean,
  locker_muted boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id as membership_id,
    m.user_id,
    coalesce(p.display_name, 'Player') as display_name,
    p.avatar_url,
    m.role::text,
    m.division::text,
    m.total_points,
    coalesce(m.is_bot, false) as is_bot,
    coalesce(m.is_moderator, false) as is_moderator,
    coalesce(m.locker_muted, false) as locker_muted
  from public.memberships m
  left join public.profiles p on p.id = m.user_id
  where m.league_id = p_league_id
    and (
      exists (
        select 1 from public.memberships me
        where me.league_id = p_league_id and me.user_id = auth.uid()
      )
      or exists (
        select 1 from public.leagues l
        where l.id = p_league_id and l.commissioner_id = auth.uid()
      )
    )
  order by coalesce(m.is_bot, false), p.display_name nulls last;
$$;

grant execute on function public.get_league_roster(uuid) to authenticated;

-- Staff can kick non-commissioner members (picks cleanup included)
create or replace function public.staff_remove_member(
  p_league_id uuid,
  p_user_id uuid
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

  if not v_is_commish and not v_is_mod then
    raise exception 'Only the commissioner or a moderator can remove players';
  end if;

  if p_user_id = v_uid then
    raise exception 'Cannot remove yourself';
  end if;

  if exists (
    select 1 from public.leagues l
    where l.id = p_league_id and l.commissioner_id = p_user_id
  ) then
    raise exception 'Cannot remove the commissioner';
  end if;

  if not exists (
    select 1 from public.memberships m
    where m.league_id = p_league_id and m.user_id = p_user_id
  ) then
    raise exception 'Player is not in this league';
  end if;

  -- Ghost cleanup (security definer bypasses per-user pick RLS)
  delete from public.picks
  where league_id = p_league_id and user_id = p_user_id;

  begin
    delete from public.crystal_ball_picks
    where league_id = p_league_id and user_id = p_user_id;
  exception when undefined_table then
    null;
  end;

  delete from public.memberships
  where league_id = p_league_id and user_id = p_user_id;

  return json_build_object('ok', true, 'userId', p_user_id);
end;
$$;

revoke all on function public.staff_remove_member(uuid, uuid) from public;
grant execute on function public.staff_remove_member(uuid, uuid) to authenticated;

-- Also allow staff membership deletes via direct policy (fallback path)
drop policy if exists "Commissioner deletes memberships" on public.memberships;
drop policy if exists "Staff deletes memberships" on public.memberships;
create policy "Staff deletes memberships"
  on public.memberships for delete to authenticated
  using (
    public.is_league_staff(league_id)
    and user_id is distinct from auth.uid()
    and not exists (
      select 1 from public.leagues l
      where l.id = league_id and l.commissioner_id = memberships.user_id
    )
  );
