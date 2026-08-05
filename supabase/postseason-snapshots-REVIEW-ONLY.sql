-- ============================================================
-- POSTSEASON SNAPSHOTS — REVIEW ONLY (Stage PS0)
-- ============================================================
-- DO NOT RUN against production until explicitly authorized.
-- DO NOT apply as part of normal deploy without Mike review.
--
-- Purpose: Durable cut freeze for Championship / Toilet Bowl fields.
-- Law: docs/POSTSEASON-COMPETITION-LAW.md
-- Design: docs/POSTSEASON-SNAPSHOT-DESIGN.md
--
-- Idempotent: safe to re-run once authorized (IF NOT EXISTS patterns).
-- Ordinary app SELECTs must never INSERT/UPDATE these tables without
-- freeze_postseason_if_absent / repair_postseason_snapshot RPCs (PS1).
-- ============================================================

-- ─── Header ─────────────────────────────────────────────────
create table if not exists public.league_postseason_snapshots (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  -- Align with trophy season_year practice; text allows sport-scoped keys later
  season_key text not null,
  sport_id text not null default 'cfb',
  cut_week int not null check (cut_week >= 0 and cut_week <= 40),
  frozen_at timestamptz not null default now(),
  cut_percent int not null check (cut_percent >= 0 and cut_percent <= 100),
  eligible_human_count int not null check (eligible_human_count >= 0),
  qualifier_count int not null check (qualifier_count >= 0),
  toilet_bowl_active boolean not null default false,
  snapshot_version int not null default 1 check (snapshot_version >= 1),
  creation_reason text not null check (
    creation_reason in (
      'cut_week_scored',
      'manual_repair',
      'system_backfill'
    )
  ),
  created_by uuid references public.profiles (id) on delete set null,
  supersedes_snapshot_id uuid references public.league_postseason_snapshots (id) on delete set null,
  repair_note text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One active snapshot identity per league/season for ordinary readers.
  -- Repair may bump version in place OR insert new row; unique keeps one current.
  unique (league_id, season_key),
  constraint league_postseason_snapshots_repair_note_chk check (
    creation_reason <> 'manual_repair'
    or (repair_note is not null and length(trim(repair_note)) > 0)
  ),
  constraint league_postseason_snapshots_qualifier_vs_humans_chk check (
    qualifier_count <= eligible_human_count
  )
);

create index if not exists league_postseason_snapshots_league_idx
  on public.league_postseason_snapshots (league_id, season_key);

comment on table public.league_postseason_snapshots is
  'PS0/PS1: Authoritative cut freeze. Ordinary reads never create rows. REVIEW-ONLY migration until authorized.';

-- ─── Participants ───────────────────────────────────────────
create table if not exists public.league_postseason_participants (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null
    references public.league_postseason_snapshots (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  display_name_snapshot text not null,
  field text not null check (field in ('championship', 'toilet', 'eliminated')),
  seed int check (seed is null or seed >= 1),
  first_round_bye boolean not null default false,
  division_snapshot text,
  standings_rank_at_cut int,
  season_points_at_cut numeric,
  created_at timestamptz not null default now(),
  unique (snapshot_id, user_id, field)
);

create index if not exists league_postseason_participants_snapshot_idx
  on public.league_postseason_participants (snapshot_id, field, seed);

-- Same person cannot be in championship AND toilet for one snapshot.
-- (eliminated is mutually exclusive with both in app logic; DB enforces champ∩toilet)
create unique index if not exists league_postseason_participants_no_dual_field_uidx
  on public.league_postseason_participants (snapshot_id, user_id)
  where field in ('championship', 'toilet');

comment on table public.league_postseason_participants is
  'Frozen championship / toilet / eliminated humans. No bots. Seeds + R1 bye flags.';

-- ─── Repair audit log (append-only) ─────────────────────────
create table if not exists public.league_postseason_repair_log (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  season_key text not null,
  snapshot_id uuid references public.league_postseason_snapshots (id) on delete set null,
  actor_user_id uuid references public.profiles (id) on delete set null,
  from_version int,
  to_version int,
  repair_note text not null,
  before_fingerprint jsonb not null default '{}'::jsonb,
  after_fingerprint jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists league_postseason_repair_log_league_idx
  on public.league_postseason_repair_log (league_id, season_key, created_at desc);

comment on table public.league_postseason_repair_log is
  'Append-only intentional repair audit. Never written by page load or re-score.';

-- ─── RLS ────────────────────────────────────────────────────
alter table public.league_postseason_snapshots enable row level security;
alter table public.league_postseason_participants enable row level security;
alter table public.league_postseason_repair_log enable row level security;

-- Members read snapshots
drop policy if exists "Members read postseason snapshots"
  on public.league_postseason_snapshots;
create policy "Members read postseason snapshots"
  on public.league_postseason_snapshots
  for select
  to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.league_id = league_postseason_snapshots.league_id
        and m.user_id = auth.uid()
    )
  );

-- No direct INSERT/UPDATE/DELETE for authenticated clients.
-- PS1: security definer RPCs only (freeze_postseason_if_absent, repair_postseason_snapshot).
-- Intentionally omit write policies so default deny holds under RLS.

drop policy if exists "Members read postseason participants"
  on public.league_postseason_participants;
create policy "Members read postseason participants"
  on public.league_postseason_participants
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.league_postseason_snapshots s
      join public.memberships m on m.league_id = s.league_id
      where s.id = league_postseason_participants.snapshot_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "Members read postseason repair log"
  on public.league_postseason_repair_log;
create policy "Members read postseason repair log"
  on public.league_postseason_repair_log
  for select
  to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.league_id = league_postseason_repair_log.league_id
        and m.user_id = auth.uid()
    )
  );

-- Grants: select only for authenticated (writes via future security definer)
grant select on public.league_postseason_snapshots to authenticated;
grant select on public.league_postseason_participants to authenticated;
grant select on public.league_postseason_repair_log to authenticated;

-- ============================================================
-- ROLLBACK SQL (run only if this migration was applied and must be undone)
-- ============================================================
-- drop policy if exists "Members read postseason repair log" on public.league_postseason_repair_log;
-- drop policy if exists "Members read postseason participants" on public.league_postseason_participants;
-- drop policy if exists "Members read postseason snapshots" on public.league_postseason_snapshots;
-- drop table if exists public.league_postseason_repair_log;
-- drop table if exists public.league_postseason_participants;
-- drop table if exists public.league_postseason_snapshots;
-- ============================================================
