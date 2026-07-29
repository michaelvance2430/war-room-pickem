-- Allow full CFB calendar: Week 0 … CFP Final (app week 18)
-- Run in Supabase → SQL Editor → New query → Run
-- Fixes: leagues_regular_season_weeks_check (was max 16)

alter table public.leagues
  drop constraint if exists leagues_regular_season_weeks_check;

alter table public.leagues
  add constraint leagues_regular_season_weeks_check
  check (regular_season_weeks between 4 and 24);
