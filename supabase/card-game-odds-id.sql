-- Optional: store The Odds API event id for reliable auto-scoring
-- Run in Supabase → SQL Editor

alter table public.card_games
  add column if not exists odds_event_id text null;

create index if not exists card_games_odds_event_idx
  on public.card_games (odds_event_id);
