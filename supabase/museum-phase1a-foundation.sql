-- ============================================================
-- Museum Phase 1A Foundation — Fan Favorite Rivalry (schema only)
-- Run once in Supabase → SQL Editor → Run
--
-- Creates permanent event tables, allegiance snapshots, durable
-- final scores, RLS, security-definer RPCs, season-reset safety.
--
-- Does NOT insert any museum_events rows.
-- Does NOT enable Phase 1B generation.
-- ============================================================

-- ─── Helpers ─────────────────────────────────────────────────

create or replace function public.museum_is_league_ops(p_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.league_id = p_league_id
      and m.user_id = auth.uid()
      and (
        m.role = 'commissioner'
        or coalesce(m.is_deputy, false) = true
      )
  );
$$;

create or replace function public.museum_is_league_member(p_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.league_id = p_league_id
      and m.user_id = auth.uid()
  );
$$;

-- Production gate (server-side belt). Client also gates via isProductionMode.
-- Schemas vary: mode / is_test / settings columns may be absent.
create or replace function public.museum_league_is_production(p_league_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_row record;
  v_mode text;
  v_js jsonb;
begin
  if p_league_id is null then
    return false;
  end if;

  if not exists (select 1 from public.leagues l where l.id = p_league_id) then
    return false;
  end if;

  -- Prefer optional columns when present (dynamic to avoid hard schema deps)
  begin
    execute $q$
      select
        case when exists (
          select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'leagues' and column_name = 'mode'
        ) then (select nullif(trim(mode::text), '') from public.leagues where id = $1)
        else null end as mode,
        case when exists (
          select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'leagues' and column_name = 'is_test'
        ) then (select coalesce(is_test, false) from public.leagues where id = $1)
        else false end as is_test
    $q$ into v_row using p_league_id;

    v_mode := lower(coalesce(v_row.mode, ''));
    if v_mode in ('sandbox', 'foundry', 'demo', 'guest', 'simulation') then
      return false;
    end if;
    if coalesce(v_row.is_test, false) is true then
      return false;
    end if;
  exception when others then
    null;
  end;

  -- settings / sport_settings JSON flags when present
  begin
    execute $q$
      select coalesce(
        case when exists (
          select 1 from information_schema.columns
          where table_schema = 'public' and table_name = 'leagues' and column_name = 'settings'
        ) then (select to_jsonb(settings) from public.leagues where id = $1)
        else '{}'::jsonb end,
        '{}'::jsonb
      )
    $q$ into v_js using p_league_id;

    if coalesce((v_js->>'isTest')::boolean, false)
       or coalesce((v_js->>'is_test')::boolean, false) then
      return false;
    end if;
    if lower(coalesce(v_js->>'mode', '')) in (
      'sandbox', 'foundry', 'demo', 'guest', 'simulation'
    ) then
      return false;
    end if;
  exception when others then
    null;
  end;

  return true;
end;
$$;

-- ─── Durable final scores (survives season reset) ────────────
-- Chosen over extending game_results alone because:
--   * week_results/game_results are wiped on season reset
--   * Museum retry needs provider + team identity independent of card_games UUID
--   * game_results remains ATS-only (winner) — scoring behavior unchanged

create table if not exists public.game_final_scores (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null,
  sport_id text not null,
  season int not null check (season >= 2000 and season <= 2100),
  week_number int not null check (week_number >= 0 and week_number <= 30),
  week_result_id uuid null,
  week_card_id uuid null,
  card_game_id uuid null,
  provider_game_id text null,
  game_identity_key text not null,
  away_team_id text null,
  home_team_id text null,
  away_team_name_snapshot text not null,
  home_team_name_snapshot text not null,
  away_score int not null check (away_score >= 0 and away_score <= 200),
  home_score int not null check (home_score >= 0 and home_score <= 200),
  is_final boolean not null default true,
  completion_status text not null default 'final'
    check (completion_status in ('final', 'cancelled', 'postponed', 'abandoned', 'uncertain')),
  score_source text not null
    check (char_length(score_source) between 2 and 64),
  source_timestamp timestamptz null,
  finalized_at timestamptz not null default now(),
  -- null = unknown (default); true/false only when provider establishes OT
  overtime boolean null,
  -- Published-card context for Phase 1B (spread upset needs card favorite)
  card_favorite text null check (card_favorite is null or card_favorite in ('home', 'away')),
  card_spread numeric null,
  underdog_side text null check (underdog_side is null or underdog_side in ('home', 'away')),
  away_rank int null,
  home_rank int null,
  rank_source text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint game_final_scores_identity_unique
    unique (league_id, week_number, game_identity_key)
);

create index if not exists game_final_scores_league_week_idx
  on public.game_final_scores (league_id, week_number);

create index if not exists game_final_scores_provider_idx
  on public.game_final_scores (league_id, provider_game_id)
  where provider_game_id is not null;

comment on table public.game_final_scores is
  'Durable numeric finals for Museum retry. Written only via authorized scoring RPC. Survives season reset. ATS winner remains on game_results.';

-- Optional convenience columns on game_results (nullable; older rows stay null)
alter table public.game_results
  add column if not exists away_score int null,
  add column if not exists home_score int null,
  add column if not exists overtime boolean null,
  add column if not exists score_source text null,
  add column if not exists finalized_at timestamptz null;

-- ─── Allegiance snapshots ────────────────────────────────────

create table if not exists public.museum_allegiance_snapshots (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null,
  sport_id text not null,
  season int not null check (season >= 2000 and season <= 2100),
  week_number int not null check (week_number >= 0 and week_number <= 30),
  week_card_id uuid null,
  card_game_id uuid null,
  provider_game_id text null,
  game_identity_key text not null,
  away_team_id text not null,
  home_team_id text not null,
  away_team_name_snapshot text not null,
  home_team_name_snapshot text not null,
  user_id uuid null references public.profiles (id) on delete set null,
  display_name_snapshot text not null,
  favorite_team_id_snapshot text not null,
  represented_side text not null check (represented_side in ('home', 'away')),
  represented_team_id text not null,
  -- prelock = published/pre-first-kickoff (replaceable on legal republish)
  -- frozen  = immutable after first kickoff
  status text not null check (status in ('prelock', 'frozen')),
  snapshot_at timestamptz not null default now(),
  frozen_at timestamptz null,
  -- Card context preserved for Phase 1B templates
  card_favorite text null check (card_favorite is null or card_favorite in ('home', 'away')),
  card_spread numeric null,
  underdog_side text null check (underdog_side is null or underdog_side in ('home', 'away')),
  away_rank int null,
  home_rank int null,
  rank_source text null,
  created_at timestamptz not null default now(),
  constraint museum_allegiance_snapshots_frozen_ts
    check (
      (status = 'prelock' and frozen_at is null)
      or (status = 'frozen' and frozen_at is not null)
    )
);

-- One active row per user per game identity per week (status-aware)
create unique index if not exists museum_allegiance_prelock_uidx
  on public.museum_allegiance_snapshots (
    league_id, week_number, game_identity_key, user_id
  )
  where status = 'prelock' and user_id is not null;

create unique index if not exists museum_allegiance_frozen_uidx
  on public.museum_allegiance_snapshots (
    league_id, week_number, game_identity_key, user_id
  )
  where status = 'frozen' and user_id is not null;

create index if not exists museum_allegiance_league_week_idx
  on public.museum_allegiance_snapshots (league_id, week_number, status);

create index if not exists museum_allegiance_provider_idx
  on public.museum_allegiance_snapshots (league_id, provider_game_id)
  where provider_game_id is not null;

comment on table public.museum_allegiance_snapshots is
  'Fan-favorite allegiance frozen at card publish (prelock) then first kickoff (frozen). Never overwrite frozen rows.';

comment on column public.museum_allegiance_snapshots.status is
  'prelock = published before first kickoff (rebuildable). frozen = immutable after first kickoff. Do not call prelock "locked".';

-- ─── Permanent Museum events (Phase 1A empty) ────────────────

create table if not exists public.museum_events (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null,
  sport_id text not null,
  season int not null check (season >= 2000 and season <= 2100),
  week_number int not null check (week_number >= 0 and week_number <= 30),
  event_type text not null
    check (event_type in ('fan_favorite_rivalry')),
  source_card_id uuid null,
  source_card_game_id uuid null,
  source_provider_game_id text null,
  game_identity_key text not null,
  occurred_at timestamptz null,
  finalized_at timestamptz not null default now(),
  away_team_id text not null,
  home_team_id text not null,
  away_team_name_snapshot text not null,
  home_team_name_snapshot text not null,
  winning_team_id text null,
  losing_team_id text null,
  away_score int not null,
  home_score int not null,
  margin int not null,
  overtime boolean null,
  fact_payload jsonb not null default '{}'::jsonb,
  headline text not null default '',
  plaque text not null default '',
  humor_plaque text not null default '',
  template_key text not null default '',
  template_version int not null default 0,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);

-- One rivalry event per league + provider game
create unique index if not exists museum_events_provider_uidx
  on public.museum_events (league_id, event_type, source_provider_game_id)
  where source_provider_game_id is not null;

-- Fallback when provider id absent
create unique index if not exists museum_events_identity_uidx
  on public.museum_events (league_id, event_type, season, week_number, game_identity_key);

create index if not exists museum_events_league_week_idx
  on public.museum_events (league_id, week_number desc, created_at desc);

create index if not exists museum_events_league_type_idx
  on public.museum_events (league_id, event_type, finalized_at desc);

comment on table public.museum_events is
  'Permanent Museum history. Phase 1A creates schema only — no generation. Survives season reset. No ON DELETE CASCADE from leagues.';

create table if not exists public.museum_event_participants (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.museum_events (id) on delete cascade,
  user_id uuid null references public.profiles (id) on delete set null,
  display_name_snapshot text not null,
  favorite_team_id_snapshot text not null,
  represented_team_id text not null,
  pick_team_id text null,
  confidence int null check (confidence is null or (confidence between 1 and 5)),
  is_best_bet boolean not null default false,
  outcome text not null
    check (outcome in ('won', 'lost', 'push', 'no_pick')),
  created_at timestamptz not null default now()
);

create unique index if not exists museum_event_participants_user_uidx
  on public.museum_event_participants (event_id, user_id)
  where user_id is not null;

create index if not exists museum_event_participants_event_idx
  on public.museum_event_participants (event_id);

create index if not exists museum_event_participants_user_idx
  on public.museum_event_participants (user_id)
  where user_id is not null;

comment on table public.museum_event_participants is
  'Queryable historical participants for Museum events. user_id SET NULL on account delete; display_name_snapshot retained.';

-- ─── RLS ─────────────────────────────────────────────────────

alter table public.game_final_scores enable row level security;
alter table public.museum_allegiance_snapshots enable row level security;
alter table public.museum_events enable row level security;
alter table public.museum_event_participants enable row level security;

-- Members read own league only
drop policy if exists "Members read game final scores" on public.game_final_scores;
create policy "Members read game final scores"
  on public.game_final_scores for select to authenticated
  using (public.museum_is_league_member(league_id));

drop policy if exists "Members read allegiance snapshots" on public.museum_allegiance_snapshots;
create policy "Members read allegiance snapshots"
  on public.museum_allegiance_snapshots for select to authenticated
  using (public.museum_is_league_member(league_id));

drop policy if exists "Members read museum events" on public.museum_events;
create policy "Members read museum events"
  on public.museum_events for select to authenticated
  using (public.museum_is_league_member(league_id));

drop policy if exists "Members read museum event participants" on public.museum_event_participants;
create policy "Members read museum event participants"
  on public.museum_event_participants for select to authenticated
  using (
    exists (
      select 1
      from public.museum_events e
      where e.id = museum_event_participants.event_id
        and public.museum_is_league_member(e.league_id)
    )
  );

-- NO client insert/update/delete policies on permanent Museum tables.
-- Writes only via security definer functions below.

grant select on public.game_final_scores to authenticated;
grant select on public.museum_allegiance_snapshots to authenticated;
grant select on public.museum_events to authenticated;
grant select on public.museum_event_participants to authenticated;

-- ─── RPC: rebuild pre-lock allegiance snapshots ──────────────
-- Payload: jsonb array of games with resolved canonical team ids (client match),
-- re-validated server-side against profile_favorite_teams + memberships.

create or replace function public.museum_rebuild_allegiance_snapshots(
  p_league_id uuid,
  p_week_number int,
  p_season int,
  p_sport_id text,
  p_week_card_id uuid,
  p_games jsonb,
  p_first_kickoff_at timestamptz default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_frozen int := 0;
  v_inserted int := 0;
  v_should_freeze boolean := false;
  g jsonb;
  v_game_key text;
  v_provider text;
  v_away_id text;
  v_home_id text;
  v_away_name text;
  v_home_name text;
  v_card_game_id uuid;
  v_favorite text;
  v_spread numeric;
  v_underdog text;
  v_away_rank int;
  v_home_rank int;
  v_rank_source text;
  v_row_count int;
begin
  if p_league_id is null or p_week_number is null or p_season is null
     or p_sport_id is null or p_week_card_id is null then
    raise exception 'Missing required arguments';
  end if;

  -- Authenticated ops OR service_role (auto-publish cron)
  if coalesce(auth.role(), '') = 'service_role' then
    null; -- system path
  elsif v_uid is null then
    raise exception 'Not authenticated';
  elsif not public.museum_is_league_ops(p_league_id) then
    raise exception 'Not authorized for this league';
  end if;

  if not public.museum_league_is_production(p_league_id) then
    return json_build_object(
      'ok', true,
      'skipped', true,
      'reason', 'non_production_league',
      'inserted', 0,
      'frozen', false
    );
  end if;

  -- Frozen week: never rewrite
  select count(*)::int into v_frozen
  from public.museum_allegiance_snapshots s
  where s.league_id = p_league_id
    and s.week_number = p_week_number
    and s.status = 'frozen';

  if v_frozen > 0 then
    return json_build_object(
      'ok', true,
      'skipped', true,
      'reason', 'already_frozen',
      'inserted', 0,
      'frozen', true
    );
  end if;

  -- If first kickoff already passed, rebuild then freeze (late publish)
  if p_first_kickoff_at is not null and p_first_kickoff_at <= now() then
    v_should_freeze := true;
  end if;

  -- Replace all pre-lock snapshots for this week
  delete from public.museum_allegiance_snapshots
  where league_id = p_league_id
    and week_number = p_week_number
    and status = 'prelock';

  if p_games is null or jsonb_typeof(p_games) <> 'array' then
    return json_build_object(
      'ok', true,
      'inserted', 0,
      'frozen', false,
      'games', 0
    );
  end if;

  for g in select * from jsonb_array_elements(p_games)
  loop
    v_away_id := nullif(trim(g->>'away_team_id'), '');
    v_home_id := nullif(trim(g->>'home_team_id'), '');
    v_away_name := coalesce(nullif(trim(g->>'away_team_name'), ''), 'Away');
    v_home_name := coalesce(nullif(trim(g->>'home_team_name'), ''), 'Home');
    v_provider := nullif(trim(g->>'provider_game_id'), '');
    v_game_key := nullif(trim(g->>'game_identity_key'), '');
    begin
      v_card_game_id := nullif(g->>'card_game_id', '')::uuid;
    exception when others then
      v_card_game_id := null;
    end;
    v_favorite := nullif(trim(g->>'card_favorite'), '');
    if v_favorite is not null and v_favorite not in ('home', 'away') then
      v_favorite := null;
    end if;
    begin
      v_spread := nullif(g->>'card_spread', '')::numeric;
    exception when others then
      v_spread := null;
    end;
    if v_favorite = 'home' then
      v_underdog := 'away';
    elsif v_favorite = 'away' then
      v_underdog := 'home';
    else
      v_underdog := null;
    end if;
    begin
      v_away_rank := nullif(g->>'away_rank', '')::int;
      v_home_rank := nullif(g->>'home_rank', '')::int;
    exception when others then
      v_away_rank := null;
      v_home_rank := null;
    end;
    v_rank_source := nullif(trim(g->>'rank_source'), '');

    -- Require confident canonical both sides (client must send only confident matches)
    if v_away_id is null or v_home_id is null then
      continue;
    end if;
    if v_away_id = 'no-team' or v_home_id = 'no-team' then
      continue;
    end if;
    if v_game_key is null then
      v_game_key := coalesce(v_provider, v_away_id || '|' || v_home_id);
    end if;

    insert into public.museum_allegiance_snapshots (
      league_id, sport_id, season, week_number,
      week_card_id, card_game_id, provider_game_id, game_identity_key,
      away_team_id, home_team_id,
      away_team_name_snapshot, home_team_name_snapshot,
      user_id, display_name_snapshot, favorite_team_id_snapshot,
      represented_side, represented_team_id,
      status, snapshot_at, frozen_at,
      card_favorite, card_spread, underdog_side,
      away_rank, home_rank, rank_source
    )
    select
      p_league_id,
      trim(p_sport_id),
      p_season,
      p_week_number,
      p_week_card_id,
      v_card_game_id,
      v_provider,
      v_game_key,
      v_away_id,
      v_home_id,
      v_away_name,
      v_home_name,
      m.user_id,
      coalesce(nullif(trim(p.display_name), ''), 'Player'),
      f.team_id,
      case
        when f.team_id = v_away_id then 'away'
        else 'home'
      end,
      f.team_id,
      'prelock',
      now(),
      null,
      v_favorite,
      v_spread,
      v_underdog,
      v_away_rank,
      v_home_rank,
      v_rank_source
    from public.memberships m
    inner join public.profile_favorite_teams f
      on f.user_id = m.user_id
     and f.sport_id = trim(p_sport_id)
    left join public.profiles p on p.id = m.user_id
    where m.league_id = p_league_id
      and coalesce(m.is_bot, false) = false
      and f.team_id is not null
      and f.team_id <> 'no-team'
      and f.team_id in (v_away_id, v_home_id)
      -- Exclude guest-like ids if ever present as text
      and m.user_id::text not like 'guest-%'
      and m.user_id::text not like 'eyes-%';

    get diagnostics v_row_count = row_count;
    v_inserted := v_inserted + coalesce(v_row_count, 0);
  end loop;

  if v_should_freeze then
    update public.museum_allegiance_snapshots
    set status = 'frozen',
        frozen_at = now()
    where league_id = p_league_id
      and week_number = p_week_number
      and status = 'prelock';
  end if;

  return json_build_object(
    'ok', true,
    'inserted', v_inserted,
    'frozen', v_should_freeze,
    'games', jsonb_array_length(p_games)
  );
end;
$$;

revoke all on function public.museum_rebuild_allegiance_snapshots(uuid, int, int, text, uuid, jsonb, timestamptz) from public;
grant execute on function public.museum_rebuild_allegiance_snapshots(uuid, int, int, text, uuid, jsonb, timestamptz) to authenticated;

-- ─── RPC: freeze pre-lock snapshots after first kickoff ──────

create or replace function public.museum_freeze_allegiance_snapshots(
  p_league_id uuid,
  p_week_number int,
  p_first_kickoff_at timestamptz default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_updated int := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not public.museum_is_league_member(p_league_id) then
    raise exception 'Not authorized for this league';
  end if;

  -- Only freeze when first kickoff has actually passed
  if p_first_kickoff_at is not null and p_first_kickoff_at > now() then
    return json_build_object(
      'ok', true,
      'frozen', false,
      'reason', 'kickoff_not_reached',
      'updated', 0
    );
  end if;

  -- If no kickoff timestamp provided, allow freeze only when ops scores / explicit
  -- path passes null meaning "caller already verified lock" — require ops then.
  if p_first_kickoff_at is null and not public.museum_is_league_ops(p_league_id) then
    return json_build_object(
      'ok', true,
      'frozen', false,
      'reason', 'kickoff_required',
      'updated', 0
    );
  end if;

  update public.museum_allegiance_snapshots
  set status = 'frozen',
      frozen_at = now()
  where league_id = p_league_id
    and week_number = p_week_number
    and status = 'prelock';

  get diagnostics v_updated = row_count;

  return json_build_object(
    'ok', true,
    'frozen', v_updated > 0 or exists (
      select 1 from public.museum_allegiance_snapshots
      where league_id = p_league_id
        and week_number = p_week_number
        and status = 'frozen'
    ),
    'updated', v_updated
  );
end;
$$;

revoke all on function public.museum_freeze_allegiance_snapshots(uuid, int, timestamptz) from public;
grant execute on function public.museum_freeze_allegiance_snapshots(uuid, int, timestamptz) to authenticated;

-- ─── RPC: upsert durable final scores (scoring path only) ────

create or replace function public.museum_upsert_game_final_scores(
  p_league_id uuid,
  p_week_number int,
  p_season int,
  p_sport_id text,
  p_week_result_id uuid,
  p_week_card_id uuid,
  p_scores jsonb,
  p_score_source text default 'odds_api'
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_count int := 0;
  s jsonb;
  v_key text;
  v_away_score int;
  v_home_score int;
begin
  if coalesce(auth.role(), '') = 'service_role' then
    null;
  elsif v_uid is null then
    raise exception 'Not authenticated';
  elsif not public.museum_is_league_ops(p_league_id) then
    raise exception 'Not authorized for this league';
  end if;

  if p_scores is null or jsonb_typeof(p_scores) <> 'array' then
    return json_build_object('ok', true, 'upserted', 0);
  end if;

  for s in select * from jsonb_array_elements(p_scores)
  loop
    begin
      v_away_score := (s->>'away_score')::int;
      v_home_score := (s->>'home_score')::int;
    exception when others then
      continue;
    end;
    if v_away_score is null or v_home_score is null then
      continue;
    end if;
    if v_away_score < 0 or v_home_score < 0 then
      continue;
    end if;

    v_key := nullif(trim(s->>'game_identity_key'), '');
    if v_key is null then
      v_key := coalesce(
        nullif(trim(s->>'provider_game_id'), ''),
        nullif(trim(s->>'away_team_id'), '') || '|' || nullif(trim(s->>'home_team_id'), '')
      );
    end if;
    if v_key is null or v_key = '|' then
      continue;
    end if;

    insert into public.game_final_scores (
      league_id, sport_id, season, week_number,
      week_result_id, week_card_id, card_game_id,
      provider_game_id, game_identity_key,
      away_team_id, home_team_id,
      away_team_name_snapshot, home_team_name_snapshot,
      away_score, home_score,
      is_final, completion_status, score_source,
      source_timestamp, finalized_at, overtime,
      card_favorite, card_spread, underdog_side,
      away_rank, home_rank, rank_source,
      updated_at
    ) values (
      p_league_id,
      trim(p_sport_id),
      p_season,
      p_week_number,
      p_week_result_id,
      p_week_card_id,
      nullif(s->>'card_game_id', '')::uuid,
      nullif(trim(s->>'provider_game_id'), ''),
      v_key,
      nullif(trim(s->>'away_team_id'), ''),
      nullif(trim(s->>'home_team_id'), ''),
      coalesce(nullif(trim(s->>'away_team_name'), ''), 'Away'),
      coalesce(nullif(trim(s->>'home_team_name'), ''), 'Home'),
      v_away_score,
      v_home_score,
      true,
      'final',
      coalesce(nullif(trim(p_score_source), ''), 'scoring_path'),
      nullif(s->>'source_timestamp', '')::timestamptz,
      now(),
      -- Phase 1A: only store OT when explicitly provided; never invent
      case
        when s ? 'overtime' and jsonb_typeof(s->'overtime') = 'boolean'
          then (s->>'overtime')::boolean
        else null
      end,
      nullif(trim(s->>'card_favorite'), ''),
      nullif(s->>'card_spread', '')::numeric,
      nullif(trim(s->>'underdog_side'), ''),
      nullif(s->>'away_rank', '')::int,
      nullif(s->>'home_rank', '')::int,
      nullif(trim(s->>'rank_source'), ''),
      now()
    )
    on conflict (league_id, week_number, game_identity_key)
    do update set
      away_score = excluded.away_score,
      home_score = excluded.home_score,
      is_final = true,
      completion_status = 'final',
      score_source = excluded.score_source,
      source_timestamp = coalesce(excluded.source_timestamp, game_final_scores.source_timestamp),
      finalized_at = now(),
      overtime = coalesce(excluded.overtime, game_final_scores.overtime),
      week_result_id = coalesce(excluded.week_result_id, game_final_scores.week_result_id),
      week_card_id = coalesce(excluded.week_card_id, game_final_scores.week_card_id),
      card_game_id = coalesce(excluded.card_game_id, game_final_scores.card_game_id),
      provider_game_id = coalesce(excluded.provider_game_id, game_final_scores.provider_game_id),
      away_team_id = coalesce(excluded.away_team_id, game_final_scores.away_team_id),
      home_team_id = coalesce(excluded.home_team_id, game_final_scores.home_team_id),
      away_team_name_snapshot = excluded.away_team_name_snapshot,
      home_team_name_snapshot = excluded.home_team_name_snapshot,
      card_favorite = coalesce(excluded.card_favorite, game_final_scores.card_favorite),
      card_spread = coalesce(excluded.card_spread, game_final_scores.card_spread),
      underdog_side = coalesce(excluded.underdog_side, game_final_scores.underdog_side),
      away_rank = coalesce(excluded.away_rank, game_final_scores.away_rank),
      home_rank = coalesce(excluded.home_rank, game_final_scores.home_rank),
      rank_source = coalesce(excluded.rank_source, game_final_scores.rank_source),
      updated_at = now();

    v_count := v_count + 1;

    -- Best-effort mirror onto game_results when card_game_id present
    begin
      if nullif(s->>'card_game_id', '') is not null and p_week_result_id is not null then
        update public.game_results gr
        set
          away_score = v_away_score,
          home_score = v_home_score,
          overtime = case
            when s ? 'overtime' and jsonb_typeof(s->'overtime') = 'boolean'
              then (s->>'overtime')::boolean
            else gr.overtime
          end,
          score_source = coalesce(nullif(trim(p_score_source), ''), 'scoring_path'),
          finalized_at = now()
        where gr.week_result_id = p_week_result_id
          and gr.card_game_id = (s->>'card_game_id')::uuid;
      end if;
    exception when others then
      null; -- columns may not exist yet; durable table still holds truth
    end;
  end loop;

  return json_build_object('ok', true, 'upserted', v_count);
end;
$$;

revoke all on function public.museum_upsert_game_final_scores(uuid, int, int, text, uuid, uuid, jsonb, text) from public;
grant execute on function public.museum_upsert_game_final_scores(uuid, int, int, text, uuid, uuid, jsonb, text) to authenticated;

-- ─── RPC: museum event count (delete guard / verification) ───

create or replace function public.museum_league_event_count(p_league_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::int
  from public.museum_events e
  where e.league_id = p_league_id
    and (
      public.museum_is_league_member(p_league_id)
      or public.museum_is_league_ops(p_league_id)
    );
$$;

revoke all on function public.museum_league_event_count(uuid) from public;
grant execute on function public.museum_league_event_count(uuid) to authenticated;

-- ─── Season reset: do NOT wipe Museum permanence ─────────────
-- Patch reset_league_season to document preservation. If a newer
-- reset function exists, it must still skip museum_* and game_final_scores.

do $$
begin
  -- No-op deletes that make intent explicit if someone adds cascade later
  null;
end $$;

comment on table public.game_final_scores is
  'Durable numeric finals for Museum retry. NOT wiped by reset_league_season. Written only via museum_upsert_game_final_scores.';

comment on table public.museum_events is
  'Permanent Museum history. NOT wiped by reset_league_season. No client writes. Phase 1A inserts zero rows.';

comment on table public.museum_allegiance_snapshots is
  'Allegiance snapshots. Survive season reset so frozen history is not rewritten. Pre-lock rows for future weeks can still be managed by publish RPC.';

-- ─── Grants for helpers ──────────────────────────────────────

revoke all on function public.museum_is_league_ops(uuid) from public;
revoke all on function public.museum_is_league_member(uuid) from public;
revoke all on function public.museum_league_is_production(uuid) from public;
-- Keep helpers invokable by authenticated for RPC composition only
grant execute on function public.museum_is_league_ops(uuid) to authenticated;
grant execute on function public.museum_is_league_member(uuid) to authenticated;
grant execute on function public.museum_league_is_production(uuid) to authenticated;

notify pgrst, 'reload schema';
