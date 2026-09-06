-- =============================================================================
-- Build 21 — server-owned sport season dates — REVIEW ONLY
-- =============================================================================
-- DO NOT APPLY without Mike's explicit production approval.
--
-- Purpose:
--   Keep offseason countdowns out of the app binary. Operations may publish an
--   estimated date first, then replace it with the official date without an
--   App Store release. The client visibly prefixes estimates with "~".

begin;

create table if not exists public.sport_season_windows (
  sport_id text not null
    check (sport_id in ('cfb', 'nfl', 'ncaam', 'ncaaw')),
  season_key integer not null
    check (season_key between 2020 and 2100),
  first_event_at timestamptz not null,
  season_ends_at timestamptz not null,
  timing_status text not null default 'estimated'
    check (timing_status in ('estimated', 'official')),
  display_label text,
  source_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (sport_id, season_key),
  check (season_ends_at > first_event_at)
);

comment on table public.sport_season_windows is
  'Server-owned sport season boundaries for offseason countdowns. Card-opening authority lives in sport_card_windows.';
comment on column public.sport_season_windows.first_event_at is
  'Authoritative or explicitly estimated first event used by offseason countdowns and future season-opening gates.';
comment on column public.sport_season_windows.season_ends_at is
  'End of the sport season. This prevents a future season row from locking an active current season.';
comment on column public.sport_season_windows.timing_status is
  'estimated renders visibly with ~; official renders without approximation language.';

alter table public.sport_season_windows enable row level security;

revoke all on table public.sport_season_windows from anon;
revoke insert, update, delete, truncate, references, trigger on table public.sport_season_windows from authenticated;
grant select on table public.sport_season_windows to authenticated;

drop policy if exists "Active accounts read sport season windows" on public.sport_season_windows;
create policy "Active accounts read sport season windows"
on public.sport_season_windows
for select
to authenticated
using ((select private.is_active_account()));

create table if not exists public.sport_card_windows (
  sport_id text not null
    check (sport_id in ('cfb', 'nfl', 'ncaam', 'ncaaw')),
  season_key integer not null
    check (season_key between 2020 and 2100),
  week_number integer not null
    check (week_number between 0 and 60),
  first_game_at timestamptz not null,
  timing_status text not null default 'estimated'
    check (timing_status in ('estimated', 'official')),
  display_label text,
  source_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (sport_id, season_key, week_number),
  foreign key (sport_id, season_key)
    references public.sport_season_windows (sport_id, season_key)
    on update cascade on delete cascade
);

comment on table public.sport_card_windows is
  'The actual first scheduled game for each app week. The client opens card building exactly seven days before this timestamp.';
comment on column public.sport_card_windows.first_game_at is
  'Earliest real game on the card week, not a generated offset from the season opener.';

alter table public.sport_card_windows enable row level security;

revoke all on table public.sport_card_windows from anon;
revoke insert, update, delete, truncate, references, trigger on table public.sport_card_windows from authenticated;
grant select on table public.sport_card_windows to authenticated;

drop policy if exists "Active accounts read sport card windows" on public.sport_card_windows;
create policy "Active accounts read sport card windows"
on public.sport_card_windows
for select
to authenticated
using ((select private.is_active_account()));

commit;

-- Intentionally no seed rows. Dates are product authority and must be entered
-- deliberately with a source and the correct estimated/official status.
