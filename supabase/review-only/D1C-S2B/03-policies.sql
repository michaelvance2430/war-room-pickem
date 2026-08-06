-- =============================================================================
-- D1C-S2B / 03-policies.sql
-- REVIEW ONLY — NON-PRODUCTION — DO NOT APPLY TO LIVE SUPABASE
-- =============================================================================
-- Correlated membership + lock/reveal enforcement for crystal_ball_*.
-- NO hard-coded year/date literals.
-- NO week_results reveal branch.
-- NO m.league_id = m.league_id tautologies.
--
-- D1B DEPENDENCY (documented, not bundled):
--   Production currently has tautologous membership EXISTS on CB policies.
--   This file expresses the CORRECT D1C target predicates using is_league_member
--   when available, else correlated memberships.league_id = <row>.league_id.
--   D1B-A / D1B-B / D1B-C SQL is NOT included.
-- =============================================================================

-- ── crystal_ball_state: members read; no client write ───────────────────────

drop policy if exists "Members read crystal ball state" on public.crystal_ball_state;
create policy "Members read crystal ball state"
  on public.crystal_ball_state for select to authenticated
  using (
    public.is_league_member(crystal_ball_state.league_id)
  );

-- Intentionally no INSERT/UPDATE/DELETE policies for authenticated on state.

-- ── crystal_ball_picks ──────────────────────────────────────────────────────

drop policy if exists "Members read crystal ball" on public.crystal_ball_picks;
drop policy if exists "Members read own crystal ball" on public.crystal_ball_picks;
drop policy if exists "Members read crystal ball when frozen" on public.crystal_ball_picks;
drop policy if exists "Members read crystal ball when revealed" on public.crystal_ball_picks;
drop policy if exists "Users upsert own crystal ball" on public.crystal_ball_picks;
drop policy if exists "Users insert own crystal ball" on public.crystal_ball_picks;
drop policy if exists "Users update own crystal ball" on public.crystal_ball_picks;

create policy "Members read own crystal ball"
  on public.crystal_ball_picks for select to authenticated
  using (
    crystal_ball_picks.user_id = auth.uid()
    and public.is_league_member(crystal_ball_picks.league_id)
  );

create policy "Members read crystal ball when revealed"
  on public.crystal_ball_picks for select to authenticated
  using (
    public.is_league_member(crystal_ball_picks.league_id)
    and public.crystal_ball_is_peers_revealed(crystal_ball_picks.league_id)
  );

create policy "Users insert own crystal ball"
  on public.crystal_ball_picks for insert to authenticated
  with check (
    crystal_ball_picks.user_id = auth.uid()
    and public.is_league_member(crystal_ball_picks.league_id)
    and public.crystal_ball_is_write_open(crystal_ball_picks.league_id)
  );

create policy "Users update own crystal ball"
  on public.crystal_ball_picks for update to authenticated
  using (
    crystal_ball_picks.user_id = auth.uid()
    and public.is_league_member(crystal_ball_picks.league_id)
    and public.crystal_ball_is_write_open(crystal_ball_picks.league_id)
  )
  with check (
    crystal_ball_picks.user_id = auth.uid()
    and public.is_league_member(crystal_ball_picks.league_id)
    and public.crystal_ball_is_write_open(crystal_ball_picks.league_id)
  );

-- No client DELETE (P10 retain history)

-- ── crystal_ball_result: read members; no client write (RPC only) ───────────

drop policy if exists "Members read crystal result" on public.crystal_ball_result;
drop policy if exists "Commissioner crowns champion" on public.crystal_ball_result;

create policy "Members read crystal result"
  on public.crystal_ball_result for select to authenticated
  using (
    public.is_league_member(crystal_ball_result.league_id)
  );

-- No authenticated INSERT/UPDATE/DELETE policies — crown via RPC only.

-- =============================================================================
-- END 03-policies.sql — REVIEW ONLY — NON-PRODUCTION
-- =============================================================================
