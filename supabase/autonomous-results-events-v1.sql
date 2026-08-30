-- Autonomous result completion events.
-- Filing is deferred until transaction commit so atomic scoring has already
-- rebuilt every membership before the Dispatch snapshot reads standings.

alter table private.push_notification_outbox
  drop constraint if exists push_notification_outbox_kind_check;
alter table private.push_notification_outbox
  add constraint push_notification_outbox_kind_check
  check (kind in ('card_built', 'card_lock_12h', 'card_lock_1h', 'announcement', 'results_in'));

alter table private.push_notification_outbox
  drop constraint if exists push_notification_outbox_destination_check;
alter table private.push_notification_outbox
  add constraint push_notification_outbox_destination_check
  check (destination in ('picks', 'announcements', 'results'));

create or replace function private.queue_results_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_league_name text;
begin
  select l.name into v_league_name from public.leagues l where l.id = new.league_id;
  insert into private.push_notification_outbox(
    event_key, league_id, kind, title, body, destination, week_number, deliver_at
  ) values (
    'results-in:' || new.league_id || ':' || new.week_number,
    new.league_id,
    'results_in',
    'Week ' || new.week_number || ' results are in',
    v_league_name || ' has been scored. Open your Scorecard, updated standings, and the new Dispatch.',
    'results',
    new.week_number,
    clock_timestamp()
  )
  on conflict (event_key) do nothing;
  return new;
end;
$$;

drop trigger if exists queue_results_notification on public.week_results;
create trigger queue_results_notification
after insert on public.week_results
for each row execute function private.queue_results_notification();

create or replace function private.file_dispatch_after_scoring()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_league public.leagues%rowtype;
  v_crown_names text[];
  v_shame_names text[];
  v_crown_points integer := 0;
  v_shame_points integer := 0;
  v_week_label text;
  v_payload jsonb;
begin
  select * into v_league from public.leagues where id = new.league_id;
  if not found then return new; end if;

  select coalesce(array_agg(coalesce(m.display_name_override, p.display_name) order by coalesce(m.display_name_override, p.display_name)), array[]::text[]),
         coalesce(max(pk.total_points), 0)
    into v_crown_names, v_crown_points
  from public.picks pk
  join public.memberships m on m.league_id = pk.league_id and m.user_id = pk.user_id
  join public.profiles p on p.id = pk.user_id
  where pk.league_id = new.league_id and pk.week_number = new.week_number
    and pk.locked_at is not null and pk.total_points = (
      select max(total_points) from public.picks
      where league_id = new.league_id and week_number = new.week_number
        and locked_at is not null and total_points is not null
    );

  select coalesce(array_agg(coalesce(m.display_name_override, p.display_name) order by coalesce(m.display_name_override, p.display_name)), array[]::text[]),
         coalesce(min(pk.total_points), 0)
    into v_shame_names, v_shame_points
  from public.picks pk
  join public.memberships m on m.league_id = pk.league_id and m.user_id = pk.user_id
  join public.profiles p on p.id = pk.user_id
  where pk.league_id = new.league_id and pk.week_number = new.week_number
    and pk.locked_at is not null and pk.total_points = (
      select min(total_points) from public.picks
      where league_id = new.league_id and week_number = new.week_number
        and locked_at is not null and total_points is not null
    );

  v_week_label := case when new.week_number = 0 then 'Week 0' else 'Week ' || new.week_number end;
  v_payload := jsonb_build_object(
    'weekIndex', new.week_number,
    'weekLabel', v_week_label,
    'volumeLabel', 'Vol. ' || new.week_number || ' · ' || v_week_label,
    'coverageLine', 'Official results · ' || v_week_label,
    'crown', jsonb_build_object('names', v_crown_names, 'pts', v_crown_points, 'headline', upper(array_to_string(v_crown_names, ' & ')) || ' TAKES THE WEEK', 'deck', 'The official ledger has spoken.', 'kind', case when cardinality(v_crown_names) > 1 then 'tie' else 'clear' end),
    'shame', jsonb_build_object('names', v_shame_names, 'pts', v_shame_points, 'headline', upper(array_to_string(v_shame_names, ' & ')) || ' REPORTS TO FILM STUDY', 'deck', 'There will be questions. None will be gentle.', 'kind', case when cardinality(v_shame_names) > 1 then 'tie' else 'clear' end),
    'masthead', 'THE WAR ROOM DISPATCH',
    'tagline', 'THE OFFICIAL PAPER OF BAD DECISIONS',
    'printedLine', to_char(clock_timestamp() at time zone 'America/New_York', 'FMMonth DD, YYYY'),
    'weather', jsonb_build_object('kicker', 'ROOM FORECAST', 'body', 'Updated standings with a strong chance of receipts.'),
    'classifieds', jsonb_build_array('Scorecards are open. Excuses remain closed.'),
    'pullQuote', jsonb_build_object('text', 'The points are final. The arguments are just beginning.', 'by', 'The Results Desk'),
    'sideStories', jsonb_build_array(),
    'ritualName', case extract(dow from clock_timestamp() at time zone 'America/New_York') when 0 then 'Sunday Paper' when 1 then 'Monday Morning Edition' else 'War Room Late Edition' end,
    'sportId', coalesce(v_league.sport_id, 'cfb')
  );

  insert into public.gazette_editions(league_id, week_number, week_label, volume_label, payload, created_at)
  values (new.league_id, new.week_number, v_week_label, 'Vol. ' || new.week_number || ' · ' || v_week_label, v_payload, clock_timestamp())
  on conflict (league_id, week_number) do update set
    week_label = excluded.week_label,
    volume_label = excluded.volume_label,
    payload = excluded.payload,
    created_at = excluded.created_at;
  return new;
end;
$$;

drop trigger if exists file_dispatch_after_scoring on public.week_results;
create constraint trigger file_dispatch_after_scoring
after insert or update of prop_result, scored_at on public.week_results
deferrable initially deferred
for each row execute function private.file_dispatch_after_scoring();
