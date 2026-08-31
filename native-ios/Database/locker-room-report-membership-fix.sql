-- Correct Locker Room reporting membership validation.
-- The production membership table is public.memberships.

create or replace function public.report_locker_message(
  p_message_id uuid,
  p_reason text default 'abuse'
) returns uuid
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_reporter uuid := auth.uid();
  v_message public.locker_messages%rowtype;
  v_report_id uuid;
begin
  if v_reporter is null then
    raise exception 'Authentication required';
  end if;

  select * into v_message
  from public.locker_messages
  where id = p_message_id;

  if not found then
    raise exception 'Message not found';
  end if;

  if v_message.user_id = v_reporter then
    raise exception 'You cannot report your own message';
  end if;

  if not exists (
    select 1
    from public.memberships lm
    where lm.league_id = v_message.league_id
      and lm.user_id = v_reporter
  ) then
    raise exception 'League membership required';
  end if;

  insert into public.locker_message_reports (
    message_id, league_id, reporter_user_id, reported_user_id, reason
  ) values (
    v_message.id,
    v_message.league_id,
    v_reporter,
    v_message.user_id,
    left(coalesce(nullif(trim(p_reason), ''), 'abuse'), 500)
  )
  on conflict (message_id, reporter_user_id)
  do update set reason = excluded.reason, status = 'open', created_at = now(), resolved_at = null
  returning id into v_report_id;

  return v_report_id;
end;
$$;

revoke all on function public.report_locker_message(uuid, text) from public, anon;
grant execute on function public.report_locker_message(uuid, text) to authenticated;
