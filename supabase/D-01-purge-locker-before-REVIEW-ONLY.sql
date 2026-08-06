-- =============================================================================
-- D-01 — purge_locker_before authorization + retention — REVIEW ONLY
-- =============================================================================
-- DO NOT APPLY without Mike explicit authorization for D-01.
--
-- Defect: bulk DELETE of locker_messages trusts caller p_before and allows any
-- league member. Even staff with p_before = now() can erase recent history.
-- Evidence: docs/P17-DEFINER-BODY-ACL-EVIDENCE.md · STRUCTURAL-SECURITY-DEFECT-REGISTER D-01
-- Design: docs/D-01-PURGE-LOCKER-BEFORE-REMEDIATION.md
--
-- SCOPE (this file only):
--   1) Require is_league_staff (commissioner OR moderator) — not bare membership
--   2) Server retention boundary: now() - interval '7 days'
--      - Derive/cap cutoff so messages in the last 7 days are never bulk-deleted
--      - Reject p_before newer than the boundary (incl. now() / future)
--      - Prefer server boundary when p_before is null
--   3) Re-assert least-privilege EXECUTE (no PUBLIC / no anon)
--
-- DOES NOT: touch other functions, RLS policies, triggers, D1A, CB, postseason.
-- IDEMPOTENT: CREATE OR REPLACE + REVOKE/GRANT.
-- =============================================================================

begin;

create or replace function public.purge_locker_before(
  p_league_id uuid,
  p_before timestamptz
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_boundary timestamptz;
  v_cutoff timestamptz;
  v_deleted int := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  -- Staff only: commissioner or moderator (same as locker staff delete policy)
  if not public.is_league_staff(p_league_id) then
    raise exception 'Not authorized to purge locker messages';
  end if;

  -- Server-enforced retention: never bulk-delete messages newer than this
  v_boundary := now() - interval '7 days';

  -- Prefer server-derived cutoff. Keep p_before for API compatibility only.
  -- Newer-than-boundary (including now()) is rejected — do not trust client wipe.
  if p_before is not null and p_before > v_boundary then
    raise exception
      'Purge cutoff must not be newer than the 7-day retention boundary'
      using hint = 'Pass p_before <= now() - interval ''7 days'', or omit reliance on client week-start when it falls inside the protected window.';
  end if;

  -- Null → full server boundary; older p_before → more conservative (deletes less)
  v_cutoff := coalesce(p_before, v_boundary);
  -- Belt-and-suspenders: never exceed server boundary
  v_cutoff := least(v_cutoff, v_boundary);

  delete from public.locker_messages
  where league_id = p_league_id
    and created_at < v_cutoff;

  get diagnostics v_deleted = row_count;

  return json_build_object(
    'ok', true,
    'deleted', v_deleted,
    'cutoff', v_cutoff,
    'retention_boundary', v_boundary
  );
end;
$$;

comment on function public.purge_locker_before(uuid, timestamptz) is
  'D-01: Staff-only bulk purge of locker_messages older than a server-capped cutoff (max aggressiveness: now()-7 days). p_before newer than boundary is rejected.';

revoke all on function public.purge_locker_before(uuid, timestamptz) from public;
revoke all on function public.purge_locker_before(uuid, timestamptz) from anon;
grant execute on function public.purge_locker_before(uuid, timestamptz) to authenticated;

commit;

notify pgrst, 'reload schema';

-- =============================================================================
-- POST-APPLY VERIFY (SELECT only — run separately)
-- =============================================================================
-- SELECT pg_get_functiondef(p.oid)
-- FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
-- WHERE n.nspname = 'public' AND p.proname = 'purge_locker_before';
-- -- Expect: is_league_staff; interval '7 days'; reject p_before > boundary
--
-- SELECT grantee, privilege_type
-- FROM information_schema.routine_privileges
-- WHERE routine_schema = 'public'
--   AND routine_name = 'purge_locker_before'
--   AND privilege_type = 'EXECUTE'
-- ORDER BY grantee;
-- -- Expect: authenticated; NOT anon/PUBLIC
--
-- Behavioral tests: docs/D-01-PURGE-LOCKER-BEFORE-REMEDIATION.md §7
--   Especially T7–T11: staff cannot delete messages inside the 7-day window.

-- =============================================================================
-- EMERGENCY ROLLBACK (reopens HIGH defect — prefer fix-forward)
-- =============================================================================
-- begin;
-- -- restore body from supabase/locker-week-purge.sql (member-authorized, no retention)
-- create or replace function public.purge_locker_before(...)
-- ... membership check; delete where created_at < p_before with no boundary ...
-- revoke all on function public.purge_locker_before(uuid, timestamptz) from public;
-- grant execute on function public.purge_locker_before(uuid, timestamptz) to authenticated;
-- commit;
-- notify pgrst, 'reload schema';

-- END D-01 REVIEW-ONLY
