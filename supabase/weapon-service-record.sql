-- War Room permanent Weapon Service Record
-- Additive only: creates an account-wide, cross-season authorization ledger.
-- Foundry leagues are never eligible. Clients receive SELECT only.

begin;

create table if not exists public.weapon_service_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  league_id uuid not null,
  league_name text not null check (char_length(btrim(league_name)) between 1 and 120),
  sport_id text not null check (sport_id in ('cfb', 'nfl', 'cbb')),
  season_year integer not null check (season_year between 2000 and 2100),
  week_number integer null check (week_number between 0 and 30),
  weapon_type text not null check (weapon_type in ('tactical_nuke', 'dead_hand', 'jdam', 'hellfire')),
  phase text not null check (phase in ('regular_season', 'postseason')),
  source_event_id text not null check (char_length(btrim(source_event_id)) between 8 and 200),
  protocol_version integer not null default 1 check (protocol_version > 0),
  authorization_status text not null default 'authorized'
    check (authorization_status in ('authorized', 'resolved', 'voided_by_admin')),
  raw_points integer null,
  adjusted_points integer null,
  decisions_changed integer null check (decisions_changed is null or decisions_changed >= 0),
  outcome text null check (outcome is null or outcome in ('success', 'failure', 'mixed')),
  authorized_at timestamptz not null default now(),
  resolved_at timestamptz null,
  fact_payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint weapon_service_events_source_event_id_key unique (source_event_id),
  constraint weapon_service_events_weapon_sport_check check (
    (weapon_type = 'tactical_nuke' and phase = 'regular_season')
    or (weapon_type = 'dead_hand' and sport_id = 'cfb' and phase = 'postseason')
    or (weapon_type = 'jdam' and sport_id = 'nfl' and phase in ('regular_season','postseason'))
    or (weapon_type = 'hellfire' and sport_id = 'cbb' and phase = 'postseason')
  )
);

comment on table public.weapon_service_events is
  'Permanent account-wide weapon authorization ledger. Append-only in normal operation; admin voids are new events/status, not client edits.';
comment on column public.weapon_service_events.source_event_id is
  'Server-generated idempotency key tied to the authoritative pick/bracket lock transaction.';
comment on column public.weapon_service_events.fact_payload is
  'Non-authoritative narrative facts only. Competitive truth remains in picks, brackets, and results tables.';

create index if not exists weapon_service_events_user_authorized_idx
  on public.weapon_service_events (user_id, authorized_at desc);
create index if not exists weapon_service_events_user_weapon_idx
  on public.weapon_service_events (user_id, weapon_type, authorized_at desc);
create index if not exists weapon_service_events_league_season_idx
  on public.weapon_service_events (league_id, season_year, authorized_at desc);

alter table public.weapon_service_events enable row level security;

drop policy if exists "Players can read their own weapon service record"
  on public.weapon_service_events;
create policy "Players can read their own weapon service record"
  on public.weapon_service_events
  for select
  to authenticated
  using ((select auth.uid()) = user_id);

revoke all on table public.weapon_service_events from public, anon, authenticated;
grant select on table public.weapon_service_events to authenticated;
grant select, insert, update, delete on table public.weapon_service_events to service_role;

-- Superseded by the profile-safe totals read model below.
drop function if exists public.get_weapon_service_summaries(uuid[]);

-- Profiles expose totals from a separate read model, never event details.
create table if not exists public.weapon_service_totals (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  tactical_nukes integer not null default 0 check (tactical_nukes >= 0),
  dead_hands integer not null default 0 check (dead_hands >= 0),
  jdams integer not null default 0 check (jdams >= 0),
  hellfires integer not null default 0 check (hellfires >= 0),
  campaigns integer not null default 0 check (campaigns >= 0),
  total_authorizations integer not null default 0 check (total_authorizations >= 0),
  updated_at timestamptz not null default now()
);

comment on table public.weapon_service_totals is
  'Profile-safe weapon totals only. Contains no league, week, date, outcome, points, or narrative payload.';

alter table public.weapon_service_totals enable row level security;
drop policy if exists "Authenticated users can read profile weapon totals"
  on public.weapon_service_totals;
create policy "Authenticated users can read profile weapon totals"
  on public.weapon_service_totals for select to authenticated using (true);
revoke all on table public.weapon_service_totals from public, anon, authenticated;
grant select on table public.weapon_service_totals to authenticated;
grant select, insert, update, delete on table public.weapon_service_totals to service_role;

create or replace function public.refresh_weapon_service_totals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.weapon_service_totals (
    user_id, tactical_nukes, dead_hands, jdams, hellfires,
    campaigns, total_authorizations, updated_at
  )
  select
    new.user_id,
    count(*) filter (where e.weapon_type = 'tactical_nuke'),
    count(*) filter (where e.weapon_type = 'dead_hand'),
    count(*) filter (where e.weapon_type = 'jdam'),
    count(*) filter (where e.weapon_type = 'hellfire'),
    count(distinct (e.sport_id, e.season_year)),
    count(*),
    now()
  from public.weapon_service_events e
  where e.user_id = new.user_id
    and e.authorization_status <> 'voided_by_admin'
  on conflict (user_id) do update set
    tactical_nukes = excluded.tactical_nukes,
    dead_hands = excluded.dead_hands,
    jdams = excluded.jdams,
    hellfires = excluded.hellfires,
    campaigns = excluded.campaigns,
    total_authorizations = excluded.total_authorizations,
    updated_at = excluded.updated_at;
  return new;
end;
$$;

revoke all on function public.refresh_weapon_service_totals() from public, anon, authenticated;
grant execute on function public.refresh_weapon_service_totals() to service_role;

drop trigger if exists weapon_service_events_refresh_totals_trg
  on public.weapon_service_events;
create trigger weapon_service_events_refresh_totals_trg
after insert or update of authorization_status
on public.weapon_service_events
for each row execute function public.refresh_weapon_service_totals();

-- Direct client mutation is intentionally impossible. A live weapon's future
-- server-authoritative lock RPC inserts the event in the same transaction as
-- its picks/bracket. Foundry never calls that RPC and never reaches this table.

commit;
