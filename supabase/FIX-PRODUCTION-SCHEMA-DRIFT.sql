-- ============================================================
-- FIX-PRODUCTION-SCHEMA-DRIFT.sql
-- War Room Pick'Em — production schema drift (probed 2026-08-02)
--
-- Project: dorhjepugsjpmnuzdzck (confirm before run)
--
-- Fixes browser failures:
--   GET  platform_status          → 404
--   POST rpc/get_league_roster    → 404
--   GET  memberships + leagues()  → 400 (missing leagues.* cols)
--   GET  leagues                  → 400 (same missing cols)
--
-- SAFE:
--   - Idempotent (IF NOT EXISTS / CREATE OR REPLACE)
--   - No DROP TABLE / no DELETE of user data
--   - No destructive column drops
--
-- DO NOT auto-run from CI. Paste into Supabase → SQL Editor → Run
-- as a privileged role (postgres / service).
-- ============================================================

begin;

-- ------------------------------------------------------------
-- 1) platform_status  (from platform-status.sql)
-- ------------------------------------------------------------
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

drop policy if exists "platform_status_select_all" on public.platform_status;
create policy "platform_status_select_all"
  on public.platform_status for select
  to anon, authenticated
  using (true);

drop policy if exists "platform_status_update_auth" on public.platform_status;
create policy "platform_status_update_auth"
  on public.platform_status for update
  to authenticated
  using (id = 1)
  with check (id = 1);

-- ------------------------------------------------------------
-- 2) leagues columns required by session-restore + league-sync
--    (home-tagline.sql, season-theme.sql, blue-falcon-open-nudge.sql)
-- ------------------------------------------------------------
alter table public.leagues
  add column if not exists home_tagline_id text not null default 'good-teams';

alter table public.leagues
  add column if not exists home_tagline_custom text not null default '';

alter table public.leagues
  add column if not exists season_theme_id text not null default 'default';

comment on column public.leagues.season_theme_id is
  'App background theme: default | halloween | thanksgiving | christmas | newyear | cfb skins…';

alter table public.leagues
  add column if not exists open_room_nudge_pending boolean not null default false;

alter table public.leagues
  add column if not exists open_room_nudge_left_name text;

alter table public.leagues
  add column if not exists open_room_nudge_at timestamptz;

-- Already present on prod (probed OK) — kept for idempotent full environments
alter table public.leagues
  add column if not exists crystal_ball_enabled boolean not null default true;

alter table public.leagues
  add column if not exists sport_id text not null default 'cfb';

alter table public.leagues
  add column if not exists is_open boolean not null default false;

-- ------------------------------------------------------------
-- 3) memberships staff flags (already OK on prod; idempotent)
--    (deputy-ops.sql / moderation.sql)
-- ------------------------------------------------------------
alter table public.memberships
  add column if not exists is_moderator boolean not null default false;

alter table public.memberships
  add column if not exists locker_muted boolean not null default false;

alter table public.memberships
  add column if not exists is_deputy boolean not null default false;

alter table public.memberships
  add column if not exists is_bot boolean not null default false;

-- ------------------------------------------------------------
-- 4) profiles.blue_falcon_count (same migration as open-room nudge)
-- ------------------------------------------------------------
alter table public.profiles
  add column if not exists blue_falcon_count int not null default 0;

comment on column public.profiles.blue_falcon_count is
  'Times this account left a league before finishing the season (Blue Falcon Count).';

-- ------------------------------------------------------------
-- 5) get_league_roster (preferred shape from deputy-ops.sql)
--    Requires: memberships flags + profiles.display_name/avatar_url
-- ------------------------------------------------------------
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

revoke all on function public.get_league_roster(uuid) from public;
grant execute on function public.get_league_roster(uuid) to authenticated;

-- ------------------------------------------------------------
-- 6) Force PostgREST to pick up new table/columns/RPC
-- ------------------------------------------------------------
notify pgrst, 'reload schema';

commit;

-- ============================================================
-- VERIFY (run separately after commit; optional)
-- ============================================================
-- select to_regclass('public.platform_status');
-- select proname from pg_proc where proname = 'get_league_roster';
-- select column_name from information_schema.columns
--   where table_schema='public' and table_name='leagues'
--   and column_name in (
--     'home_tagline_id','home_tagline_custom','season_theme_id',
--     'open_room_nudge_pending','open_room_nudge_left_name','open_room_nudge_at'
--   );
-- ============================================================
