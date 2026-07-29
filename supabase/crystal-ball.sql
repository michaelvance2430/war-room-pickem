-- Crystal Ball: preseason national champion pick (no points) + sarcastic achievements
-- Run in Supabase → SQL Editor → Run once

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

-- Members can read all crystal ball picks in their league (brag board)
drop policy if exists "Members read crystal ball" on public.crystal_ball_picks;
create policy "Members read crystal ball"
  on public.crystal_ball_picks for select to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.league_id = league_id and m.user_id = auth.uid()
    )
  );

drop policy if exists "Users upsert own crystal ball" on public.crystal_ball_picks;
create policy "Users upsert own crystal ball"
  on public.crystal_ball_picks for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.memberships m
      where m.league_id = league_id and m.user_id = auth.uid()
    )
  );

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
