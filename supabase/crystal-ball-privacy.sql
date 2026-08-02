-- Crystal Ball privacy: members only read their OWN pick until freeze.
-- After freeze, app loads the full board (permanent record).
-- Run once in Supabase SQL Editor (safe to re-run).
-- Requires crystal-ball.sql tables already exist.

-- Drop open "everyone reads everything" policy if present
drop policy if exists "Members read crystal ball" on public.crystal_ball_picks;

-- Always: read your own pick (secret season)
drop policy if exists "Members read own crystal ball" on public.crystal_ball_picks;
create policy "Members read own crystal ball"
  on public.crystal_ball_picks for select to authenticated
  using (
    user_id = auth.uid()
    and exists (
      select 1 from public.memberships m
      where m.league_id = league_id and m.user_id = auth.uid()
    )
  );

-- After freeze: full room can read the permanent board
-- Revealed when calendar deadline passed OR opening week scored OR result crowned
drop policy if exists "Members read crystal ball when frozen" on public.crystal_ball_picks;
create policy "Members read crystal ball when frozen"
  on public.crystal_ball_picks for select to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.league_id = league_id and m.user_id = auth.uid()
    )
    and (
      -- Crowned (title game done)
      exists (
        select 1 from public.crystal_ball_result r
        where r.league_id = crystal_ball_picks.league_id
      )
      -- CFB calendar freeze: noon ET Sat Aug 29 2026 = 16:00 UTC
      or now() >= timestamptz '2026-08-29 16:00:00+00'
      -- NFL calendar freeze: noon ET Thu Sep 10 2026 = 16:00 UTC
      or now() >= timestamptz '2026-09-10 16:00:00+00'
      -- Opening week scored (week 0 CFB / week 1 NFL) via week_results if table exists
      or exists (
        select 1
        from public.week_results wr
        where wr.league_id = crystal_ball_picks.league_id
          and wr.week_number in (0, 1)
      )
    )
  );

-- Upsert own pick (keep existing intent)
drop policy if exists "Users upsert own crystal ball" on public.crystal_ball_picks;
create policy "Users upsert own crystal ball"
  on public.crystal_ball_picks for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.memberships m
      where m.league_id = league_id and m.user_id = auth.uid()
    )
  );

drop policy if exists "Users update own crystal ball" on public.crystal_ball_picks;
create policy "Users update own crystal ball"
  on public.crystal_ball_picks for update to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.memberships m
      where m.league_id = league_id and m.user_id = auth.uid()
    )
  );

-- Count sealed picks without revealing teams (optional; app uses head count on own policy + frozen policy)
-- Members can count rows they can see; for pre-lock count of ALL pickers we need a tiny RPC:

create or replace function public.crystal_ball_lock_count(p_league_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (
      select 1 from public.memberships m
      where m.league_id = p_league_id and m.user_id = auth.uid()
    )
    then (
      select count(*)::integer
      from public.crystal_ball_picks p
      where p.league_id = p_league_id
    )
    else 0
  end;
$$;

grant execute on function public.crystal_ball_lock_count(uuid) to authenticated;
