-- BUILD 21 REVIEW ONLY. Schedule only after the Fieldhouse postseason schema
-- and fieldhouse-tournament-results Edge Function are deployed and verified.

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare v_job_id bigint;
begin
  select jobid into v_job_id from cron.job where jobname='war-room-fieldhouse-tournament-results';
  if v_job_id is not null then perform cron.unschedule(v_job_id); end if;
end $$;

select cron.schedule(
  'war-room-fieldhouse-tournament-results',
  '* * * * *',
  $cron$
  select net.http_post(
    url:='https://dorhjepugsjpmnuzdzck.supabase.co/functions/v1/fieldhouse-tournament-results',
    headers:=jsonb_build_object(
      'Content-Type','application/json',
      'Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='war_room_push_anon_key'),
      'x-war-room-cron-secret',(select decrypted_secret from vault.decrypted_secrets where name='war_room_fieldhouse_cron_secret')
    ),
    body:='{}'::jsonb,
    timeout_milliseconds:=30000
  );
  $cron$
);
