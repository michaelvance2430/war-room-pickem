-- =============================================================================
-- D1B-B / 00-disposable-baseline.sql
-- =============================================================================
-- REVIEW ONLY
-- DISPOSABLE EMPTY BRANCH ONLY
-- NEVER APPLY TO PRODUCTION
-- NEVER MERGE AS A PRODUCTION MIGRATION
-- NEVER ADD TO supabase/migrations/ FOR AUTO-DEPLOY
-- =============================================================================
-- Purpose: reconstruct the MINIMUM live-compatible schema so D1B-B files
--   01 → 02 → 02b → 03 → 04 → 05 → 06 can be tested on an empty branch.
-- =============================================================================

begin;

-- ── SAFETY GATES: abort unless empty disposable environment ────────────────
do $$
begin
  if to_regclass('public.d1b_b_disposable_environment') is not null then
    raise exception
      'D1B-B disposable baseline: sentinel already exists — refuse double baseline';
  end if;

  if to_regclass('public.leagues') is not null then
    raise exception
      'D1B-B disposable baseline: public.leagues already exists — refuse (not empty). NEVER run on production.';
  end if;

  if to_regclass('public.memberships') is not null then
    raise exception
      'D1B-B disposable baseline: public.memberships already exists — refuse.';
  end if;

  if to_regclass('public.profiles') is not null then
    raise exception
      'D1B-B disposable baseline: public.profiles already exists — refuse.';
  end if;

  -- Heuristic: production-scale tables must not be present
  if to_regclass('public.crystal_ball_picks') is not null
     or to_regclass('public.picks') is not null then
    raise exception
      'D1B-B disposable baseline: production-like tables detected — refuse.';
  end if;
end $$;

create extension if not exists pgcrypto;

-- ── auth.uid() for JWT claim simulation (Supabase-compatible) ───────────────
create schema if not exists auth;

-- Disposable-only auth.uid: prefer claim.sub then claims JSON (Supabase style)
create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select coalesce(
    nullif(current_setting('request.jwt.claim.sub', true), ''),
    nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'
  )::uuid;
$$;

comment on function auth.uid() is
  'D1B-B DISPOSABLE ONLY: JWT claim simulation. Do not deploy as production auth.';

-- ── Enums (live-compatible) ─────────────────────────────────────────────────
do $$ begin
  create type public.member_role as enum ('commissioner', 'player');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.division as enum ('North', 'South', 'East', 'West');
exception when duplicate_object then null;
end $$;

-- ── profiles (no production data; no FK to auth.users for synthetic UUIDs) ───
create table public.profiles (
  id uuid primary key,
  display_name text not null,
  created_at timestamptz not null default now()
);

-- ── leagues (live-compatible CHECK on cut_percent 10–75) ────────────────────
create table public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  commissioner_id uuid not null references public.profiles (id) on delete cascade,
  cut_percent int not null default 50
    check (cut_percent >= 10 and cut_percent <= 75),
  regular_season_weeks int not null default 18,
  games_per_week int not null default 5,
  current_week int not null default 0,
  sport_id text not null default 'cfb',
  crystal_ball_enabled boolean not null default true,
  is_open boolean not null default false,
  open_listed_at timestamptz,
  created_at timestamptz not null default now()
);

create index leagues_code_idx on public.leagues (code);
create index leagues_is_open_idx on public.leagues (is_open) where is_open is true;
create index leagues_sport_id_idx on public.leagues (sport_id);

-- ── memberships ─────────────────────────────────────────────────────────────
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.member_role not null default 'player',
  division public.division not null default 'North',
  total_points int not null default 0,
  weekly_points int[] not null default '{}',
  ats_correct int not null default 0,
  ats_total int not null default 0,
  current_streak int not null default 0,
  best_week int not null default 0,
  worst_week int not null default 0,
  perfect_weeks int not null default 0,
  best_bet_hits int not null default 0,
  best_bet_total int not null default 0,
  prop_hits int not null default 0,
  prop_total int not null default 0,
  weeks_played int not null default 0,
  joined_at timestamptz not null default now(),
  is_bot boolean not null default false,
  is_moderator boolean not null default false,
  locker_muted boolean not null default false,
  is_deputy boolean not null default false,
  display_name_override text,
  unique (league_id, user_id)
);

create index memberships_league_idx on public.memberships (league_id);
create index memberships_user_idx on public.memberships (user_id);
create index memberships_bot_league_idx
  on public.memberships (league_id) where is_bot is true;

-- ── week_results (fair-entry latest scored week) ────────────────────────────
create table public.week_results (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  week_number int not null,
  prop_result text,
  scored_at timestamptz not null default now(),
  unique (league_id, week_number)
);

-- ── league_first_joins + helpers used by join RPCs ──────────────────────────
create table public.league_first_joins (
  league_id uuid not null references public.leagues (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  first_joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);

create or replace function public.is_league_member(p_league_id uuid)
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

revoke all on function public.is_league_member(uuid) from public;
grant execute on function public.is_league_member(uuid) to authenticated;

create or replace function public.record_league_first_join(
  p_league_id uuid,
  p_user_id uuid default null
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_at timestamptz;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_user_id is not null and p_user_id is distinct from v_uid then
    raise exception 'Can only record your own first join';
  end if;
  if not public.is_league_member(p_league_id) then
    raise exception 'Not a member of this league';
  end if;
  insert into public.league_first_joins (league_id, user_id, first_joined_at)
  values (p_league_id, v_uid, now())
  on conflict (league_id, user_id) do nothing;
  select first_joined_at into v_at
  from public.league_first_joins
  where league_id = p_league_id and user_id = v_uid;
  return v_at;
end;
$$;

revoke all on function public.record_league_first_join(uuid, uuid) from public;
revoke all on function public.record_league_first_join(uuid, uuid) from anon;
grant execute on function public.record_league_first_join(uuid, uuid) to authenticated;

-- ── RLS baseline (permissive for disposable testing; D1B-B later stages tighten)
alter table public.profiles enable row level security;
alter table public.leagues enable row level security;
alter table public.memberships enable row level security;
alter table public.week_results enable row level security;
alter table public.league_first_joins enable row level security;

-- Disposable: allow authenticated full access for fixture/setup simplicity
-- (NOT production policy set)
create policy "disp profiles all" on public.profiles for all to authenticated using (true) with check (true);
create policy "disp leagues all" on public.leagues for all to authenticated using (true) with check (true);
create policy "disp memberships all" on public.memberships for all to authenticated using (true) with check (true);
create policy "disp week_results all" on public.week_results for all to authenticated using (true) with check (true);
create policy "disp first_joins all" on public.league_first_joins for all to authenticated using (true) with check (true);

-- Live-like insert own (for dual-path tests before stage 10)
create policy "Memberships insert own"
  on public.memberships for insert to authenticated
  with check (user_id = auth.uid());

-- ── SENTINEL (created last among gates; required by harness/rollback) ───────
create table public.d1b_b_disposable_environment (
  id boolean primary key default true check (id),
  package text not null,
  version text not null,
  label text not null,
  created_at timestamptz not null default now(),
  constraint d1b_b_disposable_label_chk check (
    label = 'D1B-B DISPOSABLE EMPTY BRANCH ONLY — NEVER PRODUCTION'
  )
);

insert into public.d1b_b_disposable_environment (package, version, label)
values (
  'supabase/review-only/D1B-B',
  '2026-08-06-disposable-baseline-v1',
  'D1B-B DISPOSABLE EMPTY BRANCH ONLY — NEVER PRODUCTION'
);

comment on table public.d1b_b_disposable_environment is
  'SENTINEL: proves this database is a D1B-B disposable test environment. Rollback requires this row.';

commit;

-- END 00-disposable-baseline.sql
-- NEXT: 01 → 02 → 02b → 03 → 04 → 05 → 06 (never 07)
-- THEN: 00b-jwt-and-fixtures.sql + 09-full-test-runner.sql
