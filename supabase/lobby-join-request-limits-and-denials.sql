-- Lobby join-request hardening for native iOS Build 7.
-- Two attempts per player/league, commissioner denial notes, and player-visible status.

alter table public.league_join_requests
  add column if not exists request_count integer not null default 1,
  add column if not exists denial_reason text;

alter table public.league_join_requests
  drop constraint if exists league_join_requests_request_count_check;

alter table public.league_join_requests
  add constraint league_join_requests_request_count_check
  check (request_count between 1 and 2);

alter table public.league_join_requests
  drop constraint if exists league_join_requests_denial_reason_length_check;

alter table public.league_join_requests
  add constraint league_join_requests_denial_reason_length_check
  check (denial_reason is null or char_length(denial_reason) <= 240);

create or replace function public.list_lobby_rooms(
  p_sport_id text default null,
  p_limit integer default 60
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_sport text := nullif(lower(trim(coalesce(p_sport_id, ''))), '');
  v_limit int := least(greatest(coalesce(p_limit, 60), 1), 100);
  v_rows json;
begin
  if v_uid is null then raise exception 'lobby:not_authenticated'; end if;
  if v_sport = 'any' then v_sport := null; end if;

  select coalesce(json_agg(row_to_json(room_row) order by room_row.is_full, room_row.human_count desc, room_row.sort_ts), '[]'::json)
  into v_rows
  from (
    select
      l.id,
      l.name,
      l.sport_id,
      l.lobby_visibility as access_mode,
      public.d1b_b_human_member_count(l.id) as human_count,
      public.d1b_b_max_human_members(l.id) as max_human_members,
      greatest(public.d1b_b_max_human_members(l.id) - public.d1b_b_human_member_count(l.id), 0) as seats_left,
      public.d1b_b_human_member_count(l.id) >= public.d1b_b_max_human_members(l.id) as is_full,
      exists(select 1 from public.memberships m where m.league_id = l.id and m.user_id = v_uid) as is_member,
      (select r.status from public.league_join_requests r where r.league_id = l.id and r.user_id = v_uid) as request_status,
      (select r.request_count from public.league_join_requests r where r.league_id = l.id and r.user_id = v_uid) as request_count,
      (select r.denial_reason from public.league_join_requests r where r.league_id = l.id and r.user_id = v_uid and r.status = 'denied') as denial_reason,
      coalesce(l.open_listed_at, l.created_at) as sort_ts
    from public.leagues l
    where l.lobby_visibility in ('public', 'private')
      and coalesce(l.mode::text, 'production') = 'production'
      and (v_sport is null or l.sport_id = v_sport)
    limit v_limit
  ) room_row;

  return json_build_object('ok', true, 'rooms', v_rows);
end;
$$;

create or replace function public.request_private_room_join(p_league_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_league public.leagues%rowtype;
  v_request public.league_join_requests%rowtype;
begin
  if v_uid is null then raise exception 'lobby:not_authenticated'; end if;
  select * into v_league from public.leagues where id = p_league_id for update;
  if not found then raise exception 'lobby:not_found'; end if;
  if exists(select 1 from public.memberships where league_id = p_league_id and user_id = v_uid) then
    return json_build_object('ok', true, 'status', 'member');
  end if;
  if v_league.lobby_visibility <> 'private' or v_league.accept_join_requests is not true then
    raise exception 'lobby:not_requestable';
  end if;
  if public.d1b_b_human_member_count(p_league_id) >= public.d1b_b_max_human_members(p_league_id) then
    raise exception 'lobby:league_full';
  end if;

  select * into v_request
  from public.league_join_requests
  where league_id = p_league_id and user_id = v_uid
  for update;

  if found and v_request.status = 'pending' then
    return json_build_object('ok', true, 'status', 'pending', 'request_count', v_request.request_count);
  end if;
  if found and v_request.status = 'approved' then
    return json_build_object('ok', true, 'status', 'approved', 'request_count', v_request.request_count);
  end if;
  if found and v_request.request_count >= 2 then
    raise exception 'lobby:request_limit_reached';
  end if;

  insert into public.league_join_requests (
    league_id, user_id, status, requested_at, resolved_at, resolved_by, request_count, denial_reason
  ) values (
    p_league_id, v_uid, 'pending', now(), null, null, 1, null
  )
  on conflict (league_id, user_id) do update
    set status = 'pending',
        requested_at = now(),
        resolved_at = null,
        resolved_by = null,
        request_count = least(public.league_join_requests.request_count + 1, 2),
        denial_reason = null;

  select * into v_request
  from public.league_join_requests
  where league_id = p_league_id and user_id = v_uid;

  return json_build_object('ok', true, 'status', 'pending', 'request_count', v_request.request_count);
end;
$$;

create or replace function public.list_private_room_join_requests(p_league_id uuid)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_rows json;
begin
  if v_uid is null then raise exception 'lobby:not_authenticated'; end if;
  if not exists(select 1 from public.leagues where id = p_league_id and commissioner_id = v_uid) then
    raise exception 'lobby:not_authorized';
  end if;
  select coalesce(json_agg(row_to_json(req) order by req.requested_at), '[]'::json)
  into v_rows
  from (
    select r.id,
           coalesce(nullif(trim(p.display_name), ''), 'Player') as game_handle,
           r.requested_at,
           r.request_count
    from public.league_join_requests r
    left join public.profiles p on p.id = r.user_id
    where r.league_id = p_league_id and r.status = 'pending'
  ) req;
  return json_build_object('ok', true, 'requests', v_rows);
end;
$$;

create or replace function public.review_private_room_join_with_reason(
  p_request_id uuid,
  p_approve boolean,
  p_denial_reason text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_request public.league_join_requests%rowtype;
  v_league public.leagues%rowtype;
  v_div public.division;
  v_pts int;
  v_reason text := nullif(trim(coalesce(p_denial_reason, '')), '');
begin
  if v_uid is null then raise exception 'lobby:not_authenticated'; end if;
  if v_reason is not null and char_length(v_reason) > 240 then raise exception 'lobby:reason_too_long'; end if;

  select * into v_request from public.league_join_requests where id = p_request_id for update;
  if not found or v_request.status <> 'pending' then raise exception 'lobby:not_found'; end if;
  select * into v_league from public.leagues where id = v_request.league_id for update;
  if v_league.commissioner_id <> v_uid then raise exception 'lobby:not_authorized'; end if;

  if p_approve is not true then
    update public.league_join_requests
    set status = 'denied', resolved_at = now(), resolved_by = v_uid, denial_reason = v_reason
    where id = p_request_id;
    return json_build_object('ok', true, 'status', 'denied', 'request_count', v_request.request_count);
  end if;

  if public.d1b_b_human_member_count(v_league.id) >= public.d1b_b_max_human_members(v_league.id) then
    raise exception 'lobby:league_full';
  end if;

  if not exists(select 1 from public.memberships where league_id = v_league.id and user_id = v_request.user_id) then
    v_div := public.d1b_b_next_division(v_league.id);
    v_pts := public.d1b_b_fair_entry_points(v_league.id, v_request.user_id);
    insert into public.memberships (
      league_id, user_id, role, division, total_points, weeks_played,
      is_bot, is_deputy, is_moderator, locker_muted
    ) values (
      v_league.id, v_request.user_id, 'player', v_div, v_pts, 0,
      false, false, false, false
    );
    perform public.record_league_first_join(v_league.id, v_request.user_id);
  end if;

  update public.league_join_requests
  set status = 'approved', resolved_at = now(), resolved_by = v_uid, denial_reason = null
  where id = p_request_id;
  return json_build_object('ok', true, 'status', 'approved', 'request_count', v_request.request_count);
end;
$$;

revoke all on function public.review_private_room_join_with_reason(uuid, boolean, text) from public, anon;
grant execute on function public.review_private_room_join_with_reason(uuid, boolean, text) to authenticated;

comment on function public.request_private_room_join(uuid) is
  'Creates at most two private-room requests per user/league. Pending requests are idempotent.';
comment on function public.review_private_room_join_with_reason(uuid, boolean, text) is
  'Commissioner approves or denies a pending request; optional denial reason is visible only to the requester.';
