-- =============================================================================
-- D1B-B / 02b-fair-entry.sql
-- REVIEW ONLY — DO NOT APPLY TO LIVE WITHOUT SEPARATE STAGE AUTH
-- =============================================================================
-- Server-owned Fair Entry starting total_points (NOT division placement).
-- Parity target: src/lib/fair-entry.ts (line-level map in docs).
-- No localStorage. No caller-supplied points. Bots excluded from percentiles.
-- Joining user excluded from standings used for their own entry score.
-- =============================================================================

-- Normalized freeze table (preferred over sport_settings JSON for concurrency)
create table if not exists public.fair_entry_band_freezes (
  league_id uuid not null references public.leagues (id) on delete cascade,
  season_year integer not null,
  band_id text not null
    check (band_id in ('1-2', '3-4', '5-6', '7-8', '9+')),
  points integer not null check (points >= 0),
  latest_scored_week integer not null,
  human_sample_size integer not null check (human_sample_size >= 0),
  percentile integer not null check (percentile >= 0 and percentile <= 100),
  frozen_at timestamptz not null default now(),
  primary key (league_id, season_year, band_id)
);

comment on table public.fair_entry_band_freezes is
  'D1B-B: server-owned Fair Entry band freezes. Idempotent; never overwrite. Bots never seed freezes.';

create index if not exists fair_entry_band_freezes_league_idx
  on public.fair_entry_band_freezes (league_id, season_year);

alter table public.fair_entry_band_freezes enable row level security;

-- No client write policies. Members may read freezes for their leagues (optional).
drop policy if exists "Members read fair entry freezes" on public.fair_entry_band_freezes;
create policy "Members read fair entry freezes"
  on public.fair_entry_band_freezes for select to authenticated
  using (public.is_league_member(league_id));

-- Competitive season key for freeze scoping (single continuous season product today)
create or replace function public.d1b_b_fair_entry_season_year(p_league_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  -- Prefer explicit league column when present (D1C-era); else ET calendar year.
  select coalesce(
    (
      select nullif(
        (to_jsonb(l) ->> 'active_competition_season_year')::integer,
        null
      )
      from public.leagues l
      where l.id = p_league_id
    ),
    extract(year from (now() at time zone 'America/New_York'))::integer
  );
$$;

-- Latest scored week (>= 1) from week_results; null if none
create or replace function public.d1b_b_latest_scored_week(p_league_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_max integer;
begin
  begin
    select max(wr.week_number)::integer into v_max
    from public.week_results wr
    where wr.league_id = p_league_id
      and wr.week_number is not null
      and wr.week_number >= 0;
  exception when undefined_table then
    return null;
  end;
  if v_max is null or v_max < 1 then
    return null;
  end if;
  return v_max;
end;
$$;

-- Band id + percentile for latest scored week (mirrors FAIR_ENTRY_BANDS)
create or replace function public.d1b_b_fair_entry_band(p_latest_scored integer)
returns table (band_id text, percentile integer, freeze_after_week integer)
language sql
immutable
as $$
  select * from (
    values
      ('1-2'::text, 75, 2),
      ('3-4', 60, 4),
      ('5-6', 50, 6),
      ('7-8', 30, 8),
      ('9+', 15, 9)
  ) as b(band_id, percentile, freeze_after_week)
  where p_latest_scored is not null
    and p_latest_scored >= 1
    and (
      (band_id = '1-2' and p_latest_scored between 1 and 2)
      or (band_id = '3-4' and p_latest_scored between 3 and 4)
      or (band_id = '5-6' and p_latest_scored between 5 and 6)
      or (band_id = '7-8' and p_latest_scored between 7 and 8)
      or (band_id = '9+' and p_latest_scored >= 9)
    )
  limit 1;
$$;

-- Percentile nearest-rank + linear interpolate + round (mirror fair-entry.ts)
create or replace function public.d1b_b_percentile_value(p_values integer[], p_percentile numeric)
returns integer
language plpgsql
immutable
as $$
declare
  s integer[];
  n int;
  p numeric;
  rank numeric;
  lo int;
  hi int;
  v numeric;
begin
  if p_values is null or coalesce(array_length(p_values, 1), 0) = 0 then
    return 0;
  end if;

  select array_agg(x order by x)
  into s
  from (
    select coalesce(v, 0)::integer as x
    from unnest(p_values) as v
  ) q;

  n := array_length(s, 1);
  if n = 1 then
    return s[1];
  end if;

  p := least(100, greatest(0, coalesce(p_percentile, 0)));
  rank := (p / 100.0) * (n - 1);
  lo := floor(rank)::int;
  hi := ceil(rank)::int;
  -- 1-based arrays
  lo := lo + 1;
  hi := hi + 1;
  if lo = hi then
    return s[lo];
  end if;
  v := s[lo] + (s[hi] - s[lo]) * (rank - (lo - 1));
  return round(v)::integer;
end;
$$;

-- Human total_points for league, optionally excluding a user (joining caller)
create or replace function public.d1b_b_human_points_array(
  p_league_id uuid,
  p_exclude_user_id uuid default null
)
returns integer[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(coalesce(m.total_points, 0)::integer), array[]::integer[])
  from public.memberships m
  where m.league_id = p_league_id
    and coalesce(m.is_bot, false) = false
    and (p_exclude_user_id is null or m.user_id is distinct from p_exclude_user_id);
$$;

-- Idempotent freeze: never overwrite existing row
create or replace function public.d1b_b_freeze_band_if_needed(
  p_league_id uuid,
  p_season_year integer,
  p_band_id text,
  p_points integer,
  p_latest_scored_week integer,
  p_human_sample_size integer,
  p_percentile integer
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing integer;
  v_pts integer := greatest(0, coalesce(p_points, 0));
begin
  select f.points into v_existing
  from public.fair_entry_band_freezes f
  where f.league_id = p_league_id
    and f.season_year = p_season_year
    and f.band_id = p_band_id;

  if found then
    return v_existing;
  end if;

  insert into public.fair_entry_band_freezes (
    league_id, season_year, band_id, points,
    latest_scored_week, human_sample_size, percentile
  ) values (
    p_league_id, p_season_year, p_band_id, v_pts,
    p_latest_scored_week, coalesce(p_human_sample_size, 0), p_percentile
  )
  on conflict (league_id, season_year, band_id) do nothing;

  select f.points into v_existing
  from public.fair_entry_band_freezes f
  where f.league_id = p_league_id
    and f.season_year = p_season_year
    and f.band_id = p_band_id;

  return coalesce(v_existing, v_pts);
end;
$$;

-- Full Fair Entry resolve (parity with resolveFairEntryForJoin)
-- Call under league FOR UPDATE from join RPCs for freeze concurrency.
create or replace function public.d1b_b_fair_entry_points(
  p_league_id uuid,
  p_exclude_user_id uuid default null
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_latest integer;
  v_band record;
  v_season integer;
  v_humans integer[];
  v_pts integer;
  v_frozen integer;
  v_n int;
begin
  if p_league_id is null then
    return 0;
  end if;

  v_latest := public.d1b_b_latest_scored_week(p_league_id);
  -- Preseason / no official score yet
  if v_latest is null or v_latest < 1 then
    return 0;
  end if;

  select * into v_band from public.d1b_b_fair_entry_band(v_latest);
  if not found or v_band.band_id is null then
    return 0;
  end if;

  v_season := public.d1b_b_fair_entry_season_year(p_league_id);

  select f.points into v_frozen
  from public.fair_entry_band_freezes f
  where f.league_id = p_league_id
    and f.season_year = v_season
    and f.band_id = v_band.band_id;

  if found then
    return greatest(0, v_frozen);
  end if;

  -- Exclude joining user from source standings (new join should not be a member yet)
  v_humans := public.d1b_b_human_points_array(p_league_id, p_exclude_user_id);
  v_n := coalesce(array_length(v_humans, 1), 0);
  if v_n = 0 then
    return 0;
  end if;

  v_pts := public.d1b_b_percentile_value(v_humans, v_band.percentile);
  v_pts := public.d1b_b_freeze_band_if_needed(
    p_league_id,
    v_season,
    v_band.band_id,
    v_pts,
    v_latest,
    v_n,
    v_band.percentile
  );

  return greatest(0, coalesce(v_pts, 0));
end;
$$;

comment on function public.d1b_b_fair_entry_points(uuid, uuid) is
  'D1B-B: server Fair Entry total_points. Parity with fair-entry.ts. Not division.';

revoke all on function public.d1b_b_fair_entry_season_year(uuid) from public;
revoke all on function public.d1b_b_latest_scored_week(uuid) from public;
revoke all on function public.d1b_b_fair_entry_band(integer) from public;
revoke all on function public.d1b_b_percentile_value(integer[], numeric) from public;
revoke all on function public.d1b_b_human_points_array(uuid, uuid) from public;
revoke all on function public.d1b_b_freeze_band_if_needed(uuid, integer, text, integer, integer, integer, integer) from public;
revoke all on function public.d1b_b_fair_entry_points(uuid, uuid) from public;

-- Keep 1-arg name for join RPCs: exclude auth.uid()
create or replace function public.d1b_b_fair_entry_points(p_league_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select public.d1b_b_fair_entry_points(p_league_id, auth.uid());
$$;

revoke all on function public.d1b_b_fair_entry_points(uuid) from public;

-- END 02b FAIR ENTRY — REVIEW ONLY
