-- =============================================================================
-- SUPERSEDED — DO NOT APPLY
-- =============================================================================
-- This combined migration is SUPERSEDED by split stages:
--   D1A-league-delete-lockdown-REVIEW-ONLY.sql
--   D1B-membership-correlation-REVIEW-ONLY.sql
--   D1C-crystal-ball-lock-REVIEW-ONLY.sql (blocked until lock design proven)
-- See docs/STRUCTURAL-HARDENING-D0-RLS.md (revised).
-- =============================================================================
-- D0 RLS CORRECTIONS — REVIEW ONLY — DO NOT APPLY WITHOUT MIKE AUTHORIZATION
-- =============================================================================
-- Structural Hardening D0 (legacy combined draft)
--
-- INTENT:
--   1) Remove authenticated commissioner DELETE on public.leagues
--   2) Fix membership correlation tautologies (qualify outer table league_id)
--   3) Require league membership for picks / pick_games writes
--   4) Crystal Ball: correlated membership; remove hardcoded 2026 freezes
--   5) Preserve sport immutability trigger (not dropped)
--   6) Preserve deputy/ops policies (is_league_ops) — not dropped
--   7) Do NOT touch league_trophies, profiles discovery, gazette, locker
--
-- SAFE TO RE-RUN: yes (DROP POLICY IF EXISTS + CREATE; CREATE OR REPLACE fn)
--
-- DOES NOT:
--   - Execute itself (you must paste when authorized)
--   - Mutate application code
--   - Lift Foundry quarantine
--
-- BEFORE APPLY: run D0-rls-preflight-SELECT-ONLY.sql and archive results.
-- AFTER APPLY: run verification SELECTs at bottom (uncomment).
-- ROLLBACK: D0-rls-corrections-ROLLBACK.sql
-- =============================================================================

begin;

-- ─────────────────────────────────────────────────────────────────────────────
-- Helper: Crystal Ball board reveal (season/sport-safe; NO hardcoded calendar)
-- Reveal when crowned OR opening week scored (CFB week 0 / NFL week 1).
-- Calendar freezes require a future authoritative season function — fail-closed.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.crystal_ball_board_is_revealed(p_league_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select
    exists (
      select 1
      from public.crystal_ball_result r
      where r.league_id = p_league_id
    )
    or exists (
      select 1
      from public.week_results wr
      join public.leagues l on l.id = wr.league_id
      where wr.league_id = p_league_id
        and wr.week_number = case
          when coalesce(l.sport_id, 'cfb') = 'nfl' then 1
          else 0
        end
    );
$$;

comment on function public.crystal_ball_board_is_revealed(uuid) is
  'D0: true when CB peer board may be read — crowned or opening week scored. No hardcoded year calendar. INVOKER.';

revoke all on function public.crystal_ball_board_is_revealed(uuid) from public;
grant execute on function public.crystal_ball_board_is_revealed(uuid) to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1) LEAGUES — remove client DELETE; keep insert/update paths
-- ═══════════════════════════════════════════════════════════════════════════

-- POLICY: Remove ability for commissioners (or any authenticated role) to
-- DELETE league rows via PostgREST. CASCADE would destroy memberships,
-- cards, picks, results. Product delete must be a future audited RPC.
drop policy if exists "Commissioner deletes league" on public.leagues;

-- Defense: drop any other authenticated DELETE policies on leagues by name
-- variants if present (preflight may show extras).
drop policy if exists "Users delete own league" on public.leagues;
drop policy if exists "leagues_delete_commissioner" on public.leagues;

-- NOTE: We intentionally do NOT create a new DELETE policy.
-- INSERT "Users create leagues" and UPDATE "Ops update league" (deputy-ops)
-- remain as live; this migration does not recreate them (avoid clobbering
-- live wording). If preflight shows ONLY "Commissioner updates league" and
-- no Ops policy, leave it — D0 does not drop UPDATE policies.

-- Sport immutability trigger: DO NOT DROP. Self-check only (select in verify).

-- ═══════════════════════════════════════════════════════════════════════════
-- 2) ACHIEVEMENTS — fix membership correlation
-- ═══════════════════════════════════════════════════════════════════════════

-- POLICY: Members may SELECT achievements only for leagues they belong to.
-- Outer table must be qualified so the planner cannot collapse to
-- m.league_id = m.league_id.
drop policy if exists "Members read achievements" on public.achievements;
create policy "Members read achievements"
  on public.achievements
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.memberships m
      where m.league_id = achievements.league_id
        and m.user_id = auth.uid()
    )
  );

-- POLICY: Commissioner may INSERT achievements for their league only.
drop policy if exists "Commissioner grants achievements" on public.achievements;
create policy "Commissioner grants achievements"
  on public.achievements
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.leagues l
      where l.id = achievements.league_id
        and l.commissioner_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 3) CRYSTAL BALL PICKS — correlation + freeze without hardcoded years
-- ═══════════════════════════════════════════════════════════════════════════

drop policy if exists "Members read crystal ball" on public.crystal_ball_picks;
drop policy if exists "Members read own crystal ball" on public.crystal_ball_picks;
drop policy if exists "Members read crystal ball when frozen" on public.crystal_ball_picks;
drop policy if exists "Users upsert own crystal ball" on public.crystal_ball_picks;
drop policy if exists "Users update own crystal ball" on public.crystal_ball_picks;

-- POLICY: Always allow a member to read their own CB pick (secret season).
create policy "Members read own crystal ball"
  on public.crystal_ball_picks
  for select
  to authenticated
  using (
    crystal_ball_picks.user_id = auth.uid()
    and exists (
      select 1
      from public.memberships m
      where m.league_id = crystal_ball_picks.league_id
        and m.user_id = auth.uid()
    )
  );

-- POLICY: After reveal (crown or opening week scored), members may read the
-- full permanent board for their league. No hardcoded 2026 timestamps.
create policy "Members read crystal ball when revealed"
  on public.crystal_ball_picks
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.memberships m
      where m.league_id = crystal_ball_picks.league_id
        and m.user_id = auth.uid()
    )
    and public.crystal_ball_board_is_revealed(crystal_ball_picks.league_id)
  );

-- POLICY: Insert own pick only while member and board not yet revealed.
create policy "Users insert own crystal ball"
  on public.crystal_ball_picks
  for insert
  to authenticated
  with check (
    crystal_ball_picks.user_id = auth.uid()
    and exists (
      select 1
      from public.memberships m
      where m.league_id = crystal_ball_picks.league_id
        and m.user_id = auth.uid()
    )
    and not public.crystal_ball_board_is_revealed(crystal_ball_picks.league_id)
  );

-- POLICY: Update own pick only while member and board not yet revealed.
create policy "Users update own crystal ball"
  on public.crystal_ball_picks
  for update
  to authenticated
  using (
    crystal_ball_picks.user_id = auth.uid()
    and exists (
      select 1
      from public.memberships m
      where m.league_id = crystal_ball_picks.league_id
        and m.user_id = auth.uid()
    )
    and not public.crystal_ball_board_is_revealed(crystal_ball_picks.league_id)
  )
  with check (
    crystal_ball_picks.user_id = auth.uid()
    and exists (
      select 1
      from public.memberships m
      where m.league_id = crystal_ball_picks.league_id
        and m.user_id = auth.uid()
    )
    and not public.crystal_ball_board_is_revealed(crystal_ball_picks.league_id)
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 4) CRYSTAL BALL RESULT — correlated membership + commish crown
-- ═══════════════════════════════════════════════════════════════════════════

drop policy if exists "Members read crystal result" on public.crystal_ball_result;
create policy "Members read crystal result"
  on public.crystal_ball_result
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.memberships m
      where m.league_id = crystal_ball_result.league_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "Commissioner crowns champion" on public.crystal_ball_result;
create policy "Commissioner crowns champion"
  on public.crystal_ball_result
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.leagues l
      where l.id = crystal_ball_result.league_id
        and l.commissioner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.leagues l
      where l.id = crystal_ball_result.league_id
        and l.commissioner_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 5) PICKS — own manage requires membership in target league
-- ═══════════════════════════════════════════════════════════════════════════

-- POLICY: Player may manage only their own pick rows AND only when they are
-- a member of that row's league_id. Prevents cross-league pick injection.
-- Ops read/score policies (deputy-ops) remain separate and OR with this.
drop policy if exists "Users manage own picks" on public.picks;
create policy "Users manage own picks"
  on public.picks
  for all
  to authenticated
  using (
    picks.user_id = auth.uid()
    and exists (
      select 1
      from public.memberships m
      where m.league_id = picks.league_id
        and m.user_id = auth.uid()
    )
  )
  with check (
    picks.user_id = auth.uid()
    and exists (
      select 1
      from public.memberships m
      where m.league_id = picks.league_id
        and m.user_id = auth.uid()
    )
  );

-- Do NOT drop "Ops read league picks" / "Ops score picks" / commissioner
-- variants — required for weekly scoring. Preflight must list them.

-- ═══════════════════════════════════════════════════════════════════════════
-- 6) PICK_GAMES — own manage via own pick + membership
-- ═══════════════════════════════════════════════════════════════════════════

drop policy if exists "Users manage own pick_games" on public.pick_games;
create policy "Users manage own pick_games"
  on public.pick_games
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.picks p
      join public.memberships m
        on m.league_id = p.league_id
       and m.user_id = auth.uid()
      where p.id = pick_games.pick_id
        and p.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from public.picks p
      join public.memberships m
        on m.league_id = p.league_id
       and m.user_id = auth.uid()
      where p.id = pick_games.pick_id
        and p.user_id = auth.uid()
    )
  );

-- Do NOT drop "Ops read league pick_games".

commit;

notify pgrst, 'reload schema';

-- =============================================================================
-- POST-APPLY VERIFICATION (uncomment and run after apply)
-- =============================================================================
-- SELECT tablename, policyname, cmd, qual, with_check
-- FROM pg_policies
-- WHERE schemaname = 'public'
--   AND tablename IN (
--     'leagues','picks','pick_games','achievements',
--     'crystal_ball_picks','crystal_ball_result'
--   )
-- ORDER BY tablename, policyname;
--
-- -- Expect ZERO league DELETE policies for authenticated:
-- SELECT policyname FROM pg_policies
-- WHERE schemaname='public' AND tablename='leagues' AND cmd='DELETE';
--
-- -- Expect ZERO tautologies:
-- SELECT tablename, policyname FROM pg_policies
-- WHERE schemaname='public'
--   AND (coalesce(qual,'') ~* 'm\.league_id\s*=\s*m\.league_id'
--     OR coalesce(with_check,'') ~* 'm\.league_id\s*=\s*m\.league_id');
--
-- -- Expect ZERO hardcoded 2026 freezes in crystal policies:
-- SELECT policyname FROM pg_policies
-- WHERE schemaname='public' AND tablename LIKE 'crystal_ball%'
--   AND (coalesce(qual,'') LIKE '%2026%' OR coalesce(with_check,'') LIKE '%2026%');
--
-- -- Sport immutability still present:
-- SELECT tgname, tgenabled FROM pg_trigger
-- WHERE tgname = 'leagues_sport_id_immutable_trg';
--
-- -- Deputy ops still present:
-- SELECT policyname, tablename FROM pg_policies
-- WHERE schemaname='public' AND qual ILIKE '%is_league_ops%';

-- END D0 REVIEW-ONLY MIGRATION
