-- Commissioner toggle: enable/disable Crystal Ball per league
-- Run in Supabase → SQL Editor → Run once

alter table public.leagues
  add column if not exists crystal_ball_enabled boolean not null default true;
