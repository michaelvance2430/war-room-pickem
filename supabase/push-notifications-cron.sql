-- Invoke the JWT-protected APNs sender once per minute.
-- The legacy anon JWT is stored in Supabase Vault as war_room_push_anon_key.

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare
  v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'war-room-push-notifications';

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;
end
$$;

select cron.schedule(
  'war-room-push-notifications',
  '* * * * *',
  $cron$
  select net.http_post(
    url := 'https://dorhjepugsjpmnuzdzck.supabase.co/functions/v1/push-notifications',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'war_room_push_anon_key'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  );
  $cron$
);
