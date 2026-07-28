-- Pick privacy: players only see their own picks.
-- Commissioner can read all league picks (scoring + who submitted).
-- Run in Supabase → SQL Editor → Run

-- Remove "anyone in the league can read everyone's picks"
drop policy if exists "Members view league picks" on public.picks;
drop policy if exists "Members read pick_games" on public.pick_games;

-- Commissioner can read pick headers (needed for scoring + submission status)
drop policy if exists "Commissioner reads league picks" on public.picks;
create policy "Commissioner reads league picks"
  on public.picks for select to authenticated
  using (
    exists (
      select 1 from public.leagues l
      where l.id = league_id and l.commissioner_id = auth.uid()
    )
  );

-- Commissioner can read pick lines (needed for scoring only — app never shows them in UI)
drop policy if exists "Commissioner reads league pick_games" on public.pick_games;
create policy "Commissioner reads league pick_games"
  on public.pick_games for select to authenticated
  using (
    exists (
      select 1
      from public.picks p
      join public.leagues l on l.id = p.league_id
      where p.id = pick_id and l.commissioner_id = auth.uid()
    )
  );

-- Note: "Users manage own picks" / "Users manage own pick_games" already
-- allow each user to read/write only their own rows.
