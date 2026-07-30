-- Home page tagline (commissioner-selectable)
-- Run once in Supabase → SQL Editor → Run

alter table public.leagues
  add column if not exists home_tagline_id text not null default 'good-teams';

alter table public.leagues
  add column if not exists home_tagline_custom text not null default '';
