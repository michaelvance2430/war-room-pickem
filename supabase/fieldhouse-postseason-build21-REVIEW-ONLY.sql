-- BUILD 21 REVIEW ONLY. Do not apply until the production release gate is approved.
-- Durable NCAAM/NCAAW tournament authority for the 76-team Fieldhouse format.
-- One platform-owned official field feeds every league for a sport and season.

begin;

create table if not exists public.fieldhouse_tournaments (
  id uuid primary key default gen_random_uuid(),
  sport_id text not null check (sport_id in ('ncaam','ncaaw')),
  season_key integer not null check (season_key between 2026 and 2200),
  status text not null default 'draft' check (status in ('draft','published','in_progress','final')),
  team_count integer not null default 76 check (team_count = 76),
  decision_count integer not null default 75 check (decision_count = 75),
  first_tip_at timestamptz,
  published_at timestamptz,
  finalized_at timestamptz,
  odds_refresh_claimed_at timestamptz,
  odds_fetched_at timestamptz,
  created_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (sport_id, season_key)
);

create table if not exists public.fieldhouse_tournament_teams (
  tournament_id uuid not null references public.fieldhouse_tournaments(id) on delete cascade,
  team_id text not null,
  display_name text not null check (char_length(trim(display_name)) between 1 and 120),
  region text not null check (region in ('East','West','South','Midwest')),
  seed integer not null check (seed between 1 and 16),
  primary key (tournament_id, team_id)
);

create table if not exists public.fieldhouse_tournament_games (
  tournament_id uuid not null references public.fieldhouse_tournaments(id) on delete cascade,
  game_id text not null,
  round_key text not null check (round_key in ('opening','r64','r32','s16','e8','ff','title')),
  round_order integer not null check (round_order between 0 and 6),
  ordinal integer not null check (ordinal >= 0),
  region text check (region is null or region in ('East','West','South','Midwest')),
  first_team_id text,
  second_team_id text,
  first_source_game_id text,
  second_source_game_id text,
  odds_event_id text,
  first_moneyline integer,
  second_moneyline integer,
  odds_bookmaker text,
  odds_updated_at timestamptz,
  starts_at timestamptz,
  winner_team_id text,
  first_score integer,
  second_score integer,
  completed_at timestamptz,
  primary key (tournament_id, game_id),
  unique (tournament_id, round_key, ordinal),
  check ((first_team_id is not null) <> (first_source_game_id is not null)),
  check ((second_team_id is not null) <> (second_source_game_id is not null)),
  check ((winner_team_id is null) = (completed_at is null)),
  check ((winner_team_id is null) = (first_score is null)),
  check ((winner_team_id is null) = (second_score is null)),
  check (first_score is null or first_score >= 0),
  check (second_score is null or second_score >= 0)
);

alter table public.fieldhouse_tournaments
  add column if not exists odds_refresh_claimed_at timestamptz,
  add column if not exists odds_fetched_at timestamptz;
alter table public.fieldhouse_tournament_games
  add column if not exists first_moneyline integer,
  add column if not exists second_moneyline integer,
  add column if not exists odds_bookmaker text,
  add column if not exists odds_updated_at timestamptz;

create table if not exists public.fieldhouse_bracket_entries (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.fieldhouse_tournaments(id) on delete restrict,
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  picks jsonb not null default '{}'::jsonb check (jsonb_typeof(picks) = 'object'),
  submitted_at timestamptz,
  locked_at timestamptz,
  hellfire_used boolean not null default false,
  correct_picks integer not null default 0 check (correct_picks between 0 and 75),
  raw_points integer not null default 0 check (raw_points >= 0),
  adjusted_points integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, league_id, user_id)
);

create table if not exists public.fieldhouse_round_entries (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.fieldhouse_tournaments(id) on delete restrict,
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  round_key text not null check (round_key in ('opening','r64','r32','s16','e8','ff','title')),
  picks jsonb not null default '{}'::jsonb check (jsonb_typeof(picks) = 'object'),
  submitted_at timestamptz,
  locked_at timestamptz,
  points integer not null default 0 check (points >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tournament_id, league_id, user_id, round_key)
);

-- Public scoreboard facts live separately from private pick receipts. This is
-- the single total consumed by the home scorecard, standings, and awards.
create table if not exists public.fieldhouse_postseason_totals (
  tournament_id uuid not null references public.fieldhouse_tournaments(id) on delete cascade,
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  bracket_correct_picks integer not null default 0 check (bracket_correct_picks between 0 and 75),
  bracket_raw_points integer not null default 0 check (bracket_raw_points >= 0),
  bracket_adjusted_points integer not null default 0,
  round_points integer not null default 0 check (round_points >= 0),
  total_points integer generated always as (bracket_adjusted_points + round_points) stored,
  updated_at timestamptz not null default now(),
  primary key (tournament_id, league_id, user_id)
);

-- Selection Sunday freezes who is actually eligible for brass. Everybody may
-- keep picking and earning points, but a later standings change can never move
-- a player into or out of the Championship or Toilet Bowl field.
create table if not exists public.fieldhouse_postseason_qualifiers (
  tournament_id uuid not null references public.fieldhouse_tournaments(id) on delete restrict,
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  fieldhouse_region text not null check (fieldhouse_region in ('East','West','South','Midwest')),
  path text not null check (path in ('championship','toilet_bowl','no_brass')),
  regular_rank integer not null check (regular_rank > 0),
  regular_points integer not null,
  frozen_at timestamptz not null default now(),
  primary key (tournament_id, league_id, user_id)
);

create table if not exists public.fieldhouse_postseason_awards (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.fieldhouse_tournaments(id) on delete restrict,
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete restrict,
  award_key text not null check (award_key in ('league_champion','regional_champion','toilet_champion')),
  player_region text check (player_region is null or player_region in ('East','West','South','Midwest')),
  trophy_id text not null,
  total_points integer not null,
  awarded_at timestamptz not null default now()
);
alter table public.fieldhouse_postseason_awards
  drop constraint if exists fieldhouse_postseason_awards_award_key_check;
alter table public.fieldhouse_postseason_awards
  add constraint fieldhouse_postseason_awards_award_key_check
  check (award_key in ('league_champion','regional_champion','toilet_champion'));

-- One platform field serves every league, so tournament odds are claimed once
-- per sport rather than once per league. A 12-hour floor caps the provider at
-- two informational moneyline pulls per tournament day, and the worker makes
-- no odds request unless at least one eligible game has not tipped.
create or replace function public.claim_fieldhouse_tournament_odds_refresh(
  p_tournament_id uuid,
  p_min_age_seconds integer default 43200
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed boolean := false;
begin
  update public.fieldhouse_tournaments
  set odds_refresh_claimed_at=clock_timestamp()
  where id=p_tournament_id
    and status in ('published','in_progress')
    and (
      odds_refresh_claimed_at is null
      or odds_refresh_claimed_at < clock_timestamp()-make_interval(secs=>greatest(43200,p_min_age_seconds))
    )
  returning true into claimed;
  return coalesce(claimed,false);
end;
$$;
revoke all on function public.claim_fieldhouse_tournament_odds_refresh(uuid,integer) from public,anon,authenticated;
grant execute on function public.claim_fieldhouse_tournament_odds_refresh(uuid,integer) to service_role;

create index if not exists fieldhouse_games_event_idx
  on public.fieldhouse_tournament_games (odds_event_id) where odds_event_id is not null;
create index if not exists fieldhouse_brackets_league_idx
  on public.fieldhouse_bracket_entries (league_id, tournament_id);
create index if not exists fieldhouse_round_entries_league_idx
  on public.fieldhouse_round_entries (league_id, tournament_id, round_key);
create index if not exists fieldhouse_postseason_totals_leaderboard_idx
  on public.fieldhouse_postseason_totals (tournament_id, league_id, total_points desc, user_id);
create index if not exists fieldhouse_postseason_qualifiers_path_idx
  on public.fieldhouse_postseason_qualifiers (tournament_id, league_id, path, fieldhouse_region, regular_rank);
create unique index if not exists fieldhouse_one_league_champion_idx
  on public.fieldhouse_postseason_awards(tournament_id,league_id,award_key)
  where award_key='league_champion';
create unique index if not exists fieldhouse_one_regional_champion_idx
  on public.fieldhouse_postseason_awards(tournament_id,league_id,award_key,player_region)
  where award_key='regional_champion';
create unique index if not exists fieldhouse_one_toilet_champion_idx
  on public.fieldhouse_postseason_awards(tournament_id,league_id,award_key)
  where award_key='toilet_champion';

alter table public.fieldhouse_tournaments enable row level security;
alter table public.fieldhouse_tournament_teams enable row level security;
alter table public.fieldhouse_tournament_games enable row level security;
alter table public.fieldhouse_bracket_entries enable row level security;
alter table public.fieldhouse_round_entries enable row level security;
alter table public.fieldhouse_postseason_totals enable row level security;
alter table public.fieldhouse_postseason_qualifiers enable row level security;
alter table public.fieldhouse_postseason_awards enable row level security;

-- Published fields are universal public game facts. Draft fields remain service-only.
create policy "Authenticated read published Fieldhouse tournaments"
  on public.fieldhouse_tournaments for select to authenticated
  using (status <> 'draft');
create policy "Authenticated read published Fieldhouse teams"
  on public.fieldhouse_tournament_teams for select to authenticated
  using (exists (
    select 1 from public.fieldhouse_tournaments t
    where t.id = tournament_id and t.status <> 'draft'
  ));
create policy "Authenticated read published Fieldhouse games"
  on public.fieldhouse_tournament_games for select to authenticated
  using (exists (
    select 1 from public.fieldhouse_tournaments t
    where t.id = tournament_id and t.status <> 'draft'
  ));

-- Raw picks are private receipts. Opponent declassification must use a guarded RPC.
create policy "Players read own Fieldhouse bracket"
  on public.fieldhouse_bracket_entries for select to authenticated
  using (user_id = (select auth.uid()));
create policy "Players read own Fieldhouse round picks"
  on public.fieldhouse_round_entries for select to authenticated
  using (user_id = (select auth.uid()));
create policy "League members read Fieldhouse postseason totals"
  on public.fieldhouse_postseason_totals for select to authenticated
  using (exists (
    select 1 from public.memberships m
    where m.league_id = fieldhouse_postseason_totals.league_id
      and m.user_id = (select auth.uid())
  ));
create policy "League members read Fieldhouse postseason qualifiers"
  on public.fieldhouse_postseason_qualifiers for select to authenticated
  using (exists (
    select 1 from public.memberships m
    where m.league_id = fieldhouse_postseason_qualifiers.league_id
      and m.user_id = (select auth.uid())
  ));
create policy "League members read Fieldhouse awards"
  on public.fieldhouse_postseason_awards for select to authenticated
  using (exists (
    select 1 from public.memberships m
    where m.league_id = fieldhouse_postseason_awards.league_id
      and m.user_id = (select auth.uid())
  ));

grant select on public.fieldhouse_tournaments,
  public.fieldhouse_tournament_teams,
  public.fieldhouse_tournament_games,
  public.fieldhouse_bracket_entries,
  public.fieldhouse_round_entries,
  public.fieldhouse_postseason_totals,
  public.fieldhouse_postseason_qualifiers,
  public.fieldhouse_postseason_awards to authenticated;
revoke insert, update, delete on public.fieldhouse_tournaments,
  public.fieldhouse_tournament_teams,
  public.fieldhouse_tournament_games,
  public.fieldhouse_bracket_entries,
  public.fieldhouse_round_entries,
  public.fieldhouse_postseason_totals,
  public.fieldhouse_postseason_qualifiers,
  public.fieldhouse_postseason_awards from anon, authenticated;

create or replace function public.fieldhouse_round_weight(p_round text)
returns integer language sql immutable as $$
  select case p_round
    when 'opening' then 1 when 'r64' then 1 when 'r32' then 2
    when 's16' then 4 when 'e8' then 8 when 'ff' then 16 when 'title' then 32
    else 0 end;
$$;

create or replace function public.freeze_fieldhouse_postseason_qualifiers(p_tournament_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_sport text;
  league_row record;
  v_leagues integer := 0;
  v_players integer := 0;
  v_inserted integer := 0;
begin
  if auth.role() <> 'service_role'
     and v_uid <> '09544d2b-6eca-4131-a321-c000586c9029'::uuid then
    raise exception 'War Room owner or service access required';
  end if;
  select sport_id into v_sport from public.fieldhouse_tournaments
  where id=p_tournament_id and status<>'draft';
  if not found then raise exception 'Published Fieldhouse tournament required'; end if;

  for league_row in
    select id from public.leagues where sport_id=v_sport
  loop
    if exists(
      select 1 from public.fieldhouse_postseason_qualifiers
      where tournament_id=p_tournament_id and league_id=league_row.id
    ) then continue; end if;
    if exists(
      select 1 from public.memberships
      where league_id=league_row.id and coalesce(is_bot,false)=false and fieldhouse_region is null
    ) then raise exception 'Every Fieldhouse player needs a region before Selection Sunday'; end if;

    with regional_order as (
      select m.user_id,m.fieldhouse_region,m.total_points,
        row_number() over(
          partition by m.fieldhouse_region order by m.total_points desc,m.user_id
        )::integer regular_rank,
        count(*) over(partition by m.fieldhouse_region)::integer region_count
      from public.memberships m
      where m.league_id=league_row.id and coalesce(m.is_bot,false)=false
    ), classified as (
      select *,least(4,region_count/2)::integer as brass_size from regional_order
    )
    insert into public.fieldhouse_postseason_qualifiers(
      tournament_id,league_id,user_id,fieldhouse_region,path,regular_rank,regular_points,frozen_at
    )
    select p_tournament_id,league_row.id,user_id,fieldhouse_region,
      case
        when regular_rank<=brass_size then 'championship'
        when regular_rank>region_count-brass_size then 'toilet_bowl'
        else 'no_brass'
      end,
      regular_rank,total_points,now()
    from classified;
    get diagnostics v_inserted=row_count;
    v_players:=v_players+v_inserted;
    v_leagues:=v_leagues+1;
  end loop;
  return jsonb_build_object('ok',true,'leaguesFrozen',v_leagues,'playersFrozen',v_players);
end;
$$;
revoke all on function public.freeze_fieldhouse_postseason_qualifiers(uuid) from public,anon,authenticated;
grant execute on function public.freeze_fieldhouse_postseason_qualifiers(uuid) to service_role;

create or replace function public.validate_fieldhouse_bracket_picks(
  p_tournament_id uuid,
  p_picks jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  g record;
  v_choice text;
  v_first text;
  v_second text;
begin
  if jsonb_typeof(p_picks) <> 'object' or jsonb_object_length(p_picks) <> 75 then
    return false;
  end if;
  for g in
    select * from public.fieldhouse_tournament_games
    where tournament_id = p_tournament_id
    order by round_order, ordinal
  loop
    v_choice := p_picks ->> g.game_id;
    v_first := coalesce(g.first_team_id, p_picks ->> g.first_source_game_id);
    v_second := coalesce(g.second_team_id, p_picks ->> g.second_source_game_id);
    if v_choice is null or v_choice not in (v_first, v_second) then return false; end if;
  end loop;
  return true;
end;
$$;

revoke all on function public.validate_fieldhouse_bracket_picks(uuid,jsonb) from public, anon, authenticated;
grant execute on function public.validate_fieldhouse_bracket_picks(uuid,jsonb) to service_role;

create or replace function public.save_fieldhouse_bracket(
  p_league_id uuid,
  p_season_key integer,
  p_picks jsonb,
  p_hellfire boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_sport text;
  v_tournament public.fieldhouse_tournaments%rowtype;
  v_entry public.fieldhouse_bracket_entries%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select l.sport_id into v_sport
  from public.memberships m join public.leagues l on l.id = m.league_id
  where m.league_id = p_league_id and m.user_id = v_uid;
  if v_sport not in ('ncaam','ncaaw') then raise exception 'Fieldhouse membership required'; end if;
  select * into v_tournament from public.fieldhouse_tournaments
  where sport_id = v_sport and season_key = p_season_key and status <> 'draft';
  if not found then raise exception 'Official Fieldhouse tournament is not published'; end if;
  if v_tournament.first_tip_at is not null and now() >= v_tournament.first_tip_at then
    raise exception 'The bracket is locked';
  end if;
  if not exists(
    select 1 from public.fieldhouse_postseason_qualifiers q
    where q.tournament_id=v_tournament.id and q.league_id=p_league_id and q.user_id=v_uid
  ) then raise exception 'Selection Sunday eligibility snapshot is missing'; end if;
  select * into v_entry from public.fieldhouse_bracket_entries
  where tournament_id = v_tournament.id and league_id = p_league_id and user_id = v_uid;
  if found and v_entry.locked_at is not null then raise exception 'The bracket is permanently locked'; end if;
  if not public.validate_fieldhouse_bracket_picks(v_tournament.id, p_picks) then
    raise exception 'Invalid or incomplete bracket path';
  end if;

  insert into public.fieldhouse_bracket_entries(
    tournament_id, league_id, user_id, picks, submitted_at, locked_at, hellfire_used, updated_at
  ) values (
    v_tournament.id, p_league_id, v_uid, p_picks, now(), case when p_hellfire then now() else null end,
    p_hellfire, now()
  )
  on conflict (tournament_id, league_id, user_id) do update set
    picks = excluded.picks,
    submitted_at = excluded.submitted_at,
    locked_at = case when excluded.hellfire_used then excluded.locked_at else fieldhouse_bracket_entries.locked_at end,
    hellfire_used = fieldhouse_bracket_entries.hellfire_used or excluded.hellfire_used,
    updated_at = now()
  returning * into v_entry;
  return jsonb_build_object('ok',true,'entryId',v_entry.id,'locked',v_entry.locked_at is not null);
end;
$$;

revoke all on function public.save_fieldhouse_bracket(uuid,integer,jsonb,boolean) from public, anon;
grant execute on function public.save_fieldhouse_bracket(uuid,integer,jsonb,boolean) to authenticated;

create or replace function public.lock_fieldhouse_brackets_at_tip()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare v_count integer;
begin
  update public.fieldhouse_bracket_entries e set locked_at = coalesce(e.locked_at, now()), updated_at = now()
  from public.fieldhouse_tournaments t
  where t.id = e.tournament_id and t.first_tip_at <= now() and e.submitted_at is not null and e.locked_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
revoke all on function public.lock_fieldhouse_brackets_at_tip() from public, anon, authenticated;
grant execute on function public.lock_fieldhouse_brackets_at_tip() to service_role;

-- One tournament-round event becomes one durable outbox job per league. The
-- existing outbox event_key plus per-device delivery receipt prevents duplicate
-- pushes even when the autonomous scorer safely retries the same final result.
create or replace function private.queue_fieldhouse_round_notifications(
  p_tournament_id uuid,
  p_round_key text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sport text;
  v_round_title text;
  v_first_tip timestamptz;
  v_missing_tips integer;
  v_count integer := 0;
  v_inserted integer := 0;
begin
  if p_round_key not in ('opening','r64','r32','s16','e8','ff','title') then
    raise exception 'Invalid Fieldhouse round';
  end if;

  select t.sport_id, min(g.starts_at), count(*) filter(where g.starts_at is null)
  into v_sport, v_first_tip, v_missing_tips
  from public.fieldhouse_tournaments t
  join public.fieldhouse_tournament_games g on g.tournament_id = t.id
  where t.id = p_tournament_id and t.status <> 'draft' and g.round_key = p_round_key
  group by t.sport_id;
  if not found or v_first_tip is null or v_missing_tips<>0 then return 0; end if;

  v_round_title := case p_round_key
    when 'opening' then 'Opening Round'
    when 'r64' then 'First Round'
    when 'r32' then 'Second Round'
    when 's16' then 'Sweet 16'
    when 'e8' then 'Elite Eight'
    when 'ff' then 'Final Four'
    when 'title' then 'National Championship'
  end;

  insert into private.push_notification_outbox(
    event_key, league_id, kind, title, body, destination, week_number, deliver_at
  )
  select
    'fieldhouse-round-open:' || p_tournament_id || ':' || p_round_key || ':' || l.id,
    l.id,
    case when p_round_key='opening' then 'fieldhouse_selection_sunday' else 'fieldhouse_round_open' end,
    case when p_round_key='opening' then 'SELECTION SUNDAY IS LIVE' else upper(v_round_title) || ' PICKS ARE LIVE' end,
    case when p_round_key='opening'
      then l.name || ': fill your 76-team bracket and make all 12 Opening Round picks before the first game tips.'
      else l.name || ': make every ' || v_round_title || ' pick before the first game tips.' end,
    'picks',
    null,
    clock_timestamp()
  from public.leagues l
  where l.sport_id = v_sport
  on conflict (event_key) do nothing;
  get diagnostics v_inserted = row_count;
  v_count := v_count + v_inserted;

  if v_first_tip - interval '1 hour' > clock_timestamp() then
    insert into private.push_notification_outbox(
      event_key, league_id, kind, title, body, destination, week_number, deliver_at
    )
    select
      'fieldhouse-round-lock-1h:' || p_tournament_id || ':' || p_round_key || ':' || l.id,
      l.id,
      case when p_round_key='opening' then 'fieldhouse_selection_sunday_lock_1h' else 'fieldhouse_round_lock_1h' end,
      'FINAL WARNING · 1 HOUR',
      case when p_round_key='opening'
        then l.name || ': your 76-team bracket and Opening Round picks lock at first tip. Finish and confirm both.'
        else l.name || ': ' || v_round_title || ' picks lock at first tip. Finish and confirm the round.' end,
      'picks',
      null,
      v_first_tip - interval '1 hour'
    from public.leagues l
    where l.sport_id = v_sport
    on conflict (event_key) do nothing;
    get diagnostics v_inserted = row_count;
    v_count := v_count + v_inserted;
  end if;

  return v_count;
end;
$$;
revoke all on function private.queue_fieldhouse_round_notifications(uuid,text) from public,anon,authenticated;

create or replace function public.import_fieldhouse_official_field(
  p_sport_id text,
  p_season_key integer,
  p_field jsonb,
  p_publish boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tournament_id uuid;
  v_team_count integer;
  v_game_count integer;
  v_bad_count integer;
begin
  if v_uid <> '09544d2b-6eca-4131-a321-c000586c9029'::uuid then
    raise exception 'War Room owner access required';
  end if;
  if p_sport_id not in ('ncaam','ncaaw') then raise exception 'Unsupported Fieldhouse sport'; end if;
  if jsonb_typeof(p_field->'teams') <> 'array' or jsonb_typeof(p_field->'games') <> 'array' then
    raise exception 'Field must include teams and games arrays';
  end if;
  if jsonb_array_length(p_field->'teams') <> 76 or jsonb_array_length(p_field->'games') <> 75 then
    raise exception 'The official field requires 76 teams and 75 games';
  end if;

  insert into public.fieldhouse_tournaments(sport_id,season_key,status,created_by)
  values (p_sport_id,p_season_key,'draft',v_uid)
  on conflict (sport_id,season_key) do update set updated_at=now()
  returning id into v_tournament_id;

  if exists(select 1 from public.fieldhouse_bracket_entries where tournament_id=v_tournament_id)
     or exists(select 1 from public.fieldhouse_round_entries where tournament_id=v_tournament_id) then
    raise exception 'A field with player receipts cannot be replaced';
  end if;

  delete from public.fieldhouse_tournament_games where tournament_id=v_tournament_id;
  delete from public.fieldhouse_tournament_teams where tournament_id=v_tournament_id;

  insert into public.fieldhouse_tournament_teams(tournament_id,team_id,display_name,region,seed)
  select v_tournament_id, trim(x->>'id'), trim(x->>'name'), x->>'region', (x->>'seed')::integer
  from jsonb_array_elements(p_field->'teams') x;
  get diagnostics v_team_count = row_count;

  select count(*) into v_bad_count from (
    select region
    from public.fieldhouse_tournament_teams where tournament_id=v_tournament_id
    group by region having count(*) < 16
  ) bad;
  if v_team_count <> 76
     or (select count(distinct region) from public.fieldhouse_tournament_teams where tournament_id=v_tournament_id) <> 4
     or v_bad_count <> 0 then
    raise exception 'The field requires four regions with at least 16 teams each';
  end if;

  insert into public.fieldhouse_tournament_games(
    tournament_id,game_id,round_key,round_order,ordinal,region,
    first_team_id,second_team_id,first_source_game_id,second_source_game_id,
    odds_event_id,starts_at
  )
  select
    v_tournament_id, trim(x->>'id'), x->>'round',
    case x->>'round' when 'opening' then 0 when 'r64' then 1 when 'r32' then 2
      when 's16' then 3 when 'e8' then 4 when 'ff' then 5 when 'title' then 6 end,
    (x->>'ordinal')::integer, nullif(x->>'region',''),
    nullif(x->>'firstTeamId',''),nullif(x->>'secondTeamId',''),
    nullif(x->>'firstSourceGameId',''),nullif(x->>'secondSourceGameId',''),
    nullif(x->>'oddsEventId',''),nullif(x->>'startsAt','')::timestamptz
  from jsonb_array_elements(p_field->'games') x;
  get diagnostics v_game_count = row_count;

  select count(*) into v_bad_count from (
    select round_key,count(*) n from public.fieldhouse_tournament_games
    where tournament_id=v_tournament_id group by round_key
    having count(*) <> case round_key
      when 'opening' then 12 when 'r64' then 32 when 'r32' then 16 when 's16' then 8
      when 'e8' then 4 when 'ff' then 2 when 'title' then 1 end
  ) bad;
  if v_game_count <> 75 or v_bad_count <> 0 then raise exception 'Invalid tournament round counts'; end if;

  -- Expansion does not guarantee three Opening Round games per region. Validate
  -- the actual bracket invariant instead: 12 Opening Round games feed exactly
  -- 12 of the 64 regional slots, while every region still exposes seeds 1-16.
  select count(*) into v_bad_count
  from public.fieldhouse_tournament_games g
  join public.fieldhouse_tournament_teams a
    on a.tournament_id=g.tournament_id and a.team_id=g.first_team_id
  join public.fieldhouse_tournament_teams b
    on b.tournament_id=g.tournament_id and b.team_id=g.second_team_id
  where g.tournament_id=v_tournament_id and g.round_key='opening'
    and (g.region is null or a.region<>g.region or b.region<>g.region or a.seed<>b.seed);
  if v_bad_count <> 0 then
    raise exception 'Each Opening Round game must pair teams from one region and seed';
  end if;

  select count(*) into v_bad_count from (
    with opening_refs as (
      select first_source_game_id source_game_id
      from public.fieldhouse_tournament_games
      where tournament_id=v_tournament_id and round_key='r64' and first_source_game_id is not null
      union all
      select second_source_game_id
      from public.fieldhouse_tournament_games
      where tournament_id=v_tournament_id and round_key='r64' and second_source_game_id is not null
    )
    select opening.game_id
    from public.fieldhouse_tournament_games opening
    left join opening_refs refs on refs.source_game_id=opening.game_id
    where opening.tournament_id=v_tournament_id and opening.round_key='opening'
    group by opening.game_id
    having count(refs.source_game_id)<>1
  ) bad;
  if v_bad_count <> 0 then raise exception 'Every Opening Round game must feed exactly one First Round slot'; end if;

  select count(*) into v_bad_count from (
    with regional_slots as (
      select g.region,
        case when side.team_id is not null then team.seed else opening_team.seed end seed
      from public.fieldhouse_tournament_games g
      cross join lateral (values
        (g.first_team_id,g.first_source_game_id),
        (g.second_team_id,g.second_source_game_id)
      ) side(team_id,source_game_id)
      left join public.fieldhouse_tournament_teams team
        on team.tournament_id=g.tournament_id and team.team_id=side.team_id
      left join public.fieldhouse_tournament_games opening
        on opening.tournament_id=g.tournament_id and opening.game_id=side.source_game_id
      left join public.fieldhouse_tournament_teams opening_team
        on opening_team.tournament_id=opening.tournament_id and opening_team.team_id=opening.first_team_id
      where g.tournament_id=v_tournament_id and g.round_key='r64'
        and (
          (team.team_id is not null and team.region<>g.region)
          or (opening.game_id is not null and (opening.round_key<>'opening' or opening.region<>g.region))
        ) is not true
    )
    select region from regional_slots
    group by region
    having count(*)<>16 or count(distinct seed)<>16 or min(seed)<>1 or max(seed)<>16
  ) bad;
  if v_bad_count <> 0 then raise exception 'Every region must expose exactly one First Round slot for seeds 1 through 16'; end if;

  select count(*) into v_bad_count from (
    with used_teams as (
      select first_team_id team_id from public.fieldhouse_tournament_games
      where tournament_id=v_tournament_id and round_key in ('opening','r64') and first_team_id is not null
      union all
      select second_team_id from public.fieldhouse_tournament_games
      where tournament_id=v_tournament_id and round_key in ('opening','r64') and second_team_id is not null
    )
    select team.team_id
    from public.fieldhouse_tournament_teams team
    left join used_teams used on used.team_id=team.team_id
    where team.tournament_id=v_tournament_id
    group by team.team_id
    having count(used.team_id)<>1
  ) bad;
  if v_bad_count <> 0 then raise exception 'Every official team must occupy exactly one bracket entry path'; end if;

  select count(*) into v_bad_count
  from public.fieldhouse_tournament_games g
  where g.tournament_id=v_tournament_id and (
    (g.first_team_id is not null and not exists(
      select 1 from public.fieldhouse_tournament_teams t where t.tournament_id=g.tournament_id and t.team_id=g.first_team_id
    )) or
    (g.second_team_id is not null and not exists(
      select 1 from public.fieldhouse_tournament_teams t where t.tournament_id=g.tournament_id and t.team_id=g.second_team_id
    )) or
    (g.first_source_game_id is not null and not exists(
      select 1 from public.fieldhouse_tournament_games prior
      where prior.tournament_id=g.tournament_id and prior.game_id=g.first_source_game_id and prior.round_order=g.round_order-1
    )) or
    (g.second_source_game_id is not null and not exists(
      select 1 from public.fieldhouse_tournament_games prior
      where prior.tournament_id=g.tournament_id and prior.game_id=g.second_source_game_id and prior.round_order=g.round_order-1
    ))
  );
  if v_bad_count <> 0 then raise exception 'Field contains an invalid team or bracket source'; end if;

  select count(*) into v_bad_count from (
    with source_refs as (
      select first_source_game_id source_game_id
      from public.fieldhouse_tournament_games
      where tournament_id=v_tournament_id and first_source_game_id is not null
      union all
      select second_source_game_id
      from public.fieldhouse_tournament_games
      where tournament_id=v_tournament_id and second_source_game_id is not null
    )
    select game.game_id
    from public.fieldhouse_tournament_games game
    left join source_refs refs on refs.source_game_id=game.game_id
    where game.tournament_id=v_tournament_id
    group by game.game_id,game.round_key
    having count(refs.source_game_id)<>case when game.round_key='title' then 0 else 1 end
  ) bad;
  if v_bad_count <> 0 then raise exception 'Every bracket game must feed exactly one game in the next round'; end if;

  select count(*) into v_bad_count
  from public.fieldhouse_tournament_games game
  join public.fieldhouse_tournament_games source
    on source.tournament_id=game.tournament_id
    and source.game_id in (game.first_source_game_id,game.second_source_game_id)
  where game.tournament_id=v_tournament_id
    and game.round_key in ('r32','s16','e8')
    and source.region is distinct from game.region;
  if v_bad_count <> 0 then raise exception 'Regional bracket paths cannot cross before the Final Four'; end if;

  update public.fieldhouse_tournaments set
    status=case when p_publish then 'published' else 'draft' end,
    first_tip_at=(select min(starts_at) from public.fieldhouse_tournament_games where tournament_id=v_tournament_id),
    published_at=case when p_publish then now() else null end,
    updated_at=now()
  where id=v_tournament_id;
  if p_publish and exists(
    select 1 from public.fieldhouse_tournament_games
    where tournament_id=v_tournament_id and round_key in ('opening','r64') and starts_at is null
  ) then raise exception 'Published field requires every Opening and First Round tip time'; end if;
  if p_publish then
    perform public.freeze_fieldhouse_postseason_qualifiers(v_tournament_id);
    perform private.queue_fieldhouse_round_notifications(v_tournament_id,'opening');
  end if;

  return jsonb_build_object('ok',true,'tournamentId',v_tournament_id,'published',p_publish,'teams',76,'games',75);
end;
$$;
revoke all on function public.import_fieldhouse_official_field(text,integer,jsonb,boolean) from public,anon,authenticated;
grant execute on function public.import_fieldhouse_official_field(text,integer,jsonb,boolean) to authenticated;

-- Broadcast times and provider event IDs are not all final on Selection Sunday.
-- This owner-only path updates schedule metadata without replacing the bracket
-- graph or touching any player's permanent bracket and round receipts.
create or replace function public.sync_fieldhouse_official_schedule(
  p_sport_id text,
  p_season_key integer,
  p_games jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_tournament_id uuid;
  v_input_count integer;
  v_updated integer;
  schedule_round record;
  v_active_round text;
begin
  if v_uid <> '09544d2b-6eca-4131-a321-c000586c9029'::uuid then
    raise exception 'War Room owner access required';
  end if;
  if p_sport_id not in ('ncaam','ncaaw') then raise exception 'Unsupported Fieldhouse sport'; end if;
  if jsonb_typeof(p_games)<>'array' or jsonb_array_length(p_games)<>75 then
    raise exception 'Schedule sync requires the complete 75-game file';
  end if;
  select id into v_tournament_id from public.fieldhouse_tournaments
  where sport_id=p_sport_id and season_key=p_season_key and status<>'final';
  if not found then raise exception 'Editable Fieldhouse tournament not found'; end if;

  select count(distinct x->>'id') into v_input_count from jsonb_array_elements(p_games) x;
  if v_input_count<>75 or (
    select count(*) from jsonb_array_elements(p_games) x
    join public.fieldhouse_tournament_games g
      on g.tournament_id=v_tournament_id and g.game_id=x->>'id'
  )<>75 then raise exception 'Schedule game IDs do not match the official field'; end if;

  if exists(
    select 1 from jsonb_array_elements(p_games) x
    join public.fieldhouse_tournament_games g
      on g.tournament_id=v_tournament_id and g.game_id=x->>'id'
    where nullif(x->>'startsAt','') is not null
      and g.starts_at is distinct from (x->>'startsAt')::timestamptz
      and (
        g.completed_at is not null
        or (g.starts_at is not null and g.starts_at<=clock_timestamp())
        or (x->>'startsAt')::timestamptz<=clock_timestamp()
      )
  ) then raise exception 'A started or completed game time cannot be changed'; end if;

  update public.fieldhouse_tournament_games g set
    starts_at=coalesce(nullif(x.value->>'startsAt','')::timestamptz,g.starts_at),
    odds_event_id=coalesce(nullif(x.value->>'oddsEventId',''),g.odds_event_id)
  from jsonb_array_elements(p_games) x(value)
  where g.tournament_id=v_tournament_id and g.game_id=x.value->>'id'
    and (
      (nullif(x.value->>'startsAt','') is not null and g.starts_at is distinct from (x.value->>'startsAt')::timestamptz)
      or (nullif(x.value->>'oddsEventId','') is not null and g.odds_event_id is distinct from x.value->>'oddsEventId')
    );
  get diagnostics v_updated=row_count;

  update public.fieldhouse_tournaments set
    first_tip_at=(select min(starts_at) from public.fieldhouse_tournament_games where tournament_id=v_tournament_id),
    updated_at=now()
  where id=v_tournament_id;

  -- If a one-hour alert already exists and is still pending, keep it aligned
  -- with the corrected official round clock. Unopened rounds queue later using
  -- the newest schedule when the prior round finishes.
  for schedule_round in
    select round_key,min(starts_at) first_tip
    from public.fieldhouse_tournament_games
    where tournament_id=v_tournament_id and starts_at is not null
    group by round_key
  loop
    update private.push_notification_outbox set deliver_at=schedule_round.first_tip-interval '1 hour'
    where event_key like 'fieldhouse-round-lock-1h:'||v_tournament_id||':'||schedule_round.round_key||':%'
      and status in ('pending','failed') and schedule_round.first_tip-interval '1 hour'>clock_timestamp();
  end loop;

  -- A later round can become structurally ready before television publishes
  -- its tip time. Once this sync supplies that time, queue the active round now.
  select candidate.round_key into v_active_round
  from (
    select round_key,min(round_order) round_order,min(starts_at) first_tip,
      count(*) filter(where starts_at is null) missing_tips
    from public.fieldhouse_tournament_games
    where tournament_id=v_tournament_id and winner_team_id is null
    group by round_key
  ) candidate
  where candidate.first_tip is not null and candidate.missing_tips=0
    and not exists(
      select 1 from public.fieldhouse_tournament_games game
      where game.tournament_id=v_tournament_id and game.round_key=candidate.round_key
        and game.winner_team_id is null
        and (
          (game.first_team_id is null and not exists(
            select 1 from public.fieldhouse_tournament_games source
            where source.tournament_id=game.tournament_id and source.game_id=game.first_source_game_id and source.winner_team_id is not null
          ))
          or
          (game.second_team_id is null and not exists(
            select 1 from public.fieldhouse_tournament_games source
            where source.tournament_id=game.tournament_id and source.game_id=game.second_source_game_id and source.winner_team_id is not null
          ))
        )
    )
  order by candidate.round_order
  limit 1;
  if v_active_round is not null then
    perform private.queue_fieldhouse_round_notifications(v_tournament_id,v_active_round);
  end if;

  return jsonb_build_object('ok',true,'tournamentId',v_tournament_id,'updatedGames',v_updated);
end;
$$;
revoke all on function public.sync_fieldhouse_official_schedule(text,integer,jsonb) from public,anon,authenticated;
grant execute on function public.sync_fieldhouse_official_schedule(text,integer,jsonb) to authenticated;

create or replace function public.save_fieldhouse_round_picks(
  p_league_id uuid,
  p_season_key integer,
  p_round_key text,
  p_picks jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid:=auth.uid();
  v_sport text;
  v_tournament public.fieldhouse_tournaments%rowtype;
  g record;
  v_choice text;
  v_first text;
  v_second text;
  v_required integer;
  v_first_tip timestamptz;
  v_missing_tips integer;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select l.sport_id into v_sport from public.memberships m join public.leagues l on l.id=m.league_id
  where m.league_id=p_league_id and m.user_id=v_uid;
  if v_sport not in ('ncaam','ncaaw') then raise exception 'Fieldhouse membership required'; end if;
  select * into v_tournament from public.fieldhouse_tournaments
  where sport_id=v_sport and season_key=p_season_key and status in ('published','in_progress');
  if not found then raise exception 'Official Fieldhouse tournament is not open'; end if;
  if p_round_key not in ('opening','r64','r32','s16','e8','ff','title') then raise exception 'Invalid round'; end if;
  if not exists(
    select 1 from public.fieldhouse_postseason_qualifiers q
    where q.tournament_id=v_tournament.id and q.league_id=p_league_id and q.user_id=v_uid
  ) then raise exception 'Selection Sunday eligibility snapshot is missing'; end if;

  select count(*),min(starts_at),count(*) filter(where starts_at is null)
  into v_required,v_first_tip,v_missing_tips
  from public.fieldhouse_tournament_games where tournament_id=v_tournament.id and round_key=p_round_key;
  if jsonb_typeof(p_picks)<>'object' or jsonb_object_length(p_picks)<>v_required then
    raise exception 'Every game in this round requires a pick';
  end if;
  if v_first_tip is null or v_missing_tips<>0 then
    raise exception 'Every official round tip time must be ready';
  end if;
  if now()>=v_first_tip then raise exception 'This round is locked'; end if;

  for g in select * from public.fieldhouse_tournament_games
    where tournament_id=v_tournament.id and round_key=p_round_key order by ordinal
  loop
    v_first:=g.first_team_id;
    if v_first is null then select winner_team_id into v_first from public.fieldhouse_tournament_games
      where tournament_id=v_tournament.id and game_id=g.first_source_game_id; end if;
    v_second:=g.second_team_id;
    if v_second is null then select winner_team_id into v_second from public.fieldhouse_tournament_games
      where tournament_id=v_tournament.id and game_id=g.second_source_game_id; end if;
    v_choice:=p_picks->>g.game_id;
    if v_first is null or v_second is null then raise exception 'Prior round is not final'; end if;
    if v_choice not in (v_first,v_second) then raise exception 'Invalid round pick'; end if;
  end loop;

  insert into public.fieldhouse_round_entries(tournament_id,league_id,user_id,round_key,picks,submitted_at,updated_at)
  values(v_tournament.id,p_league_id,v_uid,p_round_key,p_picks,now(),now())
  on conflict(tournament_id,league_id,user_id,round_key) do update set
    picks=excluded.picks,submitted_at=excluded.submitted_at,updated_at=now()
  where fieldhouse_round_entries.locked_at is null;
  if not found then raise exception 'Round picks are permanently locked'; end if;
  return jsonb_build_object('ok',true,'round',p_round_key,'picks',v_required);
end;
$$;
revoke all on function public.save_fieldhouse_round_picks(uuid,integer,text,jsonb) from public,anon;
grant execute on function public.save_fieldhouse_round_picks(uuid,integer,text,jsonb) to authenticated;

create or replace function public.score_fieldhouse_postseason(p_tournament_id uuid)
returns jsonb
language plpgsql
security definer
set search_path=public
as $$
declare v_final boolean; v_brackets integer; v_rounds integer;
begin
  select status='final' into v_final from public.fieldhouse_tournaments where id=p_tournament_id;
  if not found then raise exception 'Tournament not found'; end if;

  update public.fieldhouse_round_entries e set locked_at=coalesce(e.locked_at,now()),updated_at=now()
  where e.tournament_id=p_tournament_id and e.locked_at is null and exists(
    select 1 from public.fieldhouse_tournament_games g
    where g.tournament_id=e.tournament_id and g.round_key=e.round_key
    group by g.round_key having min(g.starts_at)<=now()
  );

  update public.fieldhouse_bracket_entries e set
    correct_picks=s.correct_picks,
    raw_points=s.raw_points,
    adjusted_points=case
      when not e.hellfire_used or not v_final then s.raw_points
      when s.correct_picks::numeric/75>=0.60 then round(s.raw_points*1.5)::integer
      else round(s.raw_points*0.5)::integer end,
    updated_at=now()
  from (
    select e2.id,count(*) filter(where e2.picks->>g.game_id=g.winner_team_id)::integer correct_picks,
      coalesce(sum(case when e2.picks->>g.game_id=g.winner_team_id then public.fieldhouse_round_weight(g.round_key) else 0 end),0)::integer raw_points
    from public.fieldhouse_bracket_entries e2
    join public.fieldhouse_tournament_games g on g.tournament_id=e2.tournament_id and g.winner_team_id is not null
    where e2.tournament_id=p_tournament_id group by e2.id
  ) s where e.id=s.id;
  get diagnostics v_brackets=row_count;

  update public.fieldhouse_round_entries e set points=s.points,updated_at=now()
  from (
    select e2.id,count(*) filter(where e2.picks->>g.game_id=g.winner_team_id)::integer points
    from public.fieldhouse_round_entries e2
    join public.fieldhouse_tournament_games g on g.tournament_id=e2.tournament_id and g.round_key=e2.round_key and g.winner_team_id is not null
    where e2.tournament_id=p_tournament_id group by e2.id
  ) s where e.id=s.id;
  get diagnostics v_rounds=row_count;

  -- The frozen Selection Sunday field is the participant authority. A player
  -- who files nothing still owns a permanent zero-point postseason receipt;
  -- silently dropping them would corrupt regional awards and tie resolution.
  with players as (
    select tournament_id,league_id,user_id
    from public.fieldhouse_postseason_qualifiers
    where tournament_id=p_tournament_id
  ), bracket as (
    select tournament_id,league_id,user_id,correct_picks,raw_points,adjusted_points
    from public.fieldhouse_bracket_entries
    where tournament_id=p_tournament_id and submitted_at is not null
  ), rounds as (
    select tournament_id,league_id,user_id,coalesce(sum(points),0)::integer points
    from public.fieldhouse_round_entries
    where tournament_id=p_tournament_id and submitted_at is not null
    group by tournament_id,league_id,user_id
  )
  insert into public.fieldhouse_postseason_totals(
    tournament_id,league_id,user_id,bracket_correct_picks,bracket_raw_points,
    bracket_adjusted_points,round_points,updated_at
  )
  select p.tournament_id,p.league_id,p.user_id,
    coalesce(b.correct_picks,0),coalesce(b.raw_points,0),coalesce(b.adjusted_points,0),
    coalesce(r.points,0),now()
  from players p
  left join bracket b using(tournament_id,league_id,user_id)
  left join rounds r using(tournament_id,league_id,user_id)
  on conflict(tournament_id,league_id,user_id) do update set
    bracket_correct_picks=excluded.bracket_correct_picks,
    bracket_raw_points=excluded.bracket_raw_points,
    bracket_adjusted_points=excluded.bracket_adjusted_points,
    round_points=excluded.round_points,
    updated_at=now();

  return jsonb_build_object('ok',true,'bracketsScored',v_brackets,'roundEntriesScored',v_rounds,'final',v_final);
end;
$$;
revoke all on function public.score_fieldhouse_postseason(uuid) from public,anon,authenticated;
grant execute on function public.score_fieldhouse_postseason(uuid) to service_role;

create or replace function public.finalize_fieldhouse_postseason_awards(p_tournament_id uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  v_status text;
  v_region_awards integer := 0;
  v_league_awards integer := 0;
  v_toilet_awards integer := 0;
begin
  select status into v_status from public.fieldhouse_tournaments where id=p_tournament_id;
  if v_status<>'final' then raise exception 'Tournament is not final'; end if;
  perform public.score_fieldhouse_postseason(p_tournament_id);

  with totals as (
    select p.league_id,p.user_id,q.fieldhouse_region,p.total_points,
      q.regular_points,l.championship_trophy_id
    from public.fieldhouse_postseason_totals p
    join public.fieldhouse_postseason_qualifiers q
      on q.tournament_id=p.tournament_id and q.league_id=p.league_id and q.user_id=p.user_id
    join public.leagues l on l.id=p.league_id
    where p.tournament_id=p_tournament_id and q.path='championship'
  ), regional as (
    select *,row_number() over(partition by league_id,fieldhouse_region order by total_points desc,regular_points desc,user_id) place
    from totals where fieldhouse_region is not null
  )
  insert into public.fieldhouse_postseason_awards(tournament_id,league_id,user_id,award_key,player_region,trophy_id,total_points)
  select p_tournament_id,league_id,user_id,'regional_champion',fieldhouse_region,
    'fieldhouse-regional-'||lower(fieldhouse_region),total_points from regional where place=1
  on conflict(tournament_id,league_id,award_key,player_region) where award_key='regional_champion' do update set
    user_id=excluded.user_id,trophy_id=excluded.trophy_id,total_points=excluded.total_points,awarded_at=now();
  get diagnostics v_region_awards=row_count;

  with totals as (
    select p.league_id,p.user_id,p.total_points,q.regular_points,l.championship_trophy_id
    from public.fieldhouse_postseason_totals p
    join public.fieldhouse_postseason_qualifiers q
      on q.tournament_id=p.tournament_id and q.league_id=p.league_id and q.user_id=p.user_id
    join public.leagues l on l.id=p.league_id
    where p.tournament_id=p_tournament_id and q.path='championship'
  ), ranked as (
    select *,row_number() over(partition by league_id order by total_points desc,regular_points desc,user_id) place from totals
  )
  insert into public.fieldhouse_postseason_awards(tournament_id,league_id,user_id,award_key,player_region,trophy_id,total_points)
  select p_tournament_id,league_id,user_id,'league_champion',null,
    coalesce(championship_trophy_id,'fieldhouse-champion'),total_points from ranked where place=1
  on conflict(tournament_id,league_id,award_key) where award_key='league_champion' do update set
    user_id=excluded.user_id,trophy_id=excluded.trophy_id,total_points=excluded.total_points,awarded_at=now();
  get diagnostics v_league_awards=row_count;

  with totals as (
    select p.league_id,p.user_id,p.total_points,q.regular_points
    from public.fieldhouse_postseason_totals p
    join public.fieldhouse_postseason_qualifiers q
      on q.tournament_id=p.tournament_id and q.league_id=p.league_id and q.user_id=p.user_id
    where p.tournament_id=p_tournament_id and q.path='toilet_bowl'
  ), ranked as (
    select *,row_number() over(partition by league_id order by total_points desc,regular_points desc,user_id) place
    from totals
  )
  insert into public.fieldhouse_postseason_awards(tournament_id,league_id,user_id,award_key,player_region,trophy_id,total_points)
  select p_tournament_id,league_id,user_id,'toilet_champion',null,'toilet_bowl',total_points
  from ranked where place=1
  on conflict(tournament_id,league_id,award_key) where award_key='toilet_champion' do update set
    user_id=excluded.user_id,trophy_id=excluded.trophy_id,total_points=excluded.total_points,awarded_at=now();
  get diagnostics v_toilet_awards=row_count;

  -- The postseason awards table is the scoring receipt. The shared
  -- league_trophies table is the permanent public hardware shelf consumed by
  -- CFB, NFL, NCAAM and NCAAW profiles. Engrave both from the same final rows
  -- so the profile can never disagree with the authoritative tournament total.
  insert into public.league_trophies(
    league_id,season_year,trophy_type,winner_name,winner_user_id,
    subtitle,notes,awarded_at,trophy_design_id
  )
  select
    a.league_id,t.season_key,
    'fieldhouse_region_'||lower(a.player_region),
    coalesce(nullif(trim(p.display_name),''),'Player'),a.user_id,
    a.player_region||' Regional Champion · '||t.season_key::text,
    'Won the '||a.player_region||' Region with '||a.total_points||' official tournament points.',
    a.awarded_at,a.trophy_id
  from public.fieldhouse_postseason_awards a
  join public.fieldhouse_tournaments t on t.id=a.tournament_id
  left join public.profiles p on p.id=a.user_id
  where a.tournament_id=p_tournament_id and a.award_key='regional_champion'
  on conflict(league_id,season_year,trophy_type) do update set
    winner_name=excluded.winner_name,
    winner_user_id=excluded.winner_user_id,
    subtitle=excluded.subtitle,
    notes=excluded.notes,
    awarded_at=excluded.awarded_at,
    trophy_design_id=excluded.trophy_design_id;

  insert into public.league_trophies(
    league_id,season_year,trophy_type,winner_name,winner_user_id,
    subtitle,notes,awarded_at,trophy_design_id
  )
  select
    a.league_id,t.season_key,'championship',
    coalesce(nullif(trim(p.display_name),''),'Player'),a.user_id,
    case t.sport_id when 'ncaaw' then 'NCAAW Fieldhouse Champion · ' else 'NCAAM Fieldhouse Champion · ' end||t.season_key::text,
    'Won the Fieldhouse with '||a.total_points||' official tournament points.',
    a.awarded_at,a.trophy_id
  from public.fieldhouse_postseason_awards a
  join public.fieldhouse_tournaments t on t.id=a.tournament_id
  left join public.profiles p on p.id=a.user_id
  where a.tournament_id=p_tournament_id and a.award_key='league_champion'
  on conflict(league_id,season_year,trophy_type) do update set
    winner_name=excluded.winner_name,
    winner_user_id=excluded.winner_user_id,
    subtitle=excluded.subtitle,
    notes=excluded.notes,
    awarded_at=excluded.awarded_at,
    trophy_design_id=excluded.trophy_design_id;

  insert into public.league_trophies(
    league_id,season_year,trophy_type,winner_name,winner_user_id,
    subtitle,notes,awarded_at,trophy_design_id
  )
  select
    a.league_id,t.season_key,'toilet_bowl',
    coalesce(nullif(trim(p.display_name),''),'Player'),a.user_id,
    'Fieldhouse Toilet Bowl Champion · '||t.season_key::text,
    'Won the bottom-field bracket race with '||a.total_points||' official tournament points.',
    a.awarded_at,a.trophy_id
  from public.fieldhouse_postseason_awards a
  join public.fieldhouse_tournaments t on t.id=a.tournament_id
  left join public.profiles p on p.id=a.user_id
  where a.tournament_id=p_tournament_id and a.award_key='toilet_champion'
  on conflict(league_id,season_year,trophy_type) do update set
    winner_name=excluded.winner_name,
    winner_user_id=excluded.winner_user_id,
    subtitle=excluded.subtitle,
    notes=excluded.notes,
    awarded_at=excluded.awarded_at,
    trophy_design_id=excluded.trophy_design_id;

  return jsonb_build_object(
    'ok',true,
    'regionalAwards',v_region_awards,
    'leagueAwards',v_league_awards,
    'toiletAwards',v_toilet_awards,
    'permanentHardware',v_region_awards+v_league_awards+v_toilet_awards
  );
end;
$$;
revoke all on function public.finalize_fieldhouse_postseason_awards(uuid) from public,anon,authenticated;
grant execute on function public.finalize_fieldhouse_postseason_awards(uuid) to service_role;

create or replace function public.record_fieldhouse_tournament_result(
  p_tournament_id uuid,
  p_game_id text,
  p_winner_team_id text,
  p_first_score integer,
  p_second_score integer,
  p_completed_at timestamptz
)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  g public.fieldhouse_tournament_games%rowtype;
  v_first text;
  v_second text;
  v_score jsonb;
  v_awards jsonb;
  v_next_round text;
begin
  -- Tournament games often end within seconds of one another. Serialize final
  -- result writes for this tournament so the last game can reliably observe
  -- every earlier final, open the next round once, and recalculate one score.
  perform pg_advisory_xact_lock(hashtextextended(p_tournament_id::text,0));
  select * into g from public.fieldhouse_tournament_games
  where tournament_id=p_tournament_id and game_id=p_game_id for update;
  if not found then raise exception 'Tournament game not found'; end if;
  if g.winner_team_id is not null then
    if g.winner_team_id=p_winner_team_id
      and g.first_score=p_first_score
      and g.second_score=p_second_score then
      v_score:=public.score_fieldhouse_postseason(p_tournament_id);
      if g.round_key='title' then
        v_awards:=public.finalize_fieldhouse_postseason_awards(p_tournament_id);
      end if;
      return v_score||jsonb_build_object('awards',v_awards,'alreadyRecorded',true);
    end if;
    raise exception 'Tournament result is already final';
  end if;
  v_first:=g.first_team_id;
  if v_first is null then select winner_team_id into v_first from public.fieldhouse_tournament_games
    where tournament_id=p_tournament_id and game_id=g.first_source_game_id; end if;
  v_second:=g.second_team_id;
  if v_second is null then select winner_team_id into v_second from public.fieldhouse_tournament_games
    where tournament_id=p_tournament_id and game_id=g.second_source_game_id; end if;
  if p_winner_team_id not in (v_first,v_second) then raise exception 'Winner is not an official participant'; end if;
  if p_first_score is null or p_second_score is null
     or p_first_score<0 or p_second_score<0 or p_first_score=p_second_score then
    raise exception 'Invalid final basketball score';
  end if;
  if (p_winner_team_id=v_first and p_first_score<p_second_score)
     or (p_winner_team_id=v_second and p_second_score<p_first_score) then
    raise exception 'Winner does not match the official final score';
  end if;
  if p_completed_at is null then raise exception 'Completed time required'; end if;
  if g.starts_at is not null and p_completed_at<g.starts_at then
    raise exception 'Completed time cannot precede the official tip';
  end if;
  update public.fieldhouse_tournament_games set winner_team_id=p_winner_team_id,
    first_score=p_first_score,second_score=p_second_score,completed_at=p_completed_at
  where tournament_id=p_tournament_id and game_id=p_game_id;
  update public.fieldhouse_tournaments set
    status=case when p_game_id=(select game_id from public.fieldhouse_tournament_games where tournament_id=p_tournament_id and round_key='title') then 'final' else 'in_progress' end,
    finalized_at=case when p_game_id=(select game_id from public.fieldhouse_tournament_games where tournament_id=p_tournament_id and round_key='title') then p_completed_at else finalized_at end,
    updated_at=now() where id=p_tournament_id;
  v_score:=public.score_fieldhouse_postseason(p_tournament_id);
  if not exists(
    select 1 from public.fieldhouse_tournament_games pending
    where pending.tournament_id=p_tournament_id
      and pending.round_key=g.round_key
      and pending.winner_team_id is null
  ) then
    v_next_round:=case g.round_key
      when 'opening' then 'r64'
      when 'r64' then 'r32'
      when 'r32' then 's16'
      when 's16' then 'e8'
      when 'e8' then 'ff'
      when 'ff' then 'title'
      else null
    end;
    if v_next_round is not null then
      perform private.queue_fieldhouse_round_notifications(p_tournament_id,v_next_round);
    end if;
  end if;
  if g.round_key='title' then
    v_awards:=public.finalize_fieldhouse_postseason_awards(p_tournament_id);
  end if;
  return v_score||jsonb_build_object('awards',v_awards);
end;
$$;
revoke all on function public.record_fieldhouse_tournament_result(uuid,text,text,integer,integer,timestamptz) from public,anon,authenticated;
grant execute on function public.record_fieldhouse_tournament_result(uuid,text,text,integer,integer,timestamptz) to service_role;

-- Round submissions are one point per correct pick. Official bracket predictions
-- retain the escalating 1/1/2/4/8/16/32 weighting above.
comment on table public.fieldhouse_round_entries is
  'Fresh picks submitted each tournament round; one point per correct official winner.';
comment on table public.fieldhouse_bracket_entries is
  'Selection Sunday 75-decision receipt; Hellfire applies 1.5x at 60 percent or 0.5x below 60 percent after the title game.';

commit;

-- Required deployment order:
-- 1. fieldhouse-build21-schema-REVIEW-ONLY.sql
-- 2. fieldhouse-postseason-build21-REVIEW-ONLY.sql
-- 3. atomic card publish/save/scoring SQL
-- 4. fieldhouse-odds, football-scores, autonomous-football-results functions
