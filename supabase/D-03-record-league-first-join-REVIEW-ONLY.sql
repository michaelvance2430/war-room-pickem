-- =============================================================================
-- D-03 — record_league_first_join membership gate — REVIEW ONLY
-- =============================================================================
-- DO NOT APPLY without Mike explicit authorization for D-03 AFTER helper gate.
-- Design: docs/D-03-RECORD-LEAGUE-FIRST-JOIN-REMEDIATION.md
-- Helper gate: docs/D-03-HELPER-SAFETY-GATE.md
--
-- Product decisions APPROVED: P1–P6.
-- Helper decision: REUSE live public.is_league_member(uuid) UNCHANGED.
--   - No CREATE OR REPLACE on is_league_member
--   - No REVOKE/GRANT on is_league_member (H-01 inventory only for its broad grants)
--
-- NARROW SCOPE (only):
--   1) record_league_first_join body — call existing is_league_member; raise if not member
--   2) record_league_first_join EXECUTE — REVOKE PUBLIC + anon; GRANT authenticated
--   3) league_first_joins INSERT policy — self + is_league_member(league_id)
--   4) NOTIFY pgrst reload
--
-- DOES NOT: touch is_league_member definition/grants · historical first-join rows ·
--           app code · H-01 general grant sweep · D-02 · D1B · other policies
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

  -- p_user_id kept for PostgREST/app compatibility; null → self; else must be self
  if p_user_id is not null and p_user_id is distinct from v_uid then
    raise exception 'Can only record your own first join';
  end if;

  -- D-03: reuse live helper (do not redefine here)
  if not public.is_league_member(p_league_id) then
    raise exception 'Not a member of this league';
  end if;

  insert into public.league_first_joins (league_id, user_id, first_joined_at)
  values (p_league_id, v_uid, now())
  on conflict (league_id, user_id) do nothing;

  select first_joined_at into v_at
  from public.league_first_joins
  where league_id = p_league_id and user_id = v_uid;

  -- Align memberships.joined_at only for existing membership rows
  update public.memberships
  set joined_at = v_at
  where league_id = p_league_id
    and user_id = v_uid
    and (joined_at is distinct from v_at);

  return v_at;
end;
$$;

comment on function public.record_league_first_join(uuid, uuid) is
  'D-03: Stamp permanent first join for auth.uid() only when is_league_member; never overwrites first_joined_at.';

revoke all on function public.record_league_first_join(uuid, uuid) from public;
revoke all on function public.record_league_first_join(uuid, uuid) from anon;
grant execute on function public.record_league_first_join(uuid, uuid) to authenticated;

-- Defense in depth: client INSERT requires self + live DEFINER helper (unchanged helper)
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
-- Restore record_league_first_join body from supabase/join-order.sql
-- Restore insert policy with check (auth.uid() = user_id) only.
-- Do not alter is_league_member.

-- END D-03 REVIEW-ONLY
