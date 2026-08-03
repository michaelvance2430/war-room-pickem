-- Additive only: easter egg finds + platform milestone flexes.
-- Safe to re-run. No DROP TABLE, no DELETE of user data.
-- Full product source: supabase/easter-eggs.sql
--
-- Run once in Supabase SQL Editor (production), then hard-refresh the app.
-- After success: GET /rest/v1/easter_egg_finds → 200 (not 404).

-- ── Finds (account-wide) ──────────────────────────────────────────────────
create table if not exists public.easter_egg_finds (
  user_id uuid not null references public.profiles (id) on delete cascade,
  discovery_id text not null,
  found_at timestamptz not null default now(),
  primary key (user_id, discovery_id)
);

create index if not exists easter_egg_finds_user_idx
  on public.easter_egg_finds (user_id);

alter table public.easter_egg_finds enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'easter_egg_finds'
      and policyname = 'egg_finds_select_authenticated'
  ) then
    create policy "egg_finds_select_authenticated"
      on public.easter_egg_finds for select to authenticated
      using (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'easter_egg_finds'
      and policyname = 'egg_finds_insert_self'
  ) then
    create policy "egg_finds_insert_self"
      on public.easter_egg_finds for insert to authenticated
      with check (user_id = auth.uid());
  end if;
end $$;

-- ── Platform-wide milestone newspapers ────────────────────────────────────
create table if not exists public.egg_milestone_flexes (
  id uuid primary key default gen_random_uuid(),
  finder_user_id uuid not null references public.profiles (id) on delete cascade,
  finder_name text not null,
  found int not null,
  total int not null,
  milestone int not null,
  created_at timestamptz not null default now()
);

-- Unique (finder, milestone) if missing — no DROP of existing data
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'egg_flex_once_per_milestone_global'
      and conrelid = 'public.egg_milestone_flexes'::regclass
  ) then
    -- Prefer unique constraint for ON CONFLICT
    begin
      alter table public.egg_milestone_flexes
        add constraint egg_flex_once_per_milestone_global
        unique (finder_user_id, milestone);
    exception
      when duplicate_table then null;
      when unique_violation then null;
      when others then
        -- Index-only fallback if constraint name clash
        create unique index if not exists egg_flex_once_per_milestone_global
          on public.egg_milestone_flexes (finder_user_id, milestone);
    end;
  end if;
end $$;

create index if not exists egg_flex_created_idx
  on public.egg_milestone_flexes (created_at desc);

alter table public.egg_milestone_flexes enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'egg_milestone_flexes'
      and policyname = 'egg_flex_select_authenticated'
  ) then
    create policy "egg_flex_select_authenticated"
      on public.egg_milestone_flexes for select to authenticated
      using (true);
  end if;
end $$;

-- ── Record find + fire 7 / 10 / full flexes ───────────────────────────────
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
      begin
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
      exception
        when others then
          -- If unique index shape differs, skip flex insert only
          null;
      end;
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
