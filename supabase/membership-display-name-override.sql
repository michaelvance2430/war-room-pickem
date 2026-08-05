begin;

alter table public.memberships
  add column if not exists display_name_override text null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'memberships_display_name_override_len'
  ) then
    alter table public.memberships
      add constraint memberships_display_name_override_len
      check (
        display_name_override is null
        or char_length(btrim(display_name_override)) between 2 and 40
      );
  end if;
exception when others then
  null;
end $$;

create or replace function public.normalize_league_display_name(p_raw text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v text;
begin
  if p_raw is null then
    return null;
  end if;
  v := btrim(regexp_replace(p_raw, '\s+', ' ', 'g'));
  if v = '' then
    return null;
  end if;
  if char_length(v) < 2 then
    raise exception 'Name needs at least 2 characters.';
  end if;
  if char_length(v) > 40 then
    raise exception 'Keep it under 40 characters.';
  end if;
  return v;
end;
$$;

revoke all on function public.normalize_league_display_name(text) from public;
revoke all on function public.normalize_league_display_name(text) from anon;
grant execute on function public.normalize_league_display_name(text) to authenticated;

create or replace function public.set_my_league_display_name(
  p_league_id uuid,
  p_alias text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_norm text;
  v_account text;
  v_updated int := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_league_id is null then
    raise exception 'Missing league';
  end if;

  if not exists (
    select 1 from public.memberships m
    where m.league_id = p_league_id
      and m.user_id = v_uid
  ) then
    raise exception 'Not a member of this league';
  end if;

  v_norm := public.normalize_league_display_name(p_alias);

  select nullif(btrim(p.display_name), '') into v_account
  from public.profiles p
  where p.id = v_uid;

  if v_norm is not null
     and v_account is not null
     and lower(v_norm) = lower(v_account) then
    v_norm := null;
  end if;

  update public.memberships m
  set display_name_override = v_norm
  where m.league_id = p_league_id
    and m.user_id = v_uid;

  get diagnostics v_updated = row_count;

  return json_build_object(
    'ok', true,
    'league_id', p_league_id,
    'display_name_override', v_norm,
    'updated', v_updated
  );
end;
$$;

revoke all on function public.set_my_league_display_name(uuid, text) from public;
revoke all on function public.set_my_league_display_name(uuid, text) from anon;
grant execute on function public.set_my_league_display_name(uuid, text) to authenticated;

drop function if exists public.get_league_roster(uuid);

create function public.get_league_roster(p_league_id uuid)
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
  locker_muted boolean,
  is_deputy boolean,
  joined_at timestamptz,
  display_name_override text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id as membership_id,
    m.user_id,
    coalesce(
      nullif(btrim(m.display_name_override), ''),
      nullif(btrim(p.display_name), ''),
      'Player'
    ) as display_name,
    p.avatar_url,
    m.role::text,
    m.division::text,
    m.total_points,
    coalesce(m.is_bot, false) as is_bot,
    coalesce(m.is_moderator, false) as is_moderator,
    coalesce(m.locker_muted, false) as locker_muted,
    coalesce(m.is_deputy, false) as is_deputy,
    m.joined_at,
    m.display_name_override
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
  order by coalesce(m.is_bot, false), 3 nulls last;
$$;

revoke all on function public.get_league_roster(uuid) from public;
revoke all on function public.get_league_roster(uuid) from anon;
grant execute on function public.get_league_roster(uuid) to authenticated;

notify pgrst, 'reload schema';

commit;
