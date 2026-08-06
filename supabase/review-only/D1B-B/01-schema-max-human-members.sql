-- =============================================================================
-- D1B-B / 01-schema-max-human-members.sql
-- REVIEW ONLY — DO NOT APPLY TO LIVE SUPABASE WITHOUT SEPARATE STAGE AUTH
-- =============================================================================
-- Product B2: server-owned per-league max_human_members, default 32.
-- Humans (including commissioner) count; bots do not.
-- No membership DELETEs.
--
-- Production staged sequence (R6) — apply only with stage auth, verify each step:
--   1. Add nullable column + CHECK (null OR 2..64)
--   2. Backfill existing leagues to 32 where null
--   3. Verify zero nulls and zero invalid values (SELECT-only)
--   4. SET DEFAULT 32
--   5. SET NOT NULL
-- Disposable/empty branch: all five steps run below in one script (safe when empty
-- or when every null may receive 32).
-- =============================================================================

-- Step 1: nullable column + CHECK
alter table public.leagues
  add column if not exists max_human_members integer;

comment on column public.leagues.max_human_members is
  'D1B-B: max human memberships (player+commissioner). Bots excluded. Default 32.';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'leagues_max_human_members_chk'
      and conrelid = 'public.leagues'::regclass
  ) then
    alter table public.leagues
      add constraint leagues_max_human_members_chk
      check (
        max_human_members is null
        or (max_human_members >= 2 and max_human_members <= 64)
      );
  end if;
end $$;

-- Step 2: backfill (no row deletes)
update public.leagues
set max_human_members = 32
where max_human_members is null;

-- Step 3: verify (abort if residual nulls or invalid values)
do $$
declare
  v_nulls bigint;
  v_bad bigint;
begin
  select count(*) into v_nulls
  from public.leagues
  where max_human_members is null;

  select count(*) into v_bad
  from public.leagues
  where max_human_members is not null
    and (max_human_members < 2 or max_human_members > 64);

  if v_nulls > 0 or v_bad > 0 then
    raise exception
      'D1B-B 01: max_human_members verify failed (nulls=%, invalid=%) — refuse DEFAULT/NOT NULL',
      v_nulls, v_bad;
  end if;
end $$;

-- Steps 4–5: default + NOT NULL (after verify)
alter table public.leagues
  alter column max_human_members set default 32;

alter table public.leagues
  alter column max_human_members set not null;

-- Tighten CHECK: drop null-allowing form, re-add strict range
alter table public.leagues
  drop constraint if exists leagues_max_human_members_chk;

alter table public.leagues
  add constraint leagues_max_human_members_chk
  check (max_human_members >= 2 and max_human_members <= 64);

-- END 01 — REVIEW ONLY
