-- ============================================================
-- Deputy commissioners — run picks / results when you're away
-- Run once in Supabase → SQL Editor → Run
-- (Safe after moderation.sql; re-runnable)
-- ============================================================

alter table public.memberships
  add column if not exists is_deputy boolean not null default false;

comment on column public.memberships.is_deputy is
  'Appointed by commissioner. Can build cards, score weeks, nudge picks. Cannot change league ownership, reset season, or appoint other deputies.';

-- Ops helper: true commissioner OR deputy
create or replace function public.is_league_ops(p_league_id uuid)
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
      and coalesce(m.is_deputy, false) = true
  );
$$;

revoke all on function public.is_league_ops(uuid) from public;
grant execute on function public.is_league_ops(uuid) to authenticated;

-- ---- RLS: week ops tables (commissioner OR deputy) ----

drop policy if exists "Commissioner manages week cards" on public.week_cards;
drop policy if exists "Ops manage week cards" on public.week_cards;
create policy "Ops manage week cards"
  on public.week_cards for all to authenticated
  using (public.is_league_ops(league_id))
  with check (public.is_league_ops(league_id));

drop policy if exists "Commissioner manages card games" on public.card_games;
drop policy if exists "Ops manage card games" on public.card_games;
create policy "Ops manage card games"
  on public.card_games for all to authenticated
  using (
    exists (
      select 1 from public.week_cards wc
      where wc.id = card_games.week_card_id
        and public.is_league_ops(wc.league_id)
    )
  )
  with check (
    exists (
      select 1 from public.week_cards wc
      where wc.id = week_card_id
        and public.is_league_ops(wc.league_id)
    )
  );

drop policy if exists "Commissioner manages week results" on public.week_results;
drop policy if exists "Ops manage week results" on public.week_results;
create policy "Ops manage week results"
  on public.week_results for all to authenticated
  using (public.is_league_ops(league_id))
  with check (public.is_league_ops(league_id));

drop policy if exists "Commissioner manages game results" on public.game_results;
drop policy if exists "Ops manage game results" on public.game_results;
create policy "Ops manage game results"
  on public.game_results for all to authenticated
  using (
    exists (
      select 1 from public.week_results wr
      where wr.id = game_results.week_result_id
        and public.is_league_ops(wr.league_id)
    )
  )
  with check (
    exists (
      select 1 from public.week_results wr
      where wr.id = week_result_id
        and public.is_league_ops(wr.league_id)
    )
  );

-- Active week + settings writes (client still gates full settings to commissioner)
drop policy if exists "Commissioner updates league" on public.leagues;
drop policy if exists "Ops update league" on public.leagues;
create policy "Ops update league"
  on public.leagues for update to authenticated
  using (public.is_league_ops(id))
  with check (public.is_league_ops(id));

-- Memberships: scoring updates totals (ops)
drop policy if exists "Commissioner updates memberships" on public.memberships;
drop policy if exists "Ops update memberships" on public.memberships;
create policy "Ops update memberships"
  on public.memberships for update to authenticated
  using (public.is_league_ops(league_id))
  with check (public.is_league_ops(league_id));

-- Pick privacy: ops can read all picks for scoring + who's-in board
drop policy if exists "Commissioner reads league picks" on public.picks;
drop policy if exists "Ops read league picks" on public.picks;
create policy "Ops read league picks"
  on public.picks for select to authenticated
  using (public.is_league_ops(league_id));

drop policy if exists "Commissioner reads league pick_games" on public.pick_games;
drop policy if exists "Ops read league pick_games" on public.pick_games;
create policy "Ops read league pick_games"
  on public.pick_games for select to authenticated
  using (
    exists (
      select 1 from public.picks p
      where p.id = pick_id and public.is_league_ops(p.league_id)
    )
  );

-- Ops may set total_points when scoring (not re-write someone else's slip)
drop policy if exists "Ops score picks" on public.picks;
create policy "Ops score picks"
  on public.picks for update to authenticated
  using (public.is_league_ops(league_id))
  with check (public.is_league_ops(league_id));

-- Nudge announcements
drop policy if exists "Commissioner manages announcements" on public.announcements;
drop policy if exists "Ops manage announcements" on public.announcements;
create policy "Ops manage announcements"
  on public.announcements for all to authenticated
  using (public.is_league_ops(league_id))
  with check (
    public.is_league_ops(league_id)
    and author_id = auth.uid()
  );

-- Gazette archive after scoring (table may not exist yet — ignore)
do $$
begin
  if to_regclass('public.gazette_editions') is not null then
    execute 'drop policy if exists "Commissioner writes gazette archive" on public.gazette_editions';
    execute 'drop policy if exists "Ops write gazette archive" on public.gazette_editions';
    execute $pol$
      create policy "Ops write gazette archive"
        on public.gazette_editions for all to authenticated
        using (public.is_league_ops(league_id))
        with check (public.is_league_ops(league_id))
    $pol$;
  end if;
end $$;

-- Drop old 4-arg signature so PostgREST has a single RPC
drop function if exists public.set_member_moderation(uuid, uuid, boolean, boolean);

-- Appoint deputies / mods / mute (commissioner for roles; staff for mute)
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

  -- Role-only updates (deputy/mod) are commissioner; mute is staff
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
    is_moderator = case
      when p_is_moderator is null then is_moderator
      else p_is_moderator
    end,
    locker_muted = case
      when p_locker_muted is null then locker_muted
      else p_locker_muted
    end,
    is_deputy = case
      when p_is_deputy is null then is_deputy
      else p_is_deputy
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
    ),
    'isDeputy', (
      select is_deputy from public.memberships
      where league_id = p_league_id and user_id = p_user_id
    )
  );
end;
$$;

revoke all on function public.set_member_moderation(uuid, uuid, boolean, boolean, boolean) from public;
grant execute on function public.set_member_moderation(uuid, uuid, boolean, boolean, boolean) to authenticated;

-- Roster includes deputy flag
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
  locker_muted boolean,
  is_deputy boolean
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
    coalesce(m.locker_muted, false) as locker_muted,
    coalesce(m.is_deputy, false) as is_deputy
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
