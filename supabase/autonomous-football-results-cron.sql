-- Run the autonomous football results desk once per minute. Supabase verifies
-- the caller JWT; database writes inside the worker still use its server secret.

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname = 'war-room-autonomous-football-results';
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
end
$$;

select cron.schedule(
  'war-room-autonomous-football-results',
  '* * * * *',
  $cron$
  select net.http_post(
    url := 'https://dorhjepugsjpmnuzdzck.supabase.co/functions/v1/autonomous-football-results',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'war_room_push_anon_key'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $cron$
);
