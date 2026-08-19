-- War Room Lobby v1
-- Discoverable public/private rooms, private join requests, and Cheevo boards.

alter table public.leagues
  add column if not exists lobby_visibility text not null default 'hidden',
  add column if not exists accept_join_requests boolean not null default false;

do $$ begin
  alter table public.leagues
    add constraint leagues_lobby_visibility_check
    check (lobby_visibility in ('hidden', 'public', 'private'));
exception when duplicate_object then null;
end $$;

-- Existing production rooms enter the Lobby as visible/private. Nobody is
-- admitted automatically; the commissioner must approve each request.
update public.leagues
set lobby_visibility = 'private',
    accept_join_requests = true,
    is_open = false,
    open_listed_at = coalesce(open_listed_at, now())
where coalesce(mode::text, 'production') = 'production'
  and lobby_visibility = 'hidden';

create table if not exists public.league_join_requests (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'approved', 'denied', 'cancelled')),
  requested_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references auth.users(id) on delete set null,
  unique (league_id, user_id)
);

create index if not exists league_join_requests_league_status_idx
  on public.league_join_requests (league_id, status, requested_at);

alter table public.league_join_requests enable row level security;
revoke all on table public.league_join_requests from anon, authenticated;

create or replace function public.set_league_lobby_visibility(
  p_league_id uuid,
  p_visibility text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_visibility text := lower(trim(coalesce(p_visibility, '')));
begin
  if v_uid is null then raise exception 'lobby:not_authenticated'; end if;
  if v_visibility not in ('hidden', 'public', 'private') then
    raise exception 'lobby:invalid_visibility';
  end if;
  if not exists (
    select 1 from public.leagues l
    where l.id = p_league_id and l.commissioner_id = v_uid
  ) then
    raise exception 'lobby:not_authorized';
  end if;

  update public.leagues
  set lobby_visibility = v_visibility,
      accept_join_requests = (v_visibility = 'private'),
      is_open = (v_visibility = 'public'),
      open_listed_at = case when v_visibility in ('public', 'private') then now() else open_listed_at end
  where id = p_league_id;

  return json_build_object('ok', true, 'visibility', v_visibility);
end;
$$;

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

  insert into public.league_join_requests (league_id, user_id, status, requested_at, resolved_at, resolved_by)
  values (p_league_id, v_uid, 'pending', now(), null, null)
  on conflict (league_id, user_id) do update
    set status = 'pending', requested_at = now(), resolved_at = null, resolved_by = null;
  return json_build_object('ok', true, 'status', 'pending');
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
    select r.id, coalesce(nullif(trim(p.display_name), ''), 'Player') as game_handle,
           r.requested_at
    from public.league_join_requests r
    left join public.profiles p on p.id = r.user_id
    where r.league_id = p_league_id and r.status = 'pending'
  ) req;
  return json_build_object('ok', true, 'requests', v_rows);
end;
$$;

create or replace function public.review_private_room_join(
  p_request_id uuid,
  p_approve boolean
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
begin
  if v_uid is null then raise exception 'lobby:not_authenticated'; end if;
  select * into v_request from public.league_join_requests where id = p_request_id for update;
  if not found or v_request.status <> 'pending' then raise exception 'lobby:not_found'; end if;
  select * into v_league from public.leagues where id = v_request.league_id for update;
  if v_league.commissioner_id <> v_uid then raise exception 'lobby:not_authorized'; end if;

  if p_approve is not true then
    update public.league_join_requests set status = 'denied', resolved_at = now(), resolved_by = v_uid where id = p_request_id;
    return json_build_object('ok', true, 'status', 'denied');
  end if;
  if public.d1b_b_human_member_count(v_league.id) >= public.d1b_b_max_human_members(v_league.id) then
    raise exception 'lobby:league_full';
  end if;

  if not exists(select 1 from public.memberships where league_id = v_league.id and user_id = v_request.user_id) then
    v_div := public.d1b_b_next_division(v_league.id);
    v_pts := public.d1b_b_fair_entry_points(v_league.id, v_request.user_id);
    insert into public.memberships (league_id, user_id, role, division, total_points, weeks_played, is_bot, is_deputy, is_moderator, locker_muted)
    values (v_league.id, v_request.user_id, 'player', v_div, v_pts, 0, false, false, false, false);
    perform public.record_league_first_join(v_league.id, v_request.user_id);
  end if;
  update public.league_join_requests set status = 'approved', resolved_at = now(), resolved_by = v_uid where id = p_request_id;
  return json_build_object('ok', true, 'status', 'approved');
end;
$$;

create or replace function public.list_lobby_leaderboards()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_players json;
  v_crews json;
begin
  if v_uid is null then raise exception 'lobby:not_authenticated'; end if;

  with award_points as (
    select a.league_id, a.user_id, sum(case
      when a.code in ('hot_hand','clean_sheet','parlay_pilot','underdog_believer','volume_shooter','crew_midseason_loyal','crew_card_grinder','iron_lungs','clutch_gene','four_green_friday','sweep_adjacent','best_bet_banker','prop_prophet','underdog_spree','ten_week_tenant','full_conference','road_dog','home_cookin') then 25
      when a.code in ('lock_it_in','on_the_board','saturday_starter','green_light','gameday_ready','card_complete','prop_merchant','best_bet_marked','confidence_ladder','week_one_warrior','two_week_tour','double_digit_club','fifty_club','century_club','spread_survivor','rematch_ready') then 10 else 0 end)::int as points
    from public.achievements a group by a.league_id, a.user_id
  ), ranked as (
    select coalesce(nullif(trim(m.display_name_override), ''), nullif(trim(p.display_name), ''), 'Player') as game_handle,
           l.name as league_name,
           (coalesce(ap.points, 0) + case when nullif(trim(p.display_name), '') is not null then 10 else 0 end + case when nullif(trim(p.avatar_url), '') is not null then 10 else 0 end)::int as cheevo_points
    from public.memberships m
    join public.leagues l on l.id = m.league_id and coalesce(l.mode::text, 'production') = 'production'
    join public.profiles p on p.id = m.user_id and coalesce(p.account_state::text, 'active') = 'active' and p.deleted_at is null
    left join award_points ap on ap.league_id = m.league_id and ap.user_id = m.user_id
    where m.is_bot is false
    order by cheevo_points desc, game_handle
    limit 10
  )
  select coalesce(json_agg(row_to_json(ranked)), '[]'::json) into v_players from ranked;

  with award_points as (
    select a.league_id, a.user_id, sum(case
      when a.code in ('hot_hand','clean_sheet','parlay_pilot','underdog_believer','volume_shooter','crew_midseason_loyal','crew_card_grinder','iron_lungs','clutch_gene','four_green_friday','sweep_adjacent','best_bet_banker','prop_prophet','underdog_spree','ten_week_tenant','full_conference','road_dog','home_cookin') then 25
      when a.code in ('lock_it_in','on_the_board','saturday_starter','green_light','gameday_ready','card_complete','prop_merchant','best_bet_marked','confidence_ladder','week_one_warrior','two_week_tour','double_digit_club','fifty_club','century_club','spread_survivor','rematch_ready') then 10 else 0 end)::int as points
    from public.achievements a group by a.league_id, a.user_id
  ), scored as (
    select m.league_id, (coalesce(ap.points, 0) + case when nullif(trim(p.display_name), '') is not null then 10 else 0 end + case when nullif(trim(p.avatar_url), '') is not null then 10 else 0 end)::int as points
    from public.memberships m
    join public.leagues l on l.id = m.league_id and coalesce(l.mode::text, 'production') = 'production'
    join public.profiles p on p.id = m.user_id and coalesce(p.account_state::text, 'active') = 'active' and p.deleted_at is null
    left join award_points ap on ap.league_id = m.league_id and ap.user_id = m.user_id
    where m.is_bot is false
  ), ranked as (
    select l.name as crew_name, sum(s.points)::int as cheevo_points
    from scored s join public.leagues l on l.id = s.league_id
    group by s.league_id, l.name having sum(s.points) > 0
    order by cheevo_points desc, crew_name limit 10
  )
  select coalesce(json_agg(row_to_json(ranked)), '[]'::json) into v_crews from ranked;

  return json_build_object('ok', true, 'players', v_players, 'crews', v_crews, 'updated_at', now());
end;
$$;

revoke all on function public.set_league_lobby_visibility(uuid, text) from public, anon;
revoke all on function public.list_lobby_rooms(text, integer) from public, anon;
revoke all on function public.request_private_room_join(uuid) from public, anon;
revoke all on function public.list_private_room_join_requests(uuid) from public, anon;
revoke all on function public.review_private_room_join(uuid, boolean) from public, anon;
revoke all on function public.list_lobby_leaderboards() from public, anon;
grant execute on function public.set_league_lobby_visibility(uuid, text) to authenticated;
grant execute on function public.list_lobby_rooms(text, integer) to authenticated;
grant execute on function public.request_private_room_join(uuid) to authenticated;
grant execute on function public.list_private_room_join_requests(uuid) to authenticated;
grant execute on function public.review_private_room_join(uuid, boolean) to authenticated;
grant execute on function public.list_lobby_leaderboards() to authenticated;

comment on function public.list_lobby_rooms(text, integer) is 'Authenticated lobby discovery without emails, invite codes, or internal user ids.';
comment on function public.list_lobby_leaderboards() is 'Top Cheevo game handles and creative room/crew names; excludes bots, Foundry, and inactive accounts.';
