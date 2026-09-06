-- BUILD 21 REVIEW ONLY. Install only after the calendar schema, seed rows,
-- worker authorization, and sport-schedule-sync Edge Function pass production
-- read-back. The provider /events endpoint costs zero usage credits.

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare v_job_id bigint;
begin
  select jobid into v_job_id
  from cron.job
  where jobname = 'war-room-sport-schedule-sync';
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
end;
$$;

select cron.schedule(
  'war-room-sport-schedule-sync',
  '15 10 * * *',
  $cron$
  select net.http_post(
    url := 'https://dorhjepugsjpmnuzdzck.supabase.co/functions/v1/sport-schedule-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'war_room_push_anon_key'
      ),
      'x-war-room-cron-secret', (
        select decrypted_secret from vault.decrypted_secrets
        where name = 'war_room_sport_schedule_cron_secret'
      )
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $cron$
);
