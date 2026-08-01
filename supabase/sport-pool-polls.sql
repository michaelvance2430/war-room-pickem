-- Cross-sport player pool: "Want to play [sport]?" → spin up a new league for the yeses.
-- Run once in Supabase SQL Editor (dev first). Safe to re-run.

create table if not exists public.sport_pool_polls (
  id uuid primary key default gen_random_uuid(),
  source_league_id uuid not null references public.leagues (id) on delete cascade,
  commissioner_id uuid not null references public.profiles (id) on delete cascade,
  target_sport_id text not null default 'nfl',
  proposed_name text not null default 'War Room',
  message text not null default '',
  status text not null default 'open'
    check (status in ('open', 'closed', 'spun_up')),
  created_league_id uuid references public.leagues (id) on delete set null,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create index if not exists sport_pool_polls_source_idx
  on public.sport_pool_polls (source_league_id, status);

create index if not exists sport_pool_polls_commish_idx
  on public.sport_pool_polls (commissioner_id, status);

create table if not exists public.sport_pool_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.sport_pool_polls (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  response text not null check (response in ('yes', 'no')),
  created_at timestamptz not null default now(),
  unique (poll_id, user_id)
);

create index if not exists sport_pool_votes_poll_idx
  on public.sport_pool_votes (poll_id);

alter table public.sport_pool_polls enable row level security;
alter table public.sport_pool_votes enable row level security;

-- Members of the source league can read open polls for that league
drop policy if exists "sport_pool_polls_select" on public.sport_pool_polls;
create policy "sport_pool_polls_select"
  on public.sport_pool_polls for select to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.league_id = sport_pool_polls.source_league_id
        and m.user_id = auth.uid()
    )
    or commissioner_id = auth.uid()
  );

-- Only commissioner of source league can insert polls
drop policy if exists "sport_pool_polls_insert" on public.sport_pool_polls;
create policy "sport_pool_polls_insert"
  on public.sport_pool_polls for insert to authenticated
  with check (
    commissioner_id = auth.uid()
    and exists (
      select 1 from public.leagues l
      where l.id = source_league_id
        and l.commissioner_id = auth.uid()
    )
  );

-- Commissioner can update their polls (close / spun_up)
drop policy if exists "sport_pool_polls_update" on public.sport_pool_polls;
create policy "sport_pool_polls_update"
  on public.sport_pool_polls for update to authenticated
  using (commissioner_id = auth.uid())
  with check (commissioner_id = auth.uid());

-- Members of source league can vote
drop policy if exists "sport_pool_votes_select" on public.sport_pool_votes;
create policy "sport_pool_votes_select"
  on public.sport_pool_votes for select to authenticated
  using (
    exists (
      select 1 from public.sport_pool_polls p
      join public.memberships m on m.league_id = p.source_league_id
      where p.id = sport_pool_votes.poll_id
        and m.user_id = auth.uid()
    )
    or user_id = auth.uid()
  );

drop policy if exists "sport_pool_votes_upsert" on public.sport_pool_votes;
create policy "sport_pool_votes_insert"
  on public.sport_pool_votes for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.sport_pool_polls p
      join public.memberships m on m.league_id = p.source_league_id
      where p.id = sport_pool_votes.poll_id
        and m.user_id = auth.uid()
        and p.status = 'open'
    )
  );

drop policy if exists "sport_pool_votes_update" on public.sport_pool_votes;
create policy "sport_pool_votes_update"
  on public.sport_pool_votes for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

comment on table public.sport_pool_polls is
  'Commissioner asks the current room if they want a new sport/league; yeses get spun up together.';
