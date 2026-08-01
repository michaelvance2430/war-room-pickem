-- ============================================================
-- War Room PROD promote pack (safe-ish re-run)
-- Project: dorhjepugsjpmnuzdzck
-- Paste ALL into Supabase SQL Editor → Run once
-- Does NOT wipe leagues or delete human members
-- ============================================================


-- ############################################################
-- FILE: sport-id.sql
-- ############################################################

-- Multi-sport spine: every league has a sport pack id.
-- Run once in Supabase SQL Editor (dev project first; prod only when promoting).
-- Safe to re-run.

alter table public.leagues
  add column if not exists sport_id text not null default 'cfb';

alter table public.leagues
  add column if not exists sport_settings jsonb not null default '{}'::jsonb;

comment on column public.leagues.sport_id is
  'Sport pack id: cfb, nfl, nba, march_madness, nascar, mlb, soccer, soccer_wwc, â€¦';

comment on column public.leagues.sport_settings is
  'Pack-specific settings (competition, series, season year, week model).';

-- Existing leagues stay CFB
update public.leagues
set sport_id = 'cfb'
where sport_id is null or trim(sport_id) = '';

create index if not exists leagues_sport_id_idx
  on public.leagues (sport_id);



-- ############################################################
-- FILE: raise-max-season-weeks.sql
-- ############################################################

-- War Room: allow highest week through CFP Final (app week 18+)
-- Supabase â†’ SQL Editor â†’ paste ALL of this â†’ Run
-- Project must be the same as the app: dorhjepugsjpmnuzdzck

-- 1) Drop ANY check constraint on regular_season_weeks (name can vary)
do $$
declare
  r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    where n.nspname = 'public'
      and t.relname = 'leagues'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%regular_season_weeks%'
  loop
    execute format('alter table public.leagues drop constraint %I', r.conname);
    raise notice 'Dropped constraint: %', r.conname;
  end loop;
end $$;

-- 2) New limit: 4â€“24
alter table public.leagues
  add constraint leagues_regular_season_weeks_check
  check (regular_season_weeks between 4 and 24);

-- 3) Verify (you should see between 4 and 24)
select conname, pg_get_constraintdef(oid) as definition
from pg_constraint
where conrelid = 'public.leagues'::regclass
  and contype = 'c'
  and pg_get_constraintdef(oid) ilike '%regular_season_weeks%';



-- ############################################################
-- FILE: open-rooms.sql
-- ############################################################

-- Open rooms: public matchmaking lobby (fill one league at a time).
-- Run in Supabase SQL Editor on dev first.
-- Safe to re-run.

alter table public.leagues
  add column if not exists is_open boolean not null default false;

alter table public.leagues
  add column if not exists open_listed_at timestamptz;

comment on column public.leagues.is_open is
  'When true, room appears in Join open room lobby until full or host turns it off.';

comment on column public.leagues.open_listed_at is
  'When the room was listed as open (for FIFO fill order among equal seat counts).';

-- Prefer partially-filled open rooms so one team fills fast before the next
create index if not exists leagues_open_listed_idx
  on public.leagues (is_open, open_listed_at)
  where is_open = true;

-- Anyone signed in can see open rooms (existing leagues select already open to authenticated)
-- Hosts set is_open via league update policy (commissioner already can update their league)



-- ############################################################
-- FILE: platform-status.sql
-- ############################################################

-- War Room platform status (Founder Dashboard incident banner)
-- Run once in Supabase â†’ SQL Editor. Safe to re-run.

create table if not exists public.platform_status (
  id int primary key default 1 check (id = 1),
  incident_active boolean not null default false,
  incident_message text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid null
);

insert into public.platform_status (id, incident_active, incident_message)
values (1, false, '')
on conflict (id) do nothing;

alter table public.platform_status enable row level security;

-- Everyone (incl. anon) can read â€” banner must show before login too
drop policy if exists "platform_status_select_all" on public.platform_status;
create policy "platform_status_select_all"
  on public.platform_status for select
  to anon, authenticated
  using (true);

-- Authenticated can update the single row (Founder UI is creator-gated in app)
drop policy if exists "platform_status_update_auth" on public.platform_status;
create policy "platform_status_update_auth"
  on public.platform_status for update
  to authenticated
  using (id = 1)
  with check (id = 1);

-- No insert/delete from clients
drop policy if exists "platform_status_insert_none" on public.platform_status;
drop policy if exists "platform_status_delete_none" on public.platform_status;



-- ############################################################
-- FILE: locker-reactions.sql
-- ############################################################

-- ============================================================
-- Locker Room message reactions (react without a full reply)
-- Run once in Supabase SQL Editor (dev / when promoting).
-- Safe to re-run.
-- ============================================================

create table if not exists public.locker_message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.locker_messages (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null check (char_length(emoji) >= 1 and char_length(emoji) <= 16),
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);

create index if not exists locker_reactions_message_idx
  on public.locker_message_reactions (message_id);

create index if not exists locker_reactions_user_idx
  on public.locker_message_reactions (user_id);

alter table public.locker_message_reactions enable row level security;

-- Read: league members only
drop policy if exists "Members read locker reactions" on public.locker_message_reactions;
create policy "Members read locker reactions"
  on public.locker_message_reactions for select to authenticated
  using (
    exists (
      select 1
      from public.locker_messages lm
      join public.memberships m on m.league_id = lm.league_id
      where lm.id = locker_message_reactions.message_id
        and m.user_id = auth.uid()
    )
  );

-- Add reaction: own row, member of league, not bot, not muted
drop policy if exists "Members react locker" on public.locker_message_reactions;
create policy "Members react locker"
  on public.locker_message_reactions for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.locker_messages lm
      join public.memberships m on m.league_id = lm.league_id
      where lm.id = locker_message_reactions.message_id
        and m.user_id = auth.uid()
        and coalesce(m.is_bot, false) = false
        and coalesce(m.locker_muted, false) = false
    )
  );

-- Remove own reaction (toggle off)
drop policy if exists "Members remove own locker reaction" on public.locker_message_reactions;
create policy "Members remove own locker reaction"
  on public.locker_message_reactions for delete to authenticated
  using (user_id = auth.uid());

comment on table public.locker_message_reactions is
  'Emoji reactions on locker messages â€” laugh, fire, cuss energy without a full reply.';



-- ############################################################
-- FILE: sport-pool-polls.sql
-- ############################################################

-- Cross-sport player pool: "Want to play [sport]?" â†’ spin up a new league for the yeses.
-- Run once in Supabase SQL Editor (dev first). Safe to re-run.

create table if not exists public.sport_pool_polls (
  id uuid primary key default gen_random_uuid(),
  source_league_id uuid not null references public.leagues (id) on delete cascade,
  commissioner_id uuid not null references public.profiles (id) on delete cascade,
  target_sport_id text not null default 'nfl',
  proposed_name text not null default 'War Room',
  message text not null default '',
  status text not null default 'open'
    check (status in ('open', 'closed', 'spun_up')),
  created_league_id uuid references public.leagues (id) on delete set null,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create index if not exists sport_pool_polls_source_idx
  on public.sport_pool_polls (source_league_id, status);

create index if not exists sport_pool_polls_commish_idx
  on public.sport_pool_polls (commissioner_id, status);

create table if not exists public.sport_pool_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.sport_pool_polls (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  response text not null check (response in ('yes', 'no')),
  created_at timestamptz not null default now(),
  unique (poll_id, user_id)
);

create index if not exists sport_pool_votes_poll_idx
  on public.sport_pool_votes (poll_id);

alter table public.sport_pool_polls enable row level security;
alter table public.sport_pool_votes enable row level security;

-- Members of the source league can read open polls for that league
drop policy if exists "sport_pool_polls_select" on public.sport_pool_polls;
create policy "sport_pool_polls_select"
  on public.sport_pool_polls for select to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.league_id = sport_pool_polls.source_league_id
        and m.user_id = auth.uid()
    )
    or commissioner_id = auth.uid()
  );

-- Only commissioner of source league can insert polls
drop policy if exists "sport_pool_polls_insert" on public.sport_pool_polls;
create policy "sport_pool_polls_insert"
  on public.sport_pool_polls for insert to authenticated
  with check (
    commissioner_id = auth.uid()
    and exists (
      select 1 from public.leagues l
      where l.id = source_league_id
        and l.commissioner_id = auth.uid()
    )
  );

-- Commissioner can update their polls (close / spun_up)
drop policy if exists "sport_pool_polls_update" on public.sport_pool_polls;
create policy "sport_pool_polls_update"
  on public.sport_pool_polls for update to authenticated
  using (commissioner_id = auth.uid())
  with check (commissioner_id = auth.uid());

-- Members of source league can vote
drop policy if exists "sport_pool_votes_select" on public.sport_pool_votes;
create policy "sport_pool_votes_select"
  on public.sport_pool_votes for select to authenticated
  using (
    exists (
      select 1 from public.sport_pool_polls p
      join public.memberships m on m.league_id = p.source_league_id
      where p.id = sport_pool_votes.poll_id
        and m.user_id = auth.uid()
    )
    or user_id = auth.uid()
  );

drop policy if exists "sport_pool_votes_upsert" on public.sport_pool_votes;
create policy "sport_pool_votes_insert"
  on public.sport_pool_votes for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.sport_pool_polls p
      join public.memberships m on m.league_id = p.source_league_id
      where p.id = sport_pool_votes.poll_id
        and m.user_id = auth.uid()
        and p.status = 'open'
    )
  );

drop policy if exists "sport_pool_votes_update" on public.sport_pool_votes;
create policy "sport_pool_votes_update"
  on public.sport_pool_votes for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

comment on table public.sport_pool_polls is
  'Commissioner asks the current room if they want a new sport/league; yeses get spun up together.';



-- ############################################################
-- FILE: bot-crystal-ball.sql
-- ############################################################

-- ============================================================
-- Trial bots auto Crystal Ball / Super Bowl pride picks
-- Commissioner seeds picks AS bots (RLS blocks client insert for others).
-- Run once in Supabase â†’ SQL Editor â†’ Run
-- ============================================================

create or replace function public.seed_bot_crystal_ball_picks(
  p_league_id uuid,
  p_picks jsonb
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_item jsonb;
  v_bot uuid;
  v_team text;
  v_inserted int := 0;
  v_skipped int := 0;
begin
  if v_uid is null then
    return json_build_object('ok', false, 'error', 'Not authenticated');
  end if;

  if not exists (
    select 1 from public.leagues l
    where l.id = p_league_id and l.commissioner_id = v_uid
  ) then
    return json_build_object('ok', false, 'error', 'Commissioner only');
  end if;

  if p_picks is null or jsonb_typeof(p_picks) <> 'array' then
    return json_build_object('ok', false, 'error', 'p_picks must be a JSON array');
  end if;

  for v_item in select * from jsonb_array_elements(p_picks)
  loop
    begin
      v_bot := (v_item->>'user_id')::uuid;
    exception when others then
      v_skipped := v_skipped + 1;
      continue;
    end;

    v_team := trim(coalesce(v_item->>'team_name', ''));
    if v_team = '' or char_length(v_team) > 120 then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    if not exists (
      select 1 from public.memberships m
      where m.league_id = p_league_id
        and m.user_id = v_bot
        and m.is_bot = true
    ) then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    insert into public.crystal_ball_picks (league_id, user_id, team_name, picked_at)
    values (p_league_id, v_bot, v_team, now())
    on conflict (league_id, user_id) do update
      set team_name = excluded.team_name,
          picked_at = excluded.picked_at;

    v_inserted := v_inserted + 1;
  end loop;

  return json_build_object(
    'ok', true,
    'inserted', v_inserted,
    'skipped', v_skipped
  );
end;
$$;

revoke all on function public.seed_bot_crystal_ball_picks(uuid, jsonb) from public;
grant execute on function public.seed_bot_crystal_ball_picks(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';



-- ############################################################
-- FILE: bot-locker-sim.sql
-- ############################################################

-- ============================================================
-- Bot locker shit-talk (pre-season / sandbox demos)
-- Commissioner seeds posts AS trial bots so Locker badges/unseen work.
-- Run once in Supabase â†’ SQL Editor â†’ Run
-- ============================================================

create or replace function public.seed_bot_locker_talk(
  p_league_id uuid,
  p_posts jsonb
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_item jsonb;
  v_bot uuid;
  v_body text;
  v_mins int;
  v_created timestamptz;
  v_inserted int := 0;
  v_skipped int := 0;
begin
  if v_uid is null then
    return json_build_object('ok', false, 'error', 'Not authenticated');
  end if;

  if not exists (
    select 1 from public.leagues l
    where l.id = p_league_id and l.commissioner_id = v_uid
  ) then
    return json_build_object('ok', false, 'error', 'Commissioner only');
  end if;

  if p_posts is null or jsonb_typeof(p_posts) <> 'array' then
    return json_build_object('ok', false, 'error', 'p_posts must be a JSON array');
  end if;

  for v_item in select * from jsonb_array_elements(p_posts)
  loop
    begin
      v_bot := (v_item->>'user_id')::uuid;
    exception when others then
      v_skipped := v_skipped + 1;
      continue;
    end;

    v_body := trim(coalesce(v_item->>'body', ''));
    if v_body = '' or char_length(v_body) > 280 then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    -- Only post as trial bots in this league
    if not exists (
      select 1 from public.memberships m
      where m.league_id = p_league_id
        and m.user_id = v_bot
        and m.is_bot = true
    ) then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    v_mins := greatest(0, least(10000, coalesce((v_item->>'minutes_ago')::int, 0)));
    v_created := now() - (v_mins || ' minutes')::interval;

    insert into public.locker_messages (league_id, user_id, body, created_at)
    values (p_league_id, v_bot, v_body, v_created);

    v_inserted := v_inserted + 1;
  end loop;

  return json_build_object(
    'ok', true,
    'inserted', v_inserted,
    'skipped', v_skipped
  );
end;
$$;

revoke all on function public.seed_bot_locker_talk(uuid, jsonb) from public;
grant execute on function public.seed_bot_locker_talk(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';



-- ############################################################
-- FILE: bot-chaos-sim.sql
-- ############################################################

-- ============================================================
-- Sandbox: random trial bots go Chaos (nuclear) for a week
-- Commissioner-only. Safe to re-run.
-- Run once in Supabase SQL Editor (dev first).
-- ============================================================

-- Ensure column exists
alter table public.picks
  add column if not exists is_chaos boolean not null default false;

/**
 * After bots have locked picks for a week, randomly flip some to Chaos Mode.
 * Those picks score 2Ã— when the week is scored (same as human Chaos).
 *
 * p_chance: 0â€“100 (default 22 â‰ˆ 1 in 5 bots)
 * Returns how many went nuclear + sample names.
 */
create or replace function public.apply_random_bot_chaos(
  p_league_id uuid,
  p_week_number int,
  p_chance int default 22
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_chance int := greatest(0, least(100, coalesce(p_chance, 22)));
  v_bot record;
  v_pick_id uuid;
  v_nuked int := 0;
  v_names text[] := '{}';
  v_name text;
  v_roll int;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if not exists (
    select 1 from public.leagues l
    where l.id = p_league_id and l.commissioner_id = v_uid
  ) then
    raise exception 'Only the commissioner can apply bot chaos';
  end if;

  for v_bot in
    select m.user_id, coalesce(p.display_name, 'Bot') as display_name
    from public.memberships m
    join public.profiles p on p.id = m.user_id
    where m.league_id = p_league_id
      and m.is_bot = true
  loop
    select id into v_pick_id
    from public.picks
    where league_id = p_league_id
      and user_id = v_bot.user_id
      and week_number = p_week_number
      and locked_at is not null
    limit 1;

    if v_pick_id is null then
      continue;
    end if;

    -- Deterministic-ish roll per bot+week so re-runs aren't pure thrash
    v_roll := abs(hashtext(v_bot.user_id::text || ':chaos:' || p_week_number::text)) % 100;
    -- Mix in wall clock so re-fill can change who goes nuclear
    v_roll := (v_roll + (extract(epoch from now())::int % 17)) % 100;

    if v_roll < v_chance then
      update public.picks
      set is_chaos = true
      where id = v_pick_id;

      -- Pure-random sides for true Chaos energy (keep conf / best bet structure)
      update public.pick_games pg
      set side = case
        when (abs(hashtext(pg.id::text || ':side')) % 2) = 0 then 'home'
        else 'away'
      end
      where pg.pick_id = v_pick_id;

      v_nuked := v_nuked + 1;
      v_name := v_bot.display_name;
      if array_length(v_names, 1) is null or array_length(v_names, 1) < 8 then
        v_names := array_append(v_names, v_name);
      end if;
    else
      -- Explicit clear so re-seed without chaos doesn't leave stale flags
      update public.picks
      set is_chaos = false
      where id = v_pick_id
        and is_chaos = true;
    end if;
  end loop;

  return json_build_object(
    'ok', true,
    'chaosCount', v_nuked,
    'chance', v_chance,
    'names', v_names,
    'week', p_week_number
  );
end;
$$;

grant execute on function public.apply_random_bot_chaos(uuid, int, int) to authenticated;
grant execute on function public.apply_random_bot_chaos(uuid, int, int) to service_role;

comment on function public.apply_random_bot_chaos(uuid, int, int) is
  'Sandbox: randomly mark trial-bot locked picks as Chaos (2Ã— scoring) for a week.';



-- ############################################################
-- FILE: reset-season.sql
-- ############################################################

-- ============================================================
-- Reset season (keep members, wipe scores/picks/cards + pride picks)
-- Run once in Supabase â†’ SQL Editor â†’ Run (re-run after this update)
-- ============================================================

create or replace function public.reset_league_season(p_league_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_picks int := 0;
  v_cards int := 0;
  v_results int := 0;
  v_members int := 0;
  v_cb int := 0;
  v_ach int := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.leagues l
    where l.id = p_league_id
      and l.commissioner_id = v_uid
  ) then
    raise exception 'Only the commissioner can reset the season';
  end if;

  -- Picks (+ pick_games via cascade)
  delete from public.picks
  where league_id = p_league_id;
  get diagnostics v_picks = row_count;

  -- Week results (+ game_results via cascade)
  delete from public.week_results
  where league_id = p_league_id;
  get diagnostics v_results = row_count;

  -- Week cards (+ card_games via cascade)
  delete from public.week_cards
  where league_id = p_league_id;
  get diagnostics v_cards = row_count;

  -- Season chatter
  begin
    delete from public.announcements where league_id = p_league_id;
  exception when undefined_table then null;
  end;

  -- Gazette archive for this season
  begin
    delete from public.gazette_editions where league_id = p_league_id;
  exception when undefined_table then null;
  end;

  -- Crystal Ball / Super Bowl pride picks + crown + league achievements
  begin
    delete from public.crystal_ball_picks where league_id = p_league_id;
    get diagnostics v_cb = row_count;
  exception when undefined_table then null;
  end;
  begin
    delete from public.crystal_ball_result where league_id = p_league_id;
  exception when undefined_table then null;
  end;
  begin
    delete from public.achievements where league_id = p_league_id;
    get diagnostics v_ach = row_count;
  exception when undefined_table then null;
  end;

  -- Locker board for this league (trial noise)
  begin
    delete from public.locker_messages where league_id = p_league_id;
  exception when undefined_table then null;
  end;

  -- Zero every member's season stats â€” keep membership / division / role
  -- These feed profile "deep stats" (ATS, weeks played, streaks, legacy math).
  update public.memberships
  set
    total_points = 0,
    weekly_points = array[]::int[],
    ats_correct = 0,
    ats_total = 0,
    current_streak = 0,
    best_week = 0,
    worst_week = 0,
    perfect_weeks = 0,
    best_bet_hits = 0,
    best_bet_total = 0,
    prop_hits = 0,
    prop_total = 0,
    weeks_played = 0
  where league_id = p_league_id;
  get diagnostics v_members = row_count;

  -- Ready for first week (CFB 0 / app may bump NFL to 1 on client)
  update public.leagues
  set current_week = 0
  where id = p_league_id;

  return json_build_object(
    'ok', true,
    'membersKept', v_members,
    'picksDeleted', v_picks,
    'cardsDeleted', v_cards,
    'resultsDeleted', v_results,
    'crystalPicksDeleted', v_cb,
    'achievementsDeleted', v_ach
  );
end;
$$;

revoke all on function public.reset_league_season(uuid) from public;
grant execute on function public.reset_league_season(uuid) to authenticated;

notify pgrst, 'reload schema';


