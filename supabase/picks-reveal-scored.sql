-- After a week is scored, any league member can read everyone's slips for that week.
-- Before scoring: still private (own picks only + commissioner).
-- Run once in Supabase SQL Editor.

-- Picks header rows for scored weeks
drop policy if exists "Members read scored week picks" on public.picks;
create policy "Members read scored week picks"
  on public.picks for select to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.league_id = picks.league_id
        and m.user_id = auth.uid()
    )
    and exists (
      select 1 from public.week_results wr
      where wr.league_id = picks.league_id
        and wr.week_number = picks.week_number
    )
  );

-- Pick lines for scored weeks
drop policy if exists "Members read scored week pick_games" on public.pick_games;
create policy "Members read scored week pick_games"
  on public.pick_games for select to authenticated
  using (
    exists (
      select 1
      from public.picks p
      join public.memberships m
        on m.league_id = p.league_id and m.user_id = auth.uid()
      join public.week_results wr
        on wr.league_id = p.league_id and wr.week_number = p.week_number
      where p.id = pick_games.pick_id
    )
  );
