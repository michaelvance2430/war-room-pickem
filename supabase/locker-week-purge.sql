-- ============================================================
-- Locker Room: weekly purge (Mon–Sun board, not full season)
-- Run once in Supabase → SQL Editor → Run
-- ============================================================

-- Any league member can trigger purge of *old* messages for their league
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

  if not exists (
    select 1 from public.memberships m
    where m.league_id = p_league_id and m.user_id = v_uid
  ) and not exists (
    select 1 from public.leagues l
    where l.id = p_league_id and l.commissioner_id = v_uid
  ) then
    raise exception 'Not in this league';
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

revoke all on function public.purge_locker_before(uuid, timestamptz) from public;
grant execute on function public.purge_locker_before(uuid, timestamptz) to authenticated;

notify pgrst, 'reload schema';
