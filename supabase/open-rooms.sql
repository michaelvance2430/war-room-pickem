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
