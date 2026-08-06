-- =============================================================================
-- D1C-S2B / 05-ephemeral-fixture-membership.sql
-- REVIEW ONLY — NON-PRODUCTION — DO NOT APPLY TO LIVE SUPABASE
-- =============================================================================
-- TEST FIXTURE ONLY
--
-- Provides a minimal is_league_member if missing so ephemeral harness can run.
-- This is NOT the D1B-A / D1B-B / D1B-C production package.
-- This is NOT authorized for production D1B apply.
-- If production already has is_league_member (D-03 era), this CREATE OR REPLACE
-- must not be used on production without separate review.
-- =============================================================================

create or replace function public.is_league_member(p_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.memberships m
    where m.league_id = p_league_id
      and m.user_id = auth.uid()
  );
$$;

comment on function public.is_league_member(uuid) is
  'D1C-S2B EPHEMERAL FIXTURE ONLY if missing — NOT D1B production package.';

revoke all on function public.is_league_member(uuid) from public;
grant execute on function public.is_league_member(uuid) to authenticated;

-- =============================================================================
-- END 05 — FIXTURE ONLY — NOT D1B PRODUCTION
-- =============================================================================
