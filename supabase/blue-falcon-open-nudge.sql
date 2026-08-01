-- Blue Falcon Count + open-room nudge after early leave
-- Run once in Supabase → SQL Editor

-- Profiles: public quit counter
alter table public.profiles
  add column if not exists blue_falcon_count int not null default 0;

comment on column public.profiles.blue_falcon_count is
  'Times this account left a league before finishing the season (Blue Falcon Count).';

-- Leagues: commissioner prompt after someone leaves
alter table public.leagues
  add column if not exists open_room_nudge_pending boolean not null default false;

alter table public.leagues
  add column if not exists open_room_nudge_left_name text;

alter table public.leagues
  add column if not exists open_room_nudge_at timestamptz;

-- Anyone can read blue_falcon_count via existing profiles select policies.
-- Self-update blue falcon (also done by RPC below).
drop policy if exists "Users update own blue falcon" on public.profiles;
-- Prefer single update policy if one already exists for profiles;
-- grant via security definer instead to avoid policy fights.

create or replace function public.record_early_leave(
  p_league_id uuid,
  p_left_name text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_count int;
  v_name text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  -- Must still be a member when calling (leave flow calls this before delete)
  if not exists (
    select 1 from public.memberships m
    where m.league_id = p_league_id and m.user_id = v_uid
  ) then
    raise exception 'Not a member of this league';
  end if;

  select coalesce(display_name, 'A player') into v_name
  from public.profiles where id = v_uid;
  v_name := coalesce(nullif(trim(p_left_name), ''), v_name, 'A player');

  update public.profiles
  set blue_falcon_count = coalesce(blue_falcon_count, 0) + 1
  where id = v_uid
  returning blue_falcon_count into v_count;

  update public.leagues
  set
    open_room_nudge_pending = true,
    open_room_nudge_left_name = v_name,
    open_room_nudge_at = now()
  where id = p_league_id;

  return json_build_object(
    'ok', true,
    'blueFalconCount', coalesce(v_count, 1),
    'leftName', v_name
  );
end;
$$;

grant execute on function public.record_early_leave(uuid, text) to authenticated;

create or replace function public.flag_open_room_nudge(
  p_league_id uuid,
  p_left_name text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if not exists (
    select 1 from public.memberships m
    where m.league_id = p_league_id and m.user_id = v_uid
  ) then
    raise exception 'Not a member of this league';
  end if;

  select coalesce(display_name, 'A player') into v_name
  from public.profiles where id = v_uid;
  v_name := coalesce(nullif(trim(p_left_name), ''), v_name, 'A player');

  update public.leagues
  set
    open_room_nudge_pending = true,
    open_room_nudge_left_name = v_name,
    open_room_nudge_at = now()
  where id = p_league_id;

  return json_build_object('ok', true);
end;
$$;

grant execute on function public.flag_open_room_nudge(uuid, text) to authenticated;

-- Commish can clear nudge
create or replace function public.clear_open_room_nudge(p_league_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if not exists (
    select 1 from public.leagues l
    where l.id = p_league_id and l.commissioner_id = v_uid
  ) then
    raise exception 'Commissioner only';
  end if;

  update public.leagues
  set
    open_room_nudge_pending = false,
    open_room_nudge_left_name = null,
    open_room_nudge_at = null
  where id = p_league_id;

  return json_build_object('ok', true);
end;
$$;

grant execute on function public.clear_open_room_nudge(uuid) to authenticated;

notify pgrst, 'reload schema';
