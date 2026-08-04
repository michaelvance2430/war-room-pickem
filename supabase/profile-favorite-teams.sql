-- Favorite teams by sport (allegiance). Phase 1: CFB UI; multi-sport ready.
-- Run once in Supabase SQL Editor. Does NOT invent favorites for existing users.

create table if not exists public.profile_favorite_teams (
  user_id uuid not null references public.profiles (id) on delete cascade,
  sport_id text not null,
  team_id text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, sport_id),
  constraint profile_favorite_teams_sport_id_check
    check (char_length(sport_id) between 2 and 32),
  constraint profile_favorite_teams_team_id_check
    check (char_length(team_id) between 2 and 64)
);

create index if not exists profile_favorite_teams_sport_id_idx
  on public.profile_favorite_teams (sport_id);

create index if not exists profile_favorite_teams_team_id_idx
  on public.profile_favorite_teams (team_id);

create index if not exists profile_favorite_teams_sport_team_idx
  on public.profile_favorite_teams (sport_id, team_id);

comment on table public.profile_favorite_teams is
  'Player allegiance by sport. team_id is a stable catalog id (e.g. ohio-state), not a display name.';

comment on column public.profile_favorite_teams.sport_id is
  'Sport pack id: cfb, nfl, …';

comment on column public.profile_favorite_teams.team_id is
  'Canonical team id from app catalog, or no-team for an explicit neutral answer. Resolve name/colors in app code.';

create or replace function public.profile_favorite_teams_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profile_favorite_teams_updated_at on public.profile_favorite_teams;
create trigger profile_favorite_teams_updated_at
  before update on public.profile_favorite_teams
  for each row
  execute function public.profile_favorite_teams_set_updated_at();

alter table public.profile_favorite_teams enable row level security;

-- Read: authenticated members can see allegiances (profiles / leagues / rivalries later)
drop policy if exists "profile_favorite_teams_select_authenticated"
  on public.profile_favorite_teams;
create policy "profile_favorite_teams_select_authenticated"
  on public.profile_favorite_teams
  for select
  to authenticated
  using (true);

-- Write own rows only
drop policy if exists "profile_favorite_teams_insert_own"
  on public.profile_favorite_teams;
create policy "profile_favorite_teams_insert_own"
  on public.profile_favorite_teams
  for insert
  to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "profile_favorite_teams_update_own"
  on public.profile_favorite_teams;
create policy "profile_favorite_teams_update_own"
  on public.profile_favorite_teams
  for update
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "profile_favorite_teams_delete_own"
  on public.profile_favorite_teams;
create policy "profile_favorite_teams_delete_own"
  on public.profile_favorite_teams
  for delete
  to authenticated
  using (auth.uid() = user_id);

grant select, insert, update, delete on public.profile_favorite_teams to authenticated;
