-- =============================================================================
-- D0 RLS CORRECTIONS — ROLLBACK (restores pre-D0 policy shapes from repo)
-- =============================================================================
-- REVIEW ONLY until authorized. Prefer restoring from preflight pg_policies
-- dump if live names/definitions differed from repo archaeology.
--
-- Restores:
--   - Commissioner DELETE on leagues
--   - Prior crystal ball / achievements / picks manage-own shapes (repo)
--   - Hardcoded 2026 freezes (undesirable but matches pre-D0)
-- Does NOT drop crystal_ball_board_is_revealed (harmless leftover) unless noted.
-- =============================================================================

begin;

-- ── leagues DELETE (pre-D0 leave-delete-policies.sql) ───────────────────────
drop policy if exists "Commissioner deletes league" on public.leagues;
create policy "Commissioner deletes league"
  on public.leagues
  for delete
  to authenticated
  using (commissioner_id = auth.uid());

-- ── achievements (crystal-ball.sql style; unqualified league_id as before) ──
drop policy if exists "Members read achievements" on public.achievements;
create policy "Members read achievements"
  on public.achievements
  for select
  to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.league_id = league_id and m.user_id = auth.uid()
    )
  );

drop policy if exists "Commissioner grants achievements" on public.achievements;
create policy "Commissioner grants achievements"
  on public.achievements
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.leagues l
      where l.id = league_id and l.commissioner_id = auth.uid()
    )
  );

-- ── crystal_ball_picks (privacy + 2026 freezes) ─────────────────────────────
drop policy if exists "Members read own crystal ball" on public.crystal_ball_picks;
drop policy if exists "Members read crystal ball when revealed" on public.crystal_ball_picks;
drop policy if exists "Members read crystal ball when frozen" on public.crystal_ball_picks;
drop policy if exists "Users insert own crystal ball" on public.crystal_ball_picks;
drop policy if exists "Users update own crystal ball" on public.crystal_ball_picks;
drop policy if exists "Users upsert own crystal ball" on public.crystal_ball_picks;
drop policy if exists "Members read crystal ball" on public.crystal_ball_picks;

create policy "Members read own crystal ball"
  on public.crystal_ball_picks
  for select
  to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.memberships m
      where m.league_id = league_id and m.user_id = auth.uid()
    )
  );

create policy "Members read crystal ball when frozen"
  on public.crystal_ball_picks
  for select
  to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.league_id = league_id and m.user_id = auth.uid()
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

create policy "Users upsert own crystal ball"
  on public.crystal_ball_picks
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.memberships m
      where m.league_id = league_id and m.user_id = auth.uid()
    )
  );

create policy "Users update own crystal ball"
  on public.crystal_ball_picks
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.memberships m
      where m.league_id = league_id and m.user_id = auth.uid()
    )
  );

-- ── crystal_ball_result ─────────────────────────────────────────────────────
drop policy if exists "Members read crystal result" on public.crystal_ball_result;
create policy "Members read crystal result"
  on public.crystal_ball_result
  for select
  to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.league_id = league_id and m.user_id = auth.uid()
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
      where l.id = league_id and l.commissioner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.leagues l
      where l.id = league_id and l.commissioner_id = auth.uid()
    )
  );

-- ── picks / pick_games manage-own (schema.sql pre-membership gate) ──────────
drop policy if exists "Users manage own picks" on public.picks;
create policy "Users manage own picks"
  on public.picks
  for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own pick_games" on public.pick_games;
create policy "Users manage own pick_games"
  on public.pick_games
  for all
  to authenticated
  using (
    exists (
      select 1 from public.picks p
      where p.id = pick_id and p.user_id = auth.uid()
    )
  );

-- Optional: remove D0 helper (only if nothing else depends on it)
-- drop function if exists public.crystal_ball_board_is_revealed(uuid);

commit;

notify pgrst, 'reload schema';

-- END D0 ROLLBACK
