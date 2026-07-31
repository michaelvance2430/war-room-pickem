-- Reveal everyone's picks after the card locks (first kickoff) OR after scoring.
-- Before first kickoff: still private (own picks + commissioner only).
-- Run once in Supabase SQL Editor.
-- Replaces / supersedes the scored-only policies if you already ran those.

-- Drop older variants
drop policy if exists "Members read scored week picks" on public.picks;
drop policy if exists "Members read scored week pick_games" on public.pick_games;
drop policy if exists "Members read locked week picks" on public.picks;
drop policy if exists "Members read locked week pick_games" on public.pick_games;

-- Helper idea (inline): week is "open for board" when
--   (1) week_results exists (scored), OR
--   (2) any card_game start_time is ISO and already started
-- start_time is stored as ISO when published from Odds/demo.

create policy "Members read locked week picks"
  on public.picks for select to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.league_id = picks.league_id
        and m.user_id = auth.uid()
    )
    and (
      -- Scored
      exists (
        select 1 from public.week_results wr
        where wr.league_id = picks.league_id
          and wr.week_number = picks.week_number
      )
      -- Or first kickoff already hit (ISO start_time on any game)
      or exists (
        select 1
        from public.week_cards wc
        join public.card_games cg on cg.week_card_id = wc.id
        where wc.league_id = picks.league_id
          and wc.week_number = picks.week_number
          and cg.start_time is not null
          and length(cg.start_time) >= 10
          and left(cg.start_time, 1) between '1' and '9'
          and (cg.start_time)::timestamptz <= now()
      )
    )
  );

create policy "Members read locked week pick_games"
  on public.pick_games for select to authenticated
  using (
    exists (
      select 1
      from public.picks p
      join public.memberships m
        on m.league_id = p.league_id and m.user_id = auth.uid()
      where p.id = pick_games.pick_id
        and (
          exists (
            select 1 from public.week_results wr
            where wr.league_id = p.league_id
              and wr.week_number = p.week_number
          )
          or exists (
            select 1
            from public.week_cards wc
            join public.card_games cg on cg.week_card_id = wc.id
            where wc.league_id = p.league_id
              and wc.week_number = p.week_number
              and cg.start_time is not null
              and length(cg.start_time) >= 10
              and left(cg.start_time, 1) between '1' and '9'
              and (cg.start_time)::timestamptz <= now()
          )
        )
    )
  );
