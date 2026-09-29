-- Publishing and save_week_picks_atomic support weekly cards up to 30 games.
-- The original 1..10 table check rejected otherwise valid manual and weapon cards.
-- Per-card bounds and uniqueness remain enforced by save_week_picks_atomic.
begin;
set local lock_timeout = '5s';
alter table public.pick_games
  drop constraint if exists pick_games_confidence_check,
  add constraint pick_games_confidence_check check (confidence between 1 and 30);
commit;
