-- =============================================================================
-- D1B-C — achievements SELECT league correlation — REVIEW ONLY / APPLY TWIN
-- =============================================================================
-- Mike authorized D1B-C-only apply. Prefer: supabase/D1B-C-APPLY-AUTHORIZED.sql
-- Design: docs/D1B-C-ACHIEVEMENTS-VISIBILITY.md
--
-- SCOPE: Replace ONLY "Members read achievements" SELECT policy.
-- Rule: authenticated may read achievements only when currently a member
--       of that achievement row's league (via is_league_member).
--
-- Uses existing public.is_league_member(uuid) — NO helper changes.
--
-- DOES NOT: mutate achievement rows · commissioner INSERT policy ·
--           crystal_ball policies (D1C) · D1B-A/B · indexes · app
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

-- =============================================================================
-- POST-VERIFY (SELECT only)
-- =============================================================================
-- SELECT policyname, cmd, qual, with_check FROM pg_policies
-- WHERE schemaname='public' AND tablename='achievements'
-- ORDER BY policyname;
-- -- Expect Members read uses is_league_member; Commissioner grants unchanged
-- -- Expect NO m.league_id = m.league_id tautology

-- ROLLBACK: restore prior tautology policy from crystal-ball-full.sql (undesired)

-- END D1B-C REVIEW-ONLY
