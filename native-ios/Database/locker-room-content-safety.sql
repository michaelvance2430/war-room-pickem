-- Apple/TestFlight user-generated content reporting queue.
-- Apply as a single production migration after verification.

create table if not exists public.locker_message_reports (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.locker_messages(id) on delete cascade,
  league_id uuid not null references public.leagues(id) on delete cascade,
  reporter_user_id uuid not null references public.profiles(id) on delete restrict,
  reported_user_id uuid not null references public.profiles(id) on delete restrict,
  reason text not null default 'abuse' check (char_length(reason) between 1 and 500),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (message_id, reporter_user_id)
);

alter table public.locker_message_reports enable row level security;

revoke all on table public.locker_message_reports from public, anon, authenticated;
grant select, insert on table public.locker_message_reports to authenticated;

drop policy if exists "Players can read their own locker reports" on public.locker_message_reports;
create policy "Players can read their own locker reports"
on public.locker_message_reports
for select
to authenticated
using ((select auth.uid()) = reporter_user_id);

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
    from public.league_members lm
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
