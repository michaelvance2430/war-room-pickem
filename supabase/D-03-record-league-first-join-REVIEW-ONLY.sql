-- =============================================================================
-- D-03 — record_league_first_join membership gate — REVIEW ONLY
-- =============================================================================
-- DO NOT APPLY without Mike explicit authorization for D-03 AFTER preflight.
-- Design: docs/D-03-RECORD-LEAGUE-FIRST-JOIN-REMEDIATION.md
--
-- SCOPE:
--   1) Require existing memberships row for (p_league_id, auth.uid()) before insert
--   2) Keep signature (p_league_id, p_user_id default null); self-only
--   3) Preserve ON CONFLICT DO NOTHING (idempotent; no timestamp overwrite)
--   4) Preserve memberships.joined_at restore when member
--   5) REVOKE PUBLIC + anon EXECUTE; GRANT authenticated
--   6) Tighten INSERT policy: own user_id AND membership exists
--
-- DOES NOT: DELETE/UPDATE historical league_first_joins rows · app code · D-02 · D1B
-- =============================================================================

begin;

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

  -- p_user_id kept for PostgREST/app compatibility; must be self or null
  if p_user_id is not null and p_user_id is distinct from v_uid then
    raise exception 'Can only record your own first join';
  end if;

  -- D-03: must already be a member of the league
  if not exists (
    select 1
    from public.memberships m
    where m.league_id = p_league_id
      and m.user_id = v_uid
  ) then
    raise exception 'Not a member of this league';
  end if;

  insert into public.league_first_joins (league_id, user_id, first_joined_at)
  values (p_league_id, v_uid, now())
  on conflict (league_id, user_id) do nothing;

  select first_joined_at into v_at
  from public.league_first_joins
  where league_id = p_league_id and user_id = v_uid;

  -- Align memberships.joined_at to permanent first join (leave/rejoin safe)
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

-- Defense in depth: client INSERT also requires membership
drop policy if exists "Users insert own first join" on public.league_first_joins;
create policy "Users insert own first join"
  on public.league_first_joins for insert to authenticated
  with check (
    auth.uid() = user_id
    and exists (
      select 1
      from public.memberships m
      where m.league_id = league_first_joins.league_id
        and m.user_id = auth.uid()
    )
  );

commit;

notify pgrst, 'reload schema';

-- =============================================================================
-- ROLLBACK (reopens membership gap — prefer fix-forward)
-- =============================================================================
-- Restore body from supabase/join-order.sql / FIX-LEAGUE-FIRST-JOINS.sql
-- Restore insert policy with check (auth.uid() = user_id) only.

-- END D-03 REVIEW-ONLY
