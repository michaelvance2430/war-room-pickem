-- ============================================================
-- Easter egg finds (cloud) + Ready-Player-One milestone flexes
-- Run in Supabase SQL Editor. Safe to re-run.
-- ============================================================

create table if not exists public.easter_egg_finds (
  user_id uuid not null references public.profiles (id) on delete cascade,
  discovery_id text not null,
  found_at timestamptz not null default now(),
  primary key (user_id, discovery_id)
);

create index if not exists easter_egg_finds_user_idx
  on public.easter_egg_finds (user_id);

alter table public.easter_egg_finds enable row level security;

drop policy if exists "egg_finds_select_league_mates" on public.easter_egg_finds;
create policy "egg_finds_select_league_mates"
  on public.easter_egg_finds for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1
      from public.memberships m1
      join public.memberships m2 on m1.league_id = m2.league_id
      where m1.user_id = auth.uid()
        and m2.user_id = easter_egg_finds.user_id
    )
  );

drop policy if exists "egg_finds_insert_self" on public.easter_egg_finds;
create policy "egg_finds_insert_self"
  on public.easter_egg_finds for insert to authenticated
  with check (user_id = auth.uid());

create table if not exists public.egg_milestone_flexes (
  id uuid primary key default gen_random_uuid(),
  finder_user_id uuid not null references public.profiles (id) on delete cascade,
  finder_name text not null,
  league_id uuid not null references public.leagues (id) on delete cascade,
  found int not null,
  total int not null,
  milestone int not null,
  created_at timestamptz not null default now(),
  constraint egg_flex_once_per_milestone
    unique (finder_user_id, league_id, milestone)
);

create index if not exists egg_flex_league_idx
  on public.egg_milestone_flexes (league_id, created_at desc);

alter table public.egg_milestone_flexes enable row level security;

drop policy if exists "egg_flex_select_members" on public.egg_milestone_flexes;
create policy "egg_flex_select_members"
  on public.egg_milestone_flexes for select to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.league_id = egg_milestone_flexes.league_id
        and m.user_id = auth.uid()
    )
  );

create or replace function public.record_easter_egg_find(
  p_discovery_id text,
  p_player_name text,
  p_total_eggs int
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_found int := 0;
  v_total int := greatest(1, coalesce(p_total_eggs, 19));
  v_milestone int;
  v_league uuid;
  v_name text;
  v_flexed int := 0;
  v_inserted boolean := false;
  v_row_count int;
begin
  if v_uid is null then
    return json_build_object('ok', false, 'error', 'Not authenticated');
  end if;

  if p_discovery_id is null or trim(p_discovery_id) = '' then
    return json_build_object('ok', false, 'error', 'Missing discovery');
  end if;

  if p_discovery_id not like 'egg_%' then
    return json_build_object('ok', false, 'error', 'Not an egg');
  end if;

  insert into public.easter_egg_finds (user_id, discovery_id, found_at)
  values (v_uid, trim(p_discovery_id), now())
  on conflict (user_id, discovery_id) do nothing;
  get diagnostics v_row_count = row_count;
  v_inserted := v_row_count > 0;

  select count(*)::int into v_found
  from public.easter_egg_finds
  where user_id = v_uid
    and discovery_id like 'egg_%';

  v_name := coalesce(nullif(trim(p_player_name), ''), 'A player');

  foreach v_milestone in array array[7, 10, v_total]
  loop
    if v_found >= v_milestone then
      for v_league in
        select m.league_id
        from public.memberships m
        where m.user_id = v_uid
          and coalesce(m.is_bot, false) = false
      loop
        insert into public.egg_milestone_flexes (
          finder_user_id, finder_name, league_id, found, total, milestone
        )
        values (
          v_uid, v_name, v_league, v_found, v_total, v_milestone
        )
        on conflict on constraint egg_flex_once_per_milestone do nothing;
        get diagnostics v_row_count = row_count;
        if v_row_count > 0 then
          v_flexed := v_flexed + 1;
        end if;
      end loop;
    end if;
  end loop;

  return json_build_object(
    'ok', true,
    'newFind', v_inserted,
    'found', v_found,
    'total', v_total,
    'flexesInserted', v_flexed
  );
end;
$$;

revoke all on function public.record_easter_egg_find(text, text, int) from public;
grant execute on function public.record_easter_egg_find(text, text, int) to authenticated;

notify pgrst, 'reload schema';
