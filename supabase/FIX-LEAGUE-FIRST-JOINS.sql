-- Additive only: permanent first-join table for profile join-order titles.
-- Safe to re-run. No DROP TABLE, no DELETE, no data reset.
-- Source of truth also: supabase/join-order.sql
--
-- Run once in Supabase SQL Editor (production project), then hard-refresh the app.
-- After this succeeds, GET /rest/v1/league_first_joins returns 200 (not 404).

create table if not exists public.league_first_joins (
  league_id uuid not null references public.leagues (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  first_joined_at timestamptz not null default now(),
  primary key (league_id, user_id)
);

create index if not exists league_first_joins_league_idx
  on public.league_first_joins (league_id, first_joined_at);

alter table public.league_first_joins enable row level security;

-- Policies: create only if missing (no DROP)
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'league_first_joins'
      and policyname = 'Members read first joins'
  ) then
    create policy "Members read first joins"
      on public.league_first_joins for select to authenticated
      using (
        exists (
          select 1 from public.memberships m
          where m.league_id = league_first_joins.league_id
            and m.user_id = auth.uid()
        )
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'league_first_joins'
      and policyname = 'Users insert own first join'
  ) then
    create policy "Users insert own first join"
      on public.league_first_joins for insert to authenticated
      with check (auth.uid() = user_id);
  end if;
end $$;

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
  if v_uid is distinct from auth.uid() then
    raise exception 'Can only record your own first join';
  end if;

  insert into public.league_first_joins (league_id, user_id, first_joined_at)
  values (p_league_id, v_uid, now())
  on conflict (league_id, user_id) do nothing;

  select first_joined_at into v_at
  from public.league_first_joins
  where league_id = p_league_id and user_id = v_uid;

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

-- Backfill from current memberships only (idempotent; never deletes)
insert into public.league_first_joins (league_id, user_id, first_joined_at)
select m.league_id, m.user_id, coalesce(m.joined_at, now())
from public.memberships m
where m.user_id is not null
  and m.league_id is not null
on conflict (league_id, user_id) do nothing;

notify pgrst, 'reload schema';
