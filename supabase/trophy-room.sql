-- ============================================================
-- Trophy Room + Pass Commissioner
-- Run once in Supabase → SQL Editor → Run
--
-- Trophies belong to the LEAGUE (not a person). Season reset
-- does not wipe them. Passing commissioner keeps the room.
-- ============================================================

-- Championship · Toilet Bowl · Crystal Ball nerd award (per season)
create table if not exists public.league_trophies (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  season_year int not null check (season_year >= 2000 and season_year <= 2100),
  trophy_type text not null check (
    trophy_type in ('championship', 'toilet_bowl', 'crystal_ball')
  ),
  -- Snapshot so history survives if the winner leaves / renames
  winner_name text not null,
  winner_user_id uuid references public.profiles (id) on delete set null,
  -- e.g. national champ team, final scoreline, flavor text
  subtitle text,
  notes text,
  awarded_at timestamptz not null default now(),
  awarded_by uuid references public.profiles (id) on delete set null,
  unique (league_id, season_year, trophy_type)
);

create index if not exists league_trophies_league_idx
  on public.league_trophies (league_id, season_year desc);

alter table public.league_trophies enable row level security;

drop policy if exists "Members read trophies" on public.league_trophies;
create policy "Members read trophies"
  on public.league_trophies for select to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.league_id = league_id and m.user_id = auth.uid()
    )
  );

drop policy if exists "Commissioner manages trophies" on public.league_trophies;
create policy "Commissioner manages trophies"
  on public.league_trophies for all to authenticated
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

-- ------------------------------------------------------------
-- Pass commissioner: trophies stay with league_id automatically
-- ------------------------------------------------------------
create or replace function public.transfer_commissioner(
  p_league_id uuid,
  p_new_commissioner_id uuid
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_new_name text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_new_commissioner_id is null or p_new_commissioner_id = v_uid then
    raise exception 'Pick a different league member to pass commissioner to';
  end if;

  if not exists (
    select 1 from public.leagues l
    where l.id = p_league_id and l.commissioner_id = v_uid
  ) then
    raise exception 'Only the current commissioner can pass the role';
  end if;

  if not exists (
    select 1 from public.memberships m
    where m.league_id = p_league_id
      and m.user_id = p_new_commissioner_id
  ) then
    raise exception 'New commissioner must already be a member of this league';
  end if;

  -- Demote outgoing, promote incoming
  update public.memberships
  set role = 'player'
  where league_id = p_league_id and user_id = v_uid;

  update public.memberships
  set role = 'commissioner'
  where league_id = p_league_id and user_id = p_new_commissioner_id;

  update public.leagues
  set commissioner_id = p_new_commissioner_id
  where id = p_league_id;

  select coalesce(p.display_name, 'Player')
  into v_new_name
  from public.profiles p
  where p.id = p_new_commissioner_id;

  return json_build_object(
    'ok', true,
    'newCommissionerId', p_new_commissioner_id,
    'newCommissionerName', coalesce(v_new_name, 'Player')
  );
end;
$$;

revoke all on function public.transfer_commissioner(uuid, uuid) from public;
grant execute on function public.transfer_commissioner(uuid, uuid) to authenticated;
