-- One results event may be retried, but each registered device receives it once.
-- The APNs collapse id in the sender provides an additional provider-side guard.

create table if not exists private.push_notification_deliveries (
  job_id uuid not null references private.push_notification_outbox(id) on delete cascade,
  device_token text not null,
  delivered_at timestamptz not null default clock_timestamp(),
  primary key (job_id, device_token)
);

revoke all on table private.push_notification_deliveries from public, anon, authenticated;

create or replace function public.push_notification_was_delivered(p_job_id uuid, p_device_token text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required';
  end if;
  return exists (
    select 1 from private.push_notification_deliveries d
    where d.job_id = p_job_id and d.device_token = p_device_token
  );
end;
$$;

create or replace function public.record_push_notification_delivery(p_job_id uuid, p_device_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'role', '') <> 'service_role' then
    raise exception 'Service role required';
  end if;
  insert into private.push_notification_deliveries(job_id, device_token)
  values (p_job_id, p_device_token)
  on conflict (job_id, device_token) do nothing;
end;
$$;

revoke all on function public.push_notification_was_delivered(uuid, text) from public, anon, authenticated;
revoke all on function public.record_push_notification_delivery(uuid, text) from public, anon, authenticated;
grant execute on function public.push_notification_was_delivered(uuid, text) to service_role;
grant execute on function public.record_push_notification_delivery(uuid, text) to service_role;
