-- Fix commissioner approval of a private-room join request.
--
-- The self-service record_league_first_join RPC correctly rejects a
-- commissioner trying to record another user's first join. Admission is
-- already commissioner-authorized here, so stamp the permanent join record
-- atomically inside this security-definer function instead.

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
  v_first_joined_at timestamptz;
  v_reason text := nullif(trim(coalesce(p_denial_reason, '')), '');
begin
  if v_uid is null then raise exception 'lobby:not_authenticated'; end if;
  if v_reason is not null and char_length(v_reason) > 240 then raise exception 'lobby:reason_too_long'; end if;

  select * into v_request
  from public.league_join_requests
  where id = p_request_id
  for update;

  if not found or v_request.status <> 'pending' then raise exception 'lobby:not_found'; end if;

  select * into v_league
  from public.leagues
  where id = v_request.league_id
  for update;

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

  if not exists (
    select 1 from public.memberships
    where league_id = v_league.id and user_id = v_request.user_id
  ) then
    v_div := public.d1b_b_next_division(v_league.id);
    v_pts := public.d1b_b_fair_entry_points(v_league.id, v_request.user_id);

    insert into public.memberships (
      league_id, user_id, role, division, total_points, weeks_played,
      is_bot, is_deputy, is_moderator, locker_muted
    ) values (
      v_league.id, v_request.user_id, 'player', v_div, v_pts, 0,
      false, false, false, false
    );

    insert into public.league_first_joins (league_id, user_id, first_joined_at)
    values (v_league.id, v_request.user_id, now())
    on conflict (league_id, user_id) do nothing;

    select first_joined_at into v_first_joined_at
    from public.league_first_joins
    where league_id = v_league.id and user_id = v_request.user_id;

    update public.memberships
    set joined_at = v_first_joined_at
    where league_id = v_league.id
      and user_id = v_request.user_id
      and joined_at is distinct from v_first_joined_at;
  end if;

  update public.league_join_requests
  set status = 'approved', resolved_at = now(), resolved_by = v_uid, denial_reason = null
  where id = p_request_id;

  return json_build_object('ok', true, 'status', 'approved', 'request_count', v_request.request_count);
end;
$$;

revoke all on function public.review_private_room_join_with_reason(uuid, boolean, text) from public, anon;
grant execute on function public.review_private_room_join_with_reason(uuid, boolean, text) to authenticated;

comment on function public.review_private_room_join_with_reason(uuid, boolean, text) is
  'Commissioner approves or denies a pending request; approval atomically records the admitted user first join.';
