-- ============================================================
-- FIX: league_trophies upsert 400 (on_conflict=league_id,season_year,trophy_type)
-- Additive / idempotent. No DELETE of trophy rows. No DROP of the table.
--
-- Likely causes (schema drift vs app):
--   1) Missing UNIQUE (league_id, season_year, trophy_type) → PostgREST 400 / 42P10
--   2) trophy_type CHECK only allows championship|toilet_bowl|crystal_ball
--      while app auto-engraves division_north|south|east|west → 400 / 23514
--
-- Run once in Supabase → SQL Editor → Run
-- If step 1 raises DUPLICATE…, STOP and send Mike the select output.
-- ============================================================

-- ── 1) Duplicate audit (blocks unique creation if unsafe) ─────────────
do $$
declare
  dup_groups int;
begin
  select count(*) into dup_groups
  from (
    select league_id, season_year, trophy_type
    from public.league_trophies
    group by league_id, season_year, trophy_type
    having count(*) > 1
  ) d;

  if dup_groups > 0 then
    raise exception
      'STOP: % duplicate (league_id, season_year, trophy_type) group(s) in league_trophies. Run: select league_id, season_year, trophy_type, count(*) as n from public.league_trophies group by 1,2,3 having count(*) > 1 order by n desc; Do not add unique until resolved.',
      dup_groups;
  end if;
end $$;

-- ── 2) Expand trophy_type check (division / conference titles) ─────────
-- Matches supabase/division-trophies.sql + trophy-room base types.
alter table public.league_trophies
  drop constraint if exists league_trophies_trophy_type_check;

alter table public.league_trophies
  add constraint league_trophies_trophy_type_check
  check (
    trophy_type in (
      'championship',
      'toilet_bowl',
      'crystal_ball',
      'division_north',
      'division_south',
      'division_east',
      'division_west'
    )
  );

-- ── 3) Unique target for PostgREST on_conflict ───────────────────────
-- Prefer named unique index matching onConflict columns (idempotent).
create unique index if not exists league_trophies_league_season_type_uidx
  on public.league_trophies (league_id, season_year, trophy_type);

-- Also ensure a table UNIQUE constraint exists under the classic name
-- (create table if not exists would not add this to older bare tables).
do $$
begin
  if not exists (
    select 1
    from pg_constraint c
    join pg_class t on c.conrelid = t.oid
    join pg_namespace n on t.relnamespace = n.oid
    where n.nspname = 'public'
      and t.relname = 'league_trophies'
      and c.contype = 'u'
      and pg_get_constraintdef(c.oid) ilike '%league_id%season_year%trophy_type%'
  ) then
    begin
      alter table public.league_trophies
        add constraint league_trophies_league_id_season_year_trophy_type_key
        unique (league_id, season_year, trophy_type);
    exception
      when duplicate_table then null;
      when duplicate_object then null;
      when unique_violation then
        raise exception
          'STOP: unique constraint failed — duplicate rows still present. Inspect league_trophies duplicates.';
    end;
  end if;
end $$;

-- ── 4) RLS — qualify columns (membership + commissioner only writes) ──
alter table public.league_trophies enable row level security;

drop policy if exists "Members read trophies" on public.league_trophies;
create policy "Members read trophies"
  on public.league_trophies for select to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.league_id = league_trophies.league_id
        and m.user_id = auth.uid()
    )
  );

-- Career case read (existing product) — keep if present
drop policy if exists "Read trophies by linked winner" on public.league_trophies;
create policy "Read trophies by linked winner"
  on public.league_trophies for select to authenticated
  using (winner_user_id is not null);

drop policy if exists "Commissioner manages trophies" on public.league_trophies;
create policy "Commissioner manages trophies"
  on public.league_trophies for all to authenticated
  using (
    exists (
      select 1 from public.leagues l
      where l.id = league_trophies.league_id
        and l.commissioner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.leagues l
      where l.id = league_trophies.league_id
        and l.commissioner_id = auth.uid()
    )
  );

-- ── 5) Grants (RLS still applies) ─────────────────────────────────────
grant select, insert, update, delete on public.league_trophies to authenticated;

-- ── 6) Reload PostgREST schema cache ────────────────────────────────
notify pgrst, 'reload schema';

comment on table public.league_trophies is
  'League-owned trophies (Championship, Toilet Bowl, Crystal Ball, division titles). Upsert key: (league_id, season_year, trophy_type).';
