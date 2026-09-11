-- Activity Cheevos are career unlocks. Only durable, authorized activity awards
-- them; clients never choose an achievement code or a points value.
create or replace function private.award_engagement_cheevo(
  p_user_id uuid, p_league_id uuid, p_code text, p_earned_at timestamptz
) returns void language plpgsql security definer set search_path = '' as $$
declare
  v_title text;
  v_flavor text;
begin
  select title, flavor into v_title, v_flavor from (values
    ('knock_knock', 'Knock Knock', 'Submitted your first request to join a private room.'),
    ('crystal_gazed', 'Crystal Gazed', 'Made a Crystal Ball pick.'),
    ('locker_lurker', 'Locker Lurker', 'Posted in the Locker Room.'),
    ('profile_peeker', 'Profile Peeker', 'Opened another player''s profile.')
  ) as catalog(code, title, flavor) where code = p_code;
  if v_title is null then raise exception 'Unknown activity achievement'; end if;
  if not exists (select 1 from public.profiles where id = p_user_id and account_state = 'active')
     or exists (select 1 from public.memberships where user_id = p_user_id and league_id = p_league_id and is_bot is true)
  then return; end if;

  -- Serialize across leagues: two simultaneous actions still unlock only once.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_user_id::text || ':' || p_code, 0));
  if exists (select 1 from public.achievements where user_id = p_user_id and code = p_code) then return; end if;
  insert into public.achievements (league_id, user_id, code, title, flavor, earned_at)
  values (p_league_id, p_user_id, p_code, v_title, v_flavor, coalesce(p_earned_at, now()))
  on conflict (league_id, user_id, code) do nothing;
end;
$$;
revoke all on function private.award_engagement_cheevo(uuid, uuid, text, timestamptz) from public, anon, authenticated;

create or replace function private.award_saved_activity_cheevo()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'league_join_requests' then
    perform private.award_engagement_cheevo(new.user_id, new.league_id, 'knock_knock', new.requested_at);
  elsif tg_table_name = 'crystal_ball_picks' then
    if nullif(trim(new.team_name), '') is not null then
      perform private.award_engagement_cheevo(new.user_id, new.league_id, 'crystal_gazed', new.picked_at);
    end if;
  elsif tg_table_name = 'locker_messages' then
    if nullif(trim(new.body), '') is not null then
      perform private.award_engagement_cheevo(new.user_id, new.league_id, 'locker_lurker', new.created_at);
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.award_saved_activity_cheevo() from public, anon, authenticated;

create trigger award_join_request_cheevo after insert or update on public.league_join_requests
for each row execute function private.award_saved_activity_cheevo();
create trigger award_crystal_pick_cheevo after insert or update on public.crystal_ball_picks
for each row execute function private.award_saved_activity_cheevo();
create trigger award_locker_post_cheevo after insert on public.locker_messages
for each row execute function private.award_saved_activity_cheevo();

-- A pending private-room request earns Knock Knock before membership exists.
-- Owners must be able to read their own receipt in that room.
create policy "Players read own career achievements" on public.achievements
for select to authenticated using (user_id = (select auth.uid()));

-- Record only the first visit to a player, not a browsing history. The existing
-- memberships RLS plus this policy require a shared room and a real viewer.
create table public.profile_visits (
  viewer_id uuid not null references public.profiles(id) on delete cascade,
  viewed_user_id uuid not null references public.profiles(id) on delete cascade,
  visited_at timestamptz not null default now(),
  primary key (viewer_id, viewed_user_id),
  constraint profile_visits_other_player check (viewer_id <> viewed_user_id)
);
alter table public.profile_visits enable row level security;
revoke all on public.profile_visits from public, anon, authenticated;
grant select, insert on public.profile_visits to authenticated;
grant all on public.profile_visits to service_role;
create policy "Players read own profile visits" on public.profile_visits
for select to authenticated using (viewer_id = (select auth.uid()) and (select private.is_active_account()));
create policy "Players record shared-room profile visits" on public.profile_visits
for insert to authenticated with check (
  viewer_id = (select auth.uid()) and viewer_id <> viewed_user_id
  and (select private.is_active_account())
  and exists (
    select 1 from public.memberships viewer
    join public.memberships target on target.league_id = viewer.league_id
    where viewer.user_id = profile_visits.viewer_id and not coalesce(viewer.is_bot, false)
      and target.user_id = profile_visits.viewed_user_id
  )
);

create or replace function private.award_profile_visit_cheevo()
returns trigger language plpgsql security definer set search_path = '' as $$
declare v_league_id uuid;
begin
  -- Defense in depth even when inserted by trusted backend code.
  if new.viewer_id = new.viewed_user_id then return new; end if;
  select viewer.league_id into v_league_id
  from public.memberships viewer
  join public.memberships target on target.league_id = viewer.league_id
  where viewer.user_id = new.viewer_id and not coalesce(viewer.is_bot, false)
    and target.user_id = new.viewed_user_id
  order by viewer.joined_at, viewer.league_id limit 1;
  if v_league_id is not null then
    perform private.award_engagement_cheevo(new.viewer_id, v_league_id, 'profile_peeker', now());
  end if;
  return new;
end;
$$;
revoke all on function private.award_profile_visit_cheevo() from public, anon, authenticated;
create trigger award_profile_visit_cheevo after insert on public.profile_visits
for each row execute function private.award_profile_visit_cheevo();
create index profile_visits_viewed_user_id_idx on public.profile_visits(viewed_user_id);

-- Repair historical omissions from saved evidence. Do not infer profile visits.
do $$
declare receipt record;
begin
  for receipt in
    select distinct on (user_id, code) user_id, league_id, code, earned_at from (
      select user_id, league_id, 'knock_knock'::text code, requested_at earned_at from public.league_join_requests
      union all
      select user_id, league_id, 'crystal_gazed', picked_at from public.crystal_ball_picks where nullif(trim(team_name), '') is not null
      union all
      select user_id, league_id, 'locker_lurker', created_at from public.locker_messages where nullif(trim(body), '') is not null
    ) evidence order by user_id, code, earned_at, league_id
  loop
    perform private.award_engagement_cheevo(receipt.user_id, receipt.league_id, receipt.code, receipt.earned_at);
  end loop;
end;
$$;
