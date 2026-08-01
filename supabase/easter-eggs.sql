-- ============================================================
-- Easter eggs: ACCOUNT-WIDE (any sport) + PLATFORM-WIDE flexes
-- Finds stick to the player account across CFB / NFL / all packs.
-- Milestone newspapers (7 / 10 / full) go to EVERY player in the world.
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

-- Any signed-in player can see anyone's finds (badge shelf on profile)
drop policy if exists "egg_finds_select_league_mates" on public.easter_egg_finds;
drop policy if exists "egg_finds_select_authenticated" on public.easter_egg_finds;
create policy "egg_finds_select_authenticated"
  on public.easter_egg_finds for select to authenticated
  using (true);

drop policy if exists "egg_finds_insert_self" on public.easter_egg_finds;
create policy "egg_finds_insert_self"
  on public.easter_egg_finds for insert to authenticated
  with check (user_id = auth.uid());

-- Platform-wide Ready Player One papers (not per-league)
create table if not exists public.egg_milestone_flexes (
  id uuid primary key default gen_random_uuid(),
  finder_user_id uuid not null references public.profiles (id) on delete cascade,
  finder_name text not null,
  found int not null,
  total int not null,
  milestone int not null,
  created_at timestamptz not null default now()
);

-- Migrate older league-scoped rows if present
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public'
      and table_name = 'egg_milestone_flexes'
      and column_name = 'league_id'
  ) then
    -- Drop league-scoped unique / column for platform-wide model
    alter table public.egg_milestone_flexes
      drop constraint if exists egg_flex_once_per_milestone;
    drop index if exists egg_flex_once_per_milestone;
    alter table public.egg_milestone_flexes
      drop column if exists league_id;
  end if;
end $$;

create unique index if not exists egg_flex_once_per_milestone_global
  on public.egg_milestone_flexes (finder_user_id, milestone);

create index if not exists egg_flex_created_idx
  on public.egg_milestone_flexes (created_at desc);

alter table public.egg_milestone_flexes enable row level security;

drop policy if exists "egg_flex_select_members" on public.egg_milestone_flexes;
drop policy if exists "egg_flex_select_authenticated" on public.egg_milestone_flexes;
create policy "egg_flex_select_authenticated"
  on public.egg_milestone_flexes for select to authenticated
  using (true);

-- Record a find (account-wide) + fire 7 / 10 / full for the entire product
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

  -- One global newspaper per milestone (every player on the app can see it)
  foreach v_milestone in array array[7, 10, v_total]
  loop
    if v_found >= v_milestone then
      insert into public.egg_milestone_flexes (
        finder_user_id, finder_name, found, total, milestone
      )
      values (
        v_uid, v_name, v_found, v_total, v_milestone
      )
      on conflict (finder_user_id, milestone) do nothing;
      get diagnostics v_row_count = row_count;
      if v_row_count > 0 then
        v_flexed := v_flexed + 1;
      end if;
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

-- Unique constraint name for ON CONFLICT (index alone may not work as constraint)
alter table public.egg_milestone_flexes
  drop constraint if exists egg_flex_once_per_milestone_global;
drop index if exists egg_flex_once_per_milestone_global;
alter table public.egg_milestone_flexes
  add constraint egg_flex_once_per_milestone_global
  unique (finder_user_id, milestone);

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
      insert into public.egg_milestone_flexes (
        finder_user_id, finder_name, found, total, milestone
      )
      values (
        v_uid, v_name, v_found, v_total, v_milestone
      )
      on conflict on constraint egg_flex_once_per_milestone_global do nothing;
      get diagnostics v_row_count = row_count;
      if v_row_count > 0 then
        v_flexed := v_flexed + 1;
      end if;
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
