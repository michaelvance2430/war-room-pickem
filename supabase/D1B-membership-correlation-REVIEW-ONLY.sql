-- =============================================================================
-- D1B — Membership-correlation repairs — REVIEW ONLY
-- =============================================================================
-- DO NOT APPLY without Mike authorization.
-- Prefer ephemeral/isolated Supabase — project has no proven staging today.
--
-- SCOPE:
--   - Fix membership tautologies (qualify outer table league_id)
--   - Require membership for picks / pick_games writes
--   - Crystal Ball: membership correlation ONLY (no deadline/reveal rewrite)
--
-- OUT OF SCOPE (D1A / D1C / other):
--   - leagues DELETE (D1A)
--   - Crystal Ball lock/reveal/write-open rules (D1C)
--   - Hardcoded freeze removal (D1C)
--   - trophies, profiles discovery, gazette, locker
--   - deputy/ops policies (PRESERVE — do not drop is_league_ops policies)
--
-- IDEMPOTENT: DROP IF EXISTS + CREATE
-- PREREQ: D1A optional but recommended first (independent).
-- =============================================================================

begin;

-- ═══════════════════════════════════════════════════════════════════════════
-- ACHIEVEMENTS — correlated membership
-- ═══════════════════════════════════════════════════════════════════════════

-- POLICY: Members SELECT achievements only for leagues they belong to.
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

-- POLICY: Commissioner INSERT achievements for own league only.
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
-- CRYSTAL BALL — membership correlation ONLY (deadlines unchanged in D1B)
-- ═══════════════════════════════════════════════════════════════════════════
-- NOTE: If live still has hardcoded 2026 freezes, D1B rewrites SELECT/write
-- policies with CORRECT membership but PRESERVES prior freeze OR-clauses only
-- if still present in preflight. Safer path: rewrite membership + keep freeze
-- expressions as documented transitional risk until D1C.
--
-- D1B minimal: fix membership correlation on all CB policies; leave freeze
-- structure as in crystal-ball-privacy.sql but with qualified league_id.
-- Do NOT introduce score-as-reveal. Do NOT invent new freezes.

drop policy if exists "Members read crystal ball" on public.crystal_ball_picks;
drop policy if exists "Members read own crystal ball" on public.crystal_ball_picks;
drop policy if exists "Members read crystal ball when frozen" on public.crystal_ball_picks;
drop policy if exists "Members read crystal ball when revealed" on public.crystal_ball_picks;
drop policy if exists "Users upsert own crystal ball" on public.crystal_ball_picks;
drop policy if exists "Users insert own crystal ball" on public.crystal_ball_picks;
drop policy if exists "Users update own crystal ball" on public.crystal_ball_picks;

-- POLICY: Member reads own pick (secret season).
create policy "Members read own crystal ball"
  on public.crystal_ball_picks
  for select
  to authenticated
  using (
    crystal_ball_picks.user_id = auth.uid()
    and exists (
      select 1 from public.memberships m
      where m.league_id = crystal_ball_picks.league_id
        and m.user_id = auth.uid()
    )
  );

-- POLICY: Peer board read — TRANSITIONAL pre-D1C.
-- Membership fully correlated. Freeze OR-clauses mirror crystal-ball-privacy.sql
-- for compatibility until D1C replaces them with crystal_ball_lock_state().
-- D1C will remove hardcoded years and reject score-as-ordinary-reveal.
-- Known transitional debt (do not treat as final product law):
--   - timestamptz 2026 calendar literals
--   - week_results week 0/1 scored branch
create policy "Members read crystal ball when frozen"
  on public.crystal_ball_picks
  for select
  to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.league_id = crystal_ball_picks.league_id
        and m.user_id = auth.uid()
    )
    and (
      exists (
        select 1 from public.crystal_ball_result r
        where r.league_id = crystal_ball_picks.league_id
      )
      or now() >= timestamptz '2026-08-29 16:00:00+00'
      or now() >= timestamptz '2026-09-10 16:00:00+00'
      or exists (
        select 1
        from public.week_results wr
        where wr.league_id = crystal_ball_picks.league_id
          and wr.week_number in (0, 1)
      )
    )
  );

-- POLICY: Insert own pick — member + owner only.
-- Authoritative write-open/close is D1C + app resolveCrystalBallLock.
create policy "Users insert own crystal ball"
  on public.crystal_ball_picks
  for insert
  to authenticated
  with check (
    crystal_ball_picks.user_id = auth.uid()
    and exists (
      select 1 from public.memberships m
      where m.league_id = crystal_ball_picks.league_id
        and m.user_id = auth.uid()
    )
  );

-- POLICY: Update own pick — member + owner (lock close is D1C).
create policy "Users update own crystal ball"
  on public.crystal_ball_picks
  for update
  to authenticated
  using (
    crystal_ball_picks.user_id = auth.uid()
    and exists (
      select 1 from public.memberships m
      where m.league_id = crystal_ball_picks.league_id
        and m.user_id = auth.uid()
    )
  )
  with check (
    crystal_ball_picks.user_id = auth.uid()
    and exists (
      select 1 from public.memberships m
      where m.league_id = crystal_ball_picks.league_id
        and m.user_id = auth.uid()
    )
  );

-- crystal_ball_result membership correlation
drop policy if exists "Members read crystal result" on public.crystal_ball_result;
create policy "Members read crystal result"
  on public.crystal_ball_result
  for select
  to authenticated
  using (
    exists (
      select 1 from public.memberships m
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
      select 1 from public.leagues l
      where l.id = crystal_ball_result.league_id
        and l.commissioner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.leagues l
      where l.id = crystal_ball_result.league_id
        and l.commissioner_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- PICKS — own manage requires membership in target league
-- ═══════════════════════════════════════════════════════════════════════════
-- PRESERVE ops policies: "Ops read league picks", "Ops score picks", etc.

drop policy if exists "Users manage own picks" on public.picks;
create policy "Users manage own picks"
  on public.picks
  for all
  to authenticated
  using (
    picks.user_id = auth.uid()
    and exists (
      select 1 from public.memberships m
      where m.league_id = picks.league_id
        and m.user_id = auth.uid()
    )
  )
  with check (
    picks.user_id = auth.uid()
    and exists (
      select 1 from public.memberships m
      where m.league_id = picks.league_id
        and m.user_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- PICK_GAMES — own manage via own pick + membership
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

commit;

notify pgrst, 'reload schema';

-- POST-VERIFY: zero tautologies; ops policies still listed; no leagues DELETE change
-- END D1B REVIEW-ONLY
