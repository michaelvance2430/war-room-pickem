-- Permanent first-join times for profile titles (OG / cool / lesser / Bottom Feeder).
-- Leave + rejoin does NOT reset rank — first_joined_at is forever for that league.
-- Run once in Supabase SQL Editor.

create table if not exists public.league_first_joins (
  league_id uuid not null references public.leagues (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  first_joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);

create index if not exists league_first_joins_league_idx
  on public.league_first_joins (league_id, first_joined_at);

alter table public.league_first_joins enable row level security;

-- Members can read join order (needed for profile titles)
drop policy if exists "Members read first joins" on public.league_first_joins;
create policy "Members read first joins"
  on public.league_first_joins for select to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.league_id = league_first_joins.league_id
        and m.user_id = auth.uid()
    )
  );

-- Anyone who can insert their own membership can stamp first join
-- (also allow if they just joined — membership may exist)
drop policy if exists "Users insert own first join" on public.league_first_joins;
create policy "Users insert own first join"
  on public.league_first_joins for insert to authenticated
  with check (auth.uid() = user_id);

-- No update/delete for players — first join is permanent
-- (service / security definer can still manage if needed)

-- Stamp first join; never overwrite. Optionally restore memberships.joined_at.
create or replace function public.record_league_first_join(
  p_league_id uuid,
  p_user_id uuid default null
)
returns timestamptz
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := coalesce(p_user_id, auth.uid());
  v_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  -- Only self (or keep simple: only self)
  if v_uid is distinct from auth.uid() then
    raise exception 'Can only record your own first join';
  end if;

  insert into public.league_first_joins (league_id, user_id, first_joined_at)
  values (p_league_id, v_uid, now())
  on conflict (league_id, user_id) do nothing;

  select first_joined_at into v_at
  from public.league_first_joins
  where league_id = p_league_id and user_id = v_uid;

  -- If they're a current member, keep joined_at = original first join
  update public.memberships
  set joined_at = v_at
  where league_id = p_league_id
    and user_id = v_uid
    and (joined_at is distinct from v_at);

  return v_at;
end;
$$;

revoke all on function public.record_league_first_join(uuid, uuid) from public;
grant execute on function public.record_league_first_join(uuid, uuid) to authenticated;

-- Backfill from current memberships (one-time safe)
insert into public.league_first_joins (league_id, user_id, first_joined_at)
select m.league_id, m.user_id, m.joined_at
from public.memberships m
on conflict (league_id, user_id) do nothing;

notify pgrst, 'reload schema';
