-- Crews: permanent friend groups. Leagues = season chapters.
-- Optional cloud tables — app works local-first until this is run.
-- Safe to re-run.

-- Permanent Crew identity
create table if not exists public.crews (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  founded_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  revealed_at timestamptz,
  first_cheevo_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.crew_members (
  crew_id uuid not null references public.crews (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  role text not null default 'member',
  primary key (crew_id, user_id)
);

create index if not exists crew_members_user_idx on public.crew_members (user_id);

-- Season chapters (one league instance under a Crew)
create table if not exists public.crew_seasons (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews (id) on delete cascade,
  league_id uuid not null references public.leagues (id) on delete cascade,
  sport_id text not null default 'cfb',
  season_year int not null,
  status text not null default 'active'
    check (status in ('active', 'complete')),
  league_name text,
  completed_at timestamptz,
  championship_name text,
  toilet_name text,
  crystal_ball_name text,
  created_at timestamptz not null default now(),
  unique (league_id)
);

create index if not exists crew_seasons_crew_idx on public.crew_seasons (crew_id);

-- Link league → crew for fast lookup (optional denorm)
alter table public.leagues
  add column if not exists crew_id uuid references public.crews (id) on delete set null;

create index if not exists leagues_crew_id_idx on public.leagues (crew_id);

alter table public.crews enable row level security;
alter table public.crew_members enable row level security;
alter table public.crew_seasons enable row level security;

-- Members of a crew can read it
drop policy if exists "Crew members read crews" on public.crews;
create policy "Crew members read crews"
  on public.crews for select to authenticated
  using (
    exists (
      select 1 from public.crew_members m
      where m.crew_id = id and m.user_id = auth.uid()
    )
  );

drop policy if exists "Crew members read membership" on public.crew_members;
create policy "Crew members read membership"
  on public.crew_members for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.crew_members m
      where m.crew_id = crew_id and m.user_id = auth.uid()
    )
  );

drop policy if exists "Crew members read seasons" on public.crew_seasons;
create policy "Crew members read seasons"
  on public.crew_seasons for select to authenticated
  using (
    exists (
      select 1 from public.crew_members m
      where m.crew_id = crew_id and m.user_id = auth.uid()
    )
  );

-- Creator can insert crew + membership + season (client will also keep local copy)
drop policy if exists "Auth create crews" on public.crews;
create policy "Auth create crews"
  on public.crews for insert to authenticated
  with check (created_by = auth.uid() or created_by is null);

drop policy if exists "Auth insert own crew membership" on public.crew_members;
create policy "Auth insert own crew membership"
  on public.crew_members for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Auth insert crew seasons" on public.crew_seasons;
create policy "Auth insert crew seasons"
  on public.crew_seasons for insert to authenticated
  with check (
    exists (
      select 1 from public.crew_members m
      where m.crew_id = crew_id and m.user_id = auth.uid()
    )
  );

drop policy if exists "Auth update crew seasons" on public.crew_seasons;
create policy "Auth update crew seasons"
  on public.crew_seasons for update to authenticated
  using (
    exists (
      select 1 from public.crew_members m
      where m.crew_id = crew_id and m.user_id = auth.uid()
    )
  );

drop policy if exists "Auth update crews" on public.crews;
create policy "Auth update crews"
  on public.crews for update to authenticated
  using (
    exists (
      select 1 from public.crew_members m
      where m.crew_id = id and m.user_id = auth.uid()
    )
  );
