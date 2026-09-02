-- Build 20: opaque, reusable league invitations.
-- The bearer token is kept outside the exposed public schema. Public RPCs
-- reveal only the minimum invitation preview and retain join_league_by_code as
-- the single atomic membership authority.

create schema if not exists private;

create table if not exists private.league_invites (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default encode(gen_random_bytes(32), 'hex'),
  league_id uuid not null references public.leagues(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz null,
  revoked_at timestamptz null,
  last_used_at timestamptz null,
  use_count integer not null default 0 check (use_count >= 0)
);

create unique index if not exists league_invites_one_active_per_league
  on private.league_invites (league_id)
  where revoked_at is null;

revoke all on table private.league_invites from public, anon, authenticated;

create or replace function public.create_league_invite(p_league_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_invite private.league_invites%rowtype;
  v_code text;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;

  if not exists (
    select 1 from public.memberships m
    where m.league_id = p_league_id
      and m.user_id = v_uid
      and coalesce(m.is_bot, false) = false
  ) then
    raise exception using errcode = '42501', message = 'not_a_league_member';
  end if;

  select * into v_invite
  from private.league_invites i
  where i.league_id = p_league_id
    and i.revoked_at is null
    and (i.expires_at is null or i.expires_at > now())
  order by i.created_at desc
  limit 1;

  if not found then
    update private.league_invites
       set revoked_at = coalesce(revoked_at, now())
     where league_id = p_league_id and revoked_at is null;

    insert into private.league_invites (league_id, created_by)
    values (p_league_id, v_uid)
    on conflict (league_id) where revoked_at is null do nothing
    returning * into v_invite;

    -- A simultaneous first share may win the unique active-invite race.
    -- Reuse that committed row instead of surfacing a false failure.
    if not found then
      select * into v_invite
      from private.league_invites i
      where i.league_id = p_league_id
        and i.revoked_at is null
        and (i.expires_at is null or i.expires_at > now())
      order by i.created_at desc
      limit 1;
    end if;
  end if;

  select l.code into v_code from public.leagues l where l.id = p_league_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'league_not_found';
  end if;

  return jsonb_build_object(
    'ok', true,
    'token', v_invite.token,
    'code', v_code,
    'url', 'https://app.war-room-picks.com/invite/' || v_invite.token
  );
end;
$$;

create or replace function public.preview_league_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token text := lower(trim(coalesce(p_token, '')));
  v_invite private.league_invites%rowtype;
  v_league public.leagues%rowtype;
  v_members integer;
  v_commissioner text;
  v_uid uuid := auth.uid();
begin
  if v_token !~ '^[a-f0-9]{64}$' then
    return jsonb_build_object('ok', false, 'status', 'invalid');
  end if;

  select * into v_invite
  from private.league_invites i
  where i.token = v_token;

  if not found or v_invite.revoked_at is not null then
    return jsonb_build_object('ok', false, 'status', 'invalid');
  end if;
  if v_invite.expires_at is not null and v_invite.expires_at <= now() then
    return jsonb_build_object('ok', false, 'status', 'expired');
  end if;

  select * into v_league from public.leagues l where l.id = v_invite.league_id;
  if not found then
    return jsonb_build_object('ok', false, 'status', 'unavailable');
  end if;

  select count(*)::integer into v_members
  from public.memberships m
  where m.league_id = v_league.id and coalesce(m.is_bot, false) = false;

  select coalesce(nullif(trim(p.display_name), ''), 'Commissioner') into v_commissioner
  from public.profiles p where p.id = v_league.commissioner_id;

  return jsonb_build_object(
    'ok', true,
    'status', case when v_members >= v_league.max_human_members then 'full' else 'available' end,
    'league_id', v_league.id,
    'league_name', v_league.name,
    'sport_id', v_league.sport_id,
    'commissioner_name', coalesce(v_commissioner, 'Commissioner'),
    'member_count', v_members,
    'max_members', v_league.max_human_members,
    'code', v_league.code,
    'already_member', case when v_uid is null then false else exists (
      select 1 from public.memberships m
      where m.league_id = v_league.id and m.user_id = v_uid
    ) end
  );
end;
$$;

create or replace function public.join_league_by_invite(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_token text := lower(trim(coalesce(p_token, '')));
  v_invite private.league_invites%rowtype;
  v_code text;
  v_result jsonb;
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'not_authenticated';
  end if;
  if v_token !~ '^[a-f0-9]{64}$' then
    raise exception using errcode = '22023', message = 'invalid_invitation';
  end if;

  select * into v_invite
  from private.league_invites i
  where i.token = v_token
  for update;

  if not found or v_invite.revoked_at is not null then
    raise exception using errcode = '22023', message = 'invalid_invitation';
  end if;
  if v_invite.expires_at is not null and v_invite.expires_at <= now() then
    raise exception using errcode = '22023', message = 'expired_invitation';
  end if;

  select l.code into v_code from public.leagues l where l.id = v_invite.league_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'league_unavailable';
  end if;

  v_result := public.join_league_by_code(v_code)::jsonb;

  update private.league_invites
     set last_used_at = now(), use_count = use_count + 1
   where id = v_invite.id;

  return v_result;
end;
$$;

revoke all on function public.create_league_invite(uuid) from public, anon;
revoke all on function public.preview_league_invite(text) from public;
revoke all on function public.join_league_by_invite(text) from public, anon;
grant execute on function public.create_league_invite(uuid) to authenticated;
grant execute on function public.preview_league_invite(text) to anon, authenticated;
grant execute on function public.join_league_by_invite(text) to authenticated;

comment on function public.preview_league_invite(text) is
  'Returns only minimum public invitation identity and capacity; never roster, email, picks, chat, or standings.';

-- Global account achievement, stored once against the player's earliest room
-- because the existing achievements table requires a league_id. A database
-- trigger makes every client obey the same rule after avatar_url is durable.
create or replace function private.award_profile_photo_achievement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_league_id uuid;
begin
  if nullif(trim(new.avatar_url), '') is null then return new; end if;
  if exists (
    select 1 from public.achievements a
    where a.user_id = new.id and a.code = 'face_of_the_franchise'
  ) then return new; end if;

  select m.league_id into v_league_id
  from public.memberships m
  where m.user_id = new.id and coalesce(m.is_bot, false) = false
  order by m.joined_at, m.league_id
  limit 1;
  if v_league_id is null then return new; end if;

  insert into public.achievements (league_id, user_id, code, title, flavor)
  values (
    v_league_id,
    new.id,
    'face_of_the_franchise',
    'Face of the Franchise',
    'You uploaded a face to go with the takes. Accountability has never looked so well cropped.'
  )
  on conflict (league_id, user_id, code) do nothing;
  return new;
end;
$$;

drop trigger if exists profiles_award_photo_achievement on public.profiles;
create trigger profiles_award_photo_achievement
after insert or update of avatar_url on public.profiles
for each row execute function private.award_profile_photo_achievement();

revoke all on function private.award_profile_photo_achievement() from public, anon, authenticated;
