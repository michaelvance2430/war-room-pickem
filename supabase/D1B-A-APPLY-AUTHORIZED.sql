-- =============================================================================
-- D1B-A APPLY — AUTHORIZED (Mike explicit D1B-A-only authorization)
-- =============================================================================
-- Scope: REPLACE exactly two policies. Nothing else.
--   1) public.picks  — "Users manage own picks"
--   2) public.pick_games — "Users manage own pick_games"
--
-- Uses existing public.is_league_member(uuid) UNCHANGED.
-- Does NOT: helper redefine/grants · data DML · indexes · app ·
--           D1B-B · D1B-C · D1C · H-01 · other picks/pick_games policies
--
-- Design: docs/D1B-A-PICKS-MEMBERSHIP-CORRELATION.md
-- Preflight: docs/D1B-A-PREFLIGHT-AND-APPLY-SCOPE.md §0 LIVE PASS
-- =============================================================================

begin;

drop policy if exists "Users manage own picks" on public.picks;
create policy "Users manage own picks"
  on public.picks
  for all
  to authenticated
  using (
    user_id = auth.uid()
    and public.is_league_member(league_id)
  )
  with check (
    user_id = auth.uid()
    and public.is_league_member(league_id)
  );

drop policy if exists "Users manage own pick_games" on public.pick_games;
create policy "Users manage own pick_games"
  on public.pick_games
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.picks p
      where p.id = pick_games.pick_id
        and p.user_id = auth.uid()
        and public.is_league_member(p.league_id)
    )
  )
  with check (
    exists (
      select 1
      from public.picks p
      where p.id = pick_games.pick_id
        and p.user_id = auth.uid()
        and public.is_league_member(p.league_id)
    )
  );

commit;

notify pgrst, 'reload schema';

-- END D1B-A APPLY
