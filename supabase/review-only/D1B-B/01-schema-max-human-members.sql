-- =============================================================================
-- D1B-B / 01-schema-max-human-members.sql
-- REVIEW ONLY — DO NOT APPLY TO LIVE SUPABASE WITHOUT SEPARATE STAGE AUTH
-- =============================================================================
-- Product B2: server-owned per-league max_human_members, default 32.
-- Humans (including commissioner) count; bots do not.
-- Backfill is SELECT-safe default assignment only — no membership DELETEs.
-- =============================================================================

-- Column
alter table public.leagues
  add column if not exists max_human_members integer;

comment on column public.leagues.max_human_members is
  'D1B-B: max human memberships (player+commissioner). Bots excluded. Default 32.';

-- Constraint (only when not null — allow brief null during backfill)
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

-- Backfill proposal: set default 32 where null (no row deletes)
-- UPDATE public.leagues
-- SET max_human_members = 32
-- WHERE max_human_members IS NULL;

-- Optional NOT NULL after backfill verified:
-- ALTER TABLE public.leagues
--   ALTER COLUMN max_human_members SET DEFAULT 32,
--   ALTER COLUMN max_human_members SET NOT NULL;

-- Index not required for equality on league PK row; no new membership indexes.

-- END 01 — REVIEW ONLY
