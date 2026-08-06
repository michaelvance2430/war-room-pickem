-- =============================================================================
-- D1B-A — picks / pick_games membership correlation — REVIEW ONLY / APPLY TWIN
-- =============================================================================
-- Mike authorized D1B-A-only apply. Prefer: supabase/D1B-A-APPLY-AUTHORIZED.sql
-- (identical policy body). DO NOT expand scope beyond these two policies.
-- Design: docs/D1B-A-PICKS-MEMBERSHIP-CORRELATION.md
--
-- SCOPE (policy-only on two policies):
--   1) Replace "Users manage own picks"
--   2) Replace "Users manage own pick_games"
-- Both USING and WITH CHECK: self ownership + current league membership
-- pick_games correlates via parent picks + is_league_member(p.league_id)
--
-- Uses existing public.is_league_member(uuid) — NO helper create/replace/grants.
--
-- PRESERVE (do not drop): Members view league picks, Members read pick_games,
-- Ops/commissioner score-read policies from deputy-ops.
--
-- DOES NOT: grants · functions · triggers · indexes · app · historical rows ·
--           D1B-B · D1B-C · H-01 · D1C · bot/reset redesign
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

-- =============================================================================
-- POST-VERIFY (SELECT only — run separately)
-- =============================================================================
-- SELECT policyname, cmd, qual, with_check FROM pg_policies
-- WHERE schemaname='public' AND tablename IN ('picks','pick_games')
--   AND policyname IN ('Users manage own picks','Users manage own pick_games');
-- -- Expect is_league_member in both
--
-- SELECT policyname FROM pg_policies
-- WHERE schemaname='public' AND tablename='picks'
--   AND policyname ILIKE '%member%view%' OR policyname ILIKE '%ops%';
-- -- Expect mate/ops SELECT policies still present

-- ROLLBACK: restore schema.sql manage-own (auth.uid only) — reopens cross-league write

-- END D1B-A REVIEW-ONLY
