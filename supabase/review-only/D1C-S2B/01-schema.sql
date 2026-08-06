-- =============================================================================
-- D1C-S2B / 01-schema.sql
-- REVIEW ONLY — NON-PRODUCTION — DO NOT APPLY TO LIVE SUPABASE
-- =============================================================================
-- Authorizes: ephemeral / disposable database experimentation only.
-- Does NOT authorize: production apply, live backfill, app deploy, D1B/H-01.
-- Does NOT mutate: existing crystal_ball_picks / crystal_ball_result rows.
-- D1C status after this file alone: NOT REPAIRED (design/test package).
-- =============================================================================

-- ── Platform staff allowlist (T8) ───────────────────────────────────────────
-- Trusted source: server-owned table, not memberships.is_deputy / is_league_ops.
-- Empty table ⇒ platform crown/correction paths never succeed (safe default).
-- Population: service_role / break-glass only — NEVER client INSERT policies.

create table if not exists public.platform_staff (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  note text,
  created_at timestamptz not null default now(),
  created_by uuid references public.profiles (id),
  revoked_at timestamptz
);

comment on table public.platform_staff is
  'D1C-S2B REVIEW-ONLY: trusted platform operators. NOT league deputies. Empty = no platform authority.';

create index if not exists platform_staff_active_idx
  on public.platform_staff (user_id)
  where revoked_at is null;

alter table public.platform_staff enable row level security;

-- No authenticated write policies (intentional). Optional read for self:
drop policy if exists "Platform staff self-read" on public.platform_staff;
create policy "Platform staff self-read"
  on public.platform_staff for select to authenticated
  using (user_id = auth.uid() and revoked_at is null);

-- ── Season deadlines (server-owned calendar; no year literals in RLS) ───────

create table if not exists public.crystal_ball_season_deadlines (
  sport_id text not null,
  season_year integer not null,
  lock_at timestamptz not null,
  label text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (sport_id, season_year),
  constraint crystal_ball_season_deadlines_sport_chk
    check (sport_id in ('cfb', 'nfl'))
);

comment on table public.crystal_ball_season_deadlines is
  'D1C-S2B REVIEW-ONLY: server CFB/NFL calendar deadlines. Policies JOIN this; never embed year literals.';

alter table public.crystal_ball_season_deadlines enable row level security;

drop policy if exists "Members read season deadlines" on public.crystal_ball_season_deadlines;
create policy "Members read season deadlines"
  on public.crystal_ball_season_deadlines for select to authenticated
  using (true);

-- No client write policies for deadlines.

-- ── League active competition season (T5) ───────────────────────────────────
-- Explicit persisted season — not ad hoc client clock alone.

alter table public.leagues
  add column if not exists active_competition_season_year integer;

comment on column public.leagues.active_competition_season_year is
  'D1C-S2B REVIEW-ONLY: explicit competition season year for Crystal Ball state. Preferred over now()-only derivation.';

-- ── crystal_ball_state ──────────────────────────────────────────────────────

create table if not exists public.crystal_ball_state (
  league_id uuid not null references public.leagues (id) on delete cascade,
  season_year integer not null,
  lock_at timestamptz,
  reveal_at timestamptz,
  lock_source text not null default 'unset',
  lock_reason text,
  reveal_source text,
  schedule_warning boolean not null default false,
  schedule_warning_code text,
  proposed_kickoff_at timestamptz,
  proposed_calendar_at timestamptz,
  authority_version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.profiles (id),
  updated_by uuid references public.profiles (id),
  primary key (league_id, season_year),
  constraint crystal_ball_state_reveal_lock_chk check (
    (lock_at is null and reveal_at is null)
    or (
      lock_at is not null
      and reveal_at is not null
      and reveal_at >= lock_at
    )
  ),
  constraint crystal_ball_state_lock_source_chk check (
    lock_source in (
      'unset',
      'nfl_w1_kickoff',
      'cfb_calendar',
      'cfb_w0_kickoff',
      'cfb_min_calendar_kickoff',
      'manual_ops',
      'backfill',
      'automation'
    )
  )
);

comment on table public.crystal_ball_state is
  'D1C-S2B REVIEW-ONLY: per-league per-season lock/reveal authority. Clients must not invent timestamps.';

create index if not exists crystal_ball_state_lock_at_idx
  on public.crystal_ball_state (lock_at)
  where lock_at is not null;

alter table public.crystal_ball_state enable row level security;

-- ── Deadline correction audit (pre-lock platform only) ──────────────────────

create table if not exists public.crystal_ball_deadline_corrections (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  season_year integer not null,
  old_lock_at timestamptz,
  new_lock_at timestamptz not null,
  old_reveal_at timestamptz,
  new_reveal_at timestamptz not null,
  reason text not null,
  corrected_by uuid not null references public.profiles (id),
  corrected_at timestamptz not null default now(),
  constraint crystal_ball_deadline_corrections_reason_chk
    check (length(trim(reason)) >= 8)
);

comment on table public.crystal_ball_deadline_corrections is
  'D1C-S2B REVIEW-ONLY: audited pre-lock deadline corrections by platform staff only.';

create index if not exists crystal_ball_deadline_corrections_league_idx
  on public.crystal_ball_deadline_corrections (league_id, season_year);

alter table public.crystal_ball_deadline_corrections enable row level security;

-- Platform staff may read own corrections; no client insert (RPC only).
drop policy if exists "Platform staff read deadline corrections" on public.crystal_ball_deadline_corrections;
create policy "Platform staff read deadline corrections"
  on public.crystal_ball_deadline_corrections for select to authenticated
  using (
    exists (
      select 1 from public.platform_staff ps
      where ps.user_id = auth.uid() and ps.revoked_at is null
    )
  );

-- ── Crown repair log (concept table; repair RPC not enabled in S2b) ─────────

create table if not exists public.crystal_ball_result_repair_log (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  season_year integer,
  previous_champion_team text,
  new_champion_team text not null,
  reason text not null,
  repaired_by uuid not null references public.profiles (id),
  repaired_at timestamptz not null default now(),
  constraint crystal_ball_result_repair_log_reason_chk
    check (length(trim(reason)) >= 8)
);

comment on table public.crystal_ball_result_repair_log is
  'D1C-S2B REVIEW-ONLY: schema only for future post-lock crown repair. No repair RPC in S2b.';

alter table public.crystal_ball_result_repair_log enable row level security;

-- =============================================================================
-- END 01-schema.sql — REVIEW ONLY — NON-PRODUCTION
-- =============================================================================
