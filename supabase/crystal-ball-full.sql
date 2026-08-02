-- ============================================================================
-- Crystal Ball — FULL setup (tables + privacy)
-- Paste once in Supabase → SQL Editor → Run
-- Safe to re-run (IF NOT EXISTS / DROP POLICY IF EXISTS)
-- ============================================================================

-- ── 1) Base tables ──────────────────────────────────────────────────────────

-- Commissioner on/off per league (default on)
alter table public.leagues
  add column if not exists crystal_ball_enabled boolean not null default true;

create table if not exists public.crystal_ball_picks (
  league_id uuid not null references public.leagues (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  team_name text not null,
  picked_at timestamptz not null default now(),
  primary key (league_id, user_id)
);

create index if not exists crystal_ball_picks_league_idx
  on public.crystal_ball_picks (league_id);

create table if not exists public.crystal_ball_result (
  league_id uuid primary key references public.leagues (id) on delete cascade,
  champion_team text not null,
  crowned_at timestamptz not null default now(),
  crowned_by uuid references public.profiles (id)
);

create table if not exists public.achievements (
  league_id uuid not null references public.leagues (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  code text not null,
  title text not null,
  flavor text not null,
  earned_at timestamptz not null default now(),
  primary key (league_id, user_id, code)
);

create index if not exists achievements_league_idx on public.achievements (league_id);

alter table public.crystal_ball_picks enable row level security;
alter table public.crystal_ball_result enable row level security;
alter table public.achievements enable row level security;

-- Result + achievements (open read for members; commish writes)
drop policy if exists "Members read crystal result" on public.crystal_ball_result;
create policy "Members read crystal result"
  on public.crystal_ball_result for select to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.league_id = league_id and m.user_id = auth.uid()
    )
  );

drop policy if exists "Commissioner crowns champion" on public.crystal_ball_result;
create policy "Commissioner crowns champion"
  on public.crystal_ball_result for all to authenticated
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

drop policy if exists "Members read achievements" on public.achievements;
create policy "Members read achievements"
  on public.achievements for select to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.league_id = league_id and m.user_id = auth.uid()
    )
  );

drop policy if exists "Commissioner grants achievements" on public.achievements;
create policy "Commissioner grants achievements"
  on public.achievements for insert to authenticated
  with check (
    exists (
      select 1 from public.leagues l
      where l.id = league_id and l.commissioner_id = auth.uid()
    )
  );

-- ── 2) Privacy: own pick secret until freeze, then permanent board ──────────

-- Drop open "everyone reads everything" if present (from older crystal-ball.sql)
drop policy if exists "Members read crystal ball" on public.crystal_ball_picks;
-- Drop old for-all upsert if present
drop policy if exists "Users upsert own crystal ball" on public.crystal_ball_picks;

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
drop policy if exists "Members read crystal ball when frozen" on public.crystal_ball_picks;
create policy "Members read crystal ball when frozen"
  on public.crystal_ball_picks for select to authenticated
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
      -- CFB calendar freeze: noon ET Sat Aug 29 2026 = 16:00 UTC
      or now() >= timestamptz '2026-08-29 16:00:00+00'
      -- NFL calendar freeze: noon ET Thu Sep 10 2026 = 16:00 UTC
      or now() >= timestamptz '2026-09-10 16:00:00+00'
      or exists (
        select 1
        from public.week_results wr
        where wr.league_id = crystal_ball_picks.league_id
          and wr.week_number in (0, 1)
      )
    )
  );

-- Insert / update own pick
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

-- Count sealed picks without revealing teams
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
