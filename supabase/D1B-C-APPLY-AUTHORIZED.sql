-- =============================================================================
-- D1B-C APPLY — AUTHORIZED (Mike explicit D1B-C-only authorization)
-- =============================================================================
-- Scope: REPLACE exactly one policy.
--   public.achievements — "Members read achievements" (SELECT)
--
-- USING: public.is_league_member(achievements.league_id)
--
-- PRESERVE: "Commissioner grants achievements" INSERT — do not drop/recreate.
-- Uses existing public.is_league_member(uuid) UNCHANGED.
--
-- DOES NOT: data DML · helper · grants · indexes · app ·
--           D1B-A · D1B-B · D1C · H-01
--
-- Preflight: docs/D1B-C-PREFLIGHT-AND-APPLY-SCOPE.md §0 LIVE PASS
-- =============================================================================

begin;

drop policy if exists "Members read achievements" on public.achievements;
create policy "Members read achievements"
  on public.achievements
  for select
  to authenticated
  using (public.is_league_member(achievements.league_id));

commit;

notify pgrst, 'reload schema';

-- END D1B-C APPLY
