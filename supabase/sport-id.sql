-- Multi-sport spine: every league has a sport pack id.
-- Run once in Supabase SQL Editor (dev project first; prod only when promoting).
-- Safe to re-run.

alter table public.leagues
  add column if not exists sport_id text not null default 'cfb';

alter table public.leagues
  add column if not exists sport_settings jsonb not null default '{}'::jsonb;

comment on column public.leagues.sport_id is
  'Sport pack id: cfb, nfl, nba, march_madness, nascar, mlb, soccer, soccer_wwc, …';

comment on column public.leagues.sport_settings is
  'Pack-specific settings (competition, series, season year, week model).';

-- Existing leagues stay CFB
update public.leagues
set sport_id = 'cfb'
where sport_id is null or trim(sport_id) = '';

create index if not exists leagues_sport_id_idx
  on public.leagues (sport_id);
