-- Native iOS push registration and durable notification queue.
-- APNs delivery is performed by the push-notifications Edge Function.

create table if not exists public.push_device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  device_token text not null unique check (device_token ~ '^[0-9a-f]{64,200}$'),
  platform text not null default 'ios' check (platform = 'ios'),
  environment text not null default 'production' check (environment in ('development', 'production')),
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp()
);

alter table public.push_device_tokens enable row level security;
revoke all on public.push_device_tokens from anon;
grant select, insert, update, delete on public.push_device_tokens to authenticated;

drop policy if exists push_tokens_select_own on public.push_device_tokens;
create policy push_tokens_select_own on public.push_device_tokens
  for select to authenticated using (user_id = auth.uid());
drop policy if exists push_tokens_insert_own on public.push_device_tokens;
create policy push_tokens_insert_own on public.push_device_tokens
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists push_tokens_update_own on public.push_device_tokens;
create policy push_tokens_update_own on public.push_device_tokens
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists push_tokens_delete_own on public.push_device_tokens;
create policy push_tokens_delete_own on public.push_device_tokens
  for delete to authenticated using (user_id = auth.uid());

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.push_notification_outbox (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique,
  league_id uuid not null references public.leagues(id) on delete cascade,
  kind text not null check (kind in ('card_built', 'card_lock_12h', 'card_lock_1h', 'announcement')),
  title text not null,
  body text not null,
  destination text not null check (destination in ('picks', 'announcements')),
  week_number integer,
  deliver_at timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'sent', 'failed')),
  attempt_count integer not null default 0,
  last_error text,
  created_at timestamptz not null default clock_timestamp(),
  processed_at timestamptz
);

create index if not exists push_notification_outbox_due_idx
  on private.push_notification_outbox (deliver_at, status)
  where status in ('pending', 'failed');

create or replace function private.queue_card_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_card public.week_cards%rowtype;
  v_league_name text;
  v_lock_at timestamptz;
begin
  select wc.* into v_card from public.week_cards wc where wc.id = new.week_card_id;
  if not found or (select count(*) from public.card_games cg where cg.week_card_id = new.week_card_id) <> 5 then
    return new;
  end if;
  select l.name into v_league_name from public.leagues l where l.id = v_card.league_id;
  select min(cg.start_time::timestamptz) into v_lock_at
  from public.card_games cg where cg.week_card_id = new.week_card_id;

  insert into private.push_notification_outbox(event_key, league_id, kind, title, body, destination, week_number, deliver_at)
  select event_key, league_id, kind, title, body, destination, week_number, deliver_at
  from (values
    ('card-built:' || v_card.id, v_card.league_id, 'card_built',
      'Week ' || v_card.week_number || ' card is live',
      v_league_name || ' is ready. Make your picks before the card locks.', 'picks', v_card.week_number, clock_timestamp()),
    ('card-lock-12h:' || v_card.id, v_card.league_id, 'card_lock_12h',
      'Card locks in 12 hours',
      'Week ' || v_card.week_number || ' in ' || v_league_name || ' is closing soon. Get your picks on the record.', 'picks', v_card.week_number, v_lock_at - interval '12 hours'),
    ('card-lock-1h:' || v_card.id, v_card.league_id, 'card_lock_1h',
      'FINAL WARNING · 1 HOUR',
      'Week ' || v_card.week_number || ' in ' || v_league_name || ' locks in one hour. Finish and confirm your card.', 'picks', v_card.week_number, v_lock_at - interval '1 hour')
  ) as queued(event_key, league_id, kind, title, body, destination, week_number, deliver_at)
  where queued.kind = 'card_built' or queued.deliver_at > clock_timestamp()
  on conflict (event_key) do update set
    title = excluded.title, body = excluded.body, deliver_at = excluded.deliver_at,
    status = 'pending', attempt_count = 0, last_error = null, processed_at = null;
  return new;
end;
$$;

drop trigger if exists queue_card_notifications on public.card_games;
create trigger queue_card_notifications
after insert on public.card_games
for each row execute function private.queue_card_notifications();

create or replace function private.queue_announcement_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_league_name text;
begin
  select l.name into v_league_name from public.leagues l where l.id = new.league_id;
  insert into private.push_notification_outbox(event_key, league_id, kind, title, body, destination, deliver_at)
  values ('announcement:' || new.id, new.league_id, 'announcement', new.title,
    v_league_name || ': ' || left(new.body, 180), 'announcements', clock_timestamp())
  on conflict (event_key) do nothing;
  return new;
end;
$$;

drop trigger if exists queue_announcement_notification on public.announcements;
create trigger queue_announcement_notification
after insert on public.announcements
for each row execute function private.queue_announcement_notification();

create or replace function public.claim_push_notification_batch(p_limit integer default 20)
returns table (
  id uuid, league_id uuid, kind text, title text, body text,
  destination text, week_number integer, deliver_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Service role required'; end if;
  return query
  with claimed as (
    select o.id from private.push_notification_outbox o
    where o.deliver_at <= clock_timestamp()
      and (o.status = 'pending' or (o.status = 'failed' and o.attempt_count < 5))
    order by o.deliver_at
    for update skip locked
    limit least(greatest(p_limit, 1), 100)
  ), updated as (
    update private.push_notification_outbox o
    set status = 'processing', attempt_count = attempt_count + 1, last_error = null
    from claimed where o.id = claimed.id
    returning o.*
  )
  select u.id, u.league_id, u.kind, u.title, u.body, u.destination, u.week_number, u.deliver_at
  from updated u;
end;
$$;

create or replace function public.complete_push_notification(p_id uuid, p_error text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then raise exception 'Service role required'; end if;
  update private.push_notification_outbox
  set status = case when p_error is null then 'sent' else 'failed' end,
      last_error = left(p_error, 1000),
      processed_at = case when p_error is null then clock_timestamp() else null end
  where id = p_id;
end;
$$;

revoke all on function public.claim_push_notification_batch(integer) from public, anon, authenticated;
revoke all on function public.complete_push_notification(uuid, text) from public, anon, authenticated;
grant execute on function public.claim_push_notification_batch(integer) to service_role;
grant execute on function public.complete_push_notification(uuid, text) to service_role;
