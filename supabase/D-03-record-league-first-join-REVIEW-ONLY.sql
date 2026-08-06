-- =============================================================================
-- D-03 — record_league_first_join membership gate — REVIEW ONLY
-- =============================================================================
-- DO NOT APPLY without Mike explicit authorization for D-03 AFTER preflight.
-- Design: docs/D-03-RECORD-LEAGUE-FIRST-JOIN-REMEDIATION.md
--
-- Product decisions APPROVED: P1 raise non-member · P2 keep p_user_id ·
-- P3 membership on INSERT policy via SECURITY DEFINER helper (no RLS recursion) ·
-- P4 SQL first · P5 no historical mutation · P6 rejoin before re-stamp.
--
-- SCOPE:
--   1) is_league_member() SECURITY DEFINER helper (or reuse if present)
--   2) record_league_first_join requires membership; raise if not
--   3) Keep signature; p_user_id null → auth.uid(); else must equal auth.uid()
--   4) ON CONFLICT DO NOTHING (earliest first_joined_at preserved)
--   5) memberships.joined_at align only when membership exists
--   6) REVOKE PUBLIC + anon EXECUTE; GRANT authenticated
--   7) INSERT policy: self + is_league_member(league_id)
--
-- DOES NOT: DELETE/UPDATE historical league_first_joins · app code · D-02 · D1B
-- =============================================================================

begin;

-- Membership check without RLS recursion (safe for policies + RPC body)
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
  'D-03: SECURITY DEFINER membership check for auth.uid(); safe for RLS policies.';

revoke all on function public.is_league_member(uuid) from public;
revoke all on function public.is_league_member(uuid) from anon;
grant execute on function public.is_league_member(uuid) to authenticated;

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
  v_uid uuid := auth.uid();
  v_at timestamptz;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  -- p_user_id kept for PostgREST/app compatibility; null → self; else must be self
  if p_user_id is not null and p_user_id is distinct from v_uid then
    raise exception 'Can only record your own first join';
  end if;

  -- D-03: must already be a member of the league
  if not public.is_league_member(p_league_id) then
    raise exception 'Not a member of this league';
  end if;

  insert into public.league_first_joins (league_id, user_id, first_joined_at)
  values (p_league_id, v_uid, now())
  on conflict (league_id, user_id) do nothing;

  select first_joined_at into v_at
  from public.league_first_joins
  where league_id = p_league_id and user_id = v_uid;

  -- Align memberships.joined_at to permanent first join (only existing membership rows)
  update public.memberships
  set joined_at = v_at
  where league_id = p_league_id
    and user_id = v_uid
    and (joined_at is distinct from v_at);

  return v_at;
end;
$$;

comment on function public.record_league_first_join(uuid, uuid) is
  'D-03: Stamp permanent first join for auth.uid() only when membership exists; never overwrites first_joined_at.';

revoke all on function public.record_league_first_join(uuid, uuid) from public;
revoke all on function public.record_league_first_join(uuid, uuid) from anon;
grant execute on function public.record_league_first_join(uuid, uuid) to authenticated;

-- Defense in depth: client INSERT requires self + DEFINER membership helper
drop policy if exists "Users insert own first join" on public.league_first_joins;
create policy "Users insert own first join"
  on public.league_first_joins for insert to authenticated
  with check (
    auth.uid() = user_id
    and public.is_league_member(league_id)
  );

commit;

notify pgrst, 'reload schema';

-- =============================================================================
-- ROLLBACK (reopens membership gap — prefer fix-forward)
-- =============================================================================
-- Restore body from supabase/join-order.sql / FIX-LEAGUE-FIRST-JOINS.sql
-- Restore insert policy with check (auth.uid() = user_id) only.

-- END D-03 REVIEW-ONLY
