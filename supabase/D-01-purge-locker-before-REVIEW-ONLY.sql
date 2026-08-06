-- =============================================================================
-- D-01 — purge_locker_before authorization harden — REVIEW ONLY
-- =============================================================================
-- DO NOT APPLY without Mike explicit authorization for D-01.
--
-- Defect: any league member can DELETE locker_messages older than caller-controlled
-- p_before; a future timestamp can wipe the entire Locker Room.
-- Evidence: docs/P17-DEFINER-BODY-ACL-EVIDENCE.md · STRUCTURAL-SECURITY-DEFECT-REGISTER D-01
-- Design: docs/D-01-PURGE-LOCKER-BEFORE-REMEDIATION.md
--
-- SCOPE (this file only):
--   1) Require is_league_staff (commissioner OR moderator) — not bare membership
--   2) Reject p_before > now() (defense in depth against full wipe)
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
  v_deleted int := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  -- Staff only: commissioner or moderator (same as locker staff delete policy)
  if not public.is_league_staff(p_league_id) then
    raise exception 'Not authorized to purge locker messages';
  end if;

  -- Prevent full-history wipe via future cutoff (including staff foot-guns)
  if p_before is null or p_before > now() then
    raise exception 'Invalid purge cutoff: p_before must be at or before now()';
  end if;

  delete from public.locker_messages
  where league_id = p_league_id
    and created_at < p_before;

  get diagnostics v_deleted = row_count;

  return json_build_object(
    'ok', true,
    'deleted', v_deleted
  );
end;
$$;

comment on function public.purge_locker_before(uuid, timestamptz) is
  'D-01: Staff-only (commissioner/moderator) purge of locker_messages before p_before; p_before must be <= now().';

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
-- -- Expect: is_league_staff; p_before > now() guard
--
-- SELECT grantee, privilege_type
-- FROM information_schema.routine_privileges
-- WHERE routine_schema = 'public'
--   AND routine_name = 'purge_locker_before'
--   AND privilege_type = 'EXECUTE'
-- ORDER BY grantee;
-- -- Expect: authenticated (and maybe service/postgres); NOT anon/PUBLIC
--
-- Behavioral tests: docs/D-01-PURGE-LOCKER-BEFORE-REMEDIATION.md §7

-- =============================================================================
-- EMERGENCY ROLLBACK (reopens HIGH defect — prefer fix-forward)
-- =============================================================================
-- begin;
-- -- restore body from supabase/locker-week-purge.sql (member-authorized)
-- create or replace function public.purge_locker_before(p_league_id uuid, p_before timestamptz)
-- ... member membership check version ...
-- revoke all on function public.purge_locker_before(uuid, timestamptz) from public;
-- grant execute on function public.purge_locker_before(uuid, timestamptz) to authenticated;
-- commit;
-- notify pgrst, 'reload schema';

-- END D-01 REVIEW-ONLY
