-- ============================================================
-- Museum Phase 1A — season reset safety note
-- Optional companion to museum-phase1a-foundation.sql
--
-- reset_league_season MUST NOT delete:
--   public.museum_events
--   public.museum_event_participants
--   public.museum_allegiance_snapshots
--   public.game_final_scores
--
-- This script does not rewrite reset_league_season (multiple versions
-- exist across gazette-archive.sql / reset-season.sql / prod-promote).
-- It only documents and asserts table comments.
-- ============================================================

comment on table public.museum_events is
  'PERMANENT. Survives reset_league_season. Phase 1A inserts zero rows. No client writes.';

comment on table public.museum_event_participants is
  'PERMANENT with parent event. user_id ON DELETE SET NULL. Survives season reset.';

comment on table public.museum_allegiance_snapshots is
  'Survives season reset. Frozen rows immutable. Pre-lock replaceable only via museum_rebuild_allegiance_snapshots before freeze.';

comment on table public.game_final_scores is
  'Durable finals for Museum retry. Survives reset_league_season. NOT wiped with week_results.';
