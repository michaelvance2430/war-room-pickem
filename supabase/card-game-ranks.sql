-- Optional AP rank columns on published card games
-- Run in Supabase → SQL Editor if publish fails after adding ranks

alter table public.card_games
  add column if not exists away_rank int null,
  add column if not exists home_rank int null;
