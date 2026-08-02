-- Career trophy case: let any authenticated user read engraved plaques
-- that have a linked winner (winner_user_id). Room members still read
-- their full Trophy Room via the existing membership policy.
--
-- Enables multi-league showcase: win 3 CFB rooms → 3 plaques on profile
-- for anyone viewing that profile (not only co-members of every room).
--
-- Run once in Supabase SQL Editor (safe to re-run).

drop policy if exists "Read trophies by linked winner" on public.league_trophies;
create policy "Read trophies by linked winner"
  on public.league_trophies for select to authenticated
  using (winner_user_id is not null);

-- Helpful index for career loads
create index if not exists league_trophies_winner_user_idx
  on public.league_trophies (winner_user_id)
  where winner_user_id is not null;
