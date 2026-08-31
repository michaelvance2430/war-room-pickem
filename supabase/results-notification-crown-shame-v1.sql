-- Future results notifications name every weekly Crown and Shame tie and route
-- directly to the league/week Dispatch. Existing outbox rows are untouched.

create or replace function private.queue_results_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_league_name text;
  v_crown_names text;
  v_shame_names text;
  v_crown_points integer;
  v_shame_points integer;
begin
  select l.name into v_league_name from public.leagues l where l.id = new.league_id;

  select max(pk.total_points), min(pk.total_points)
    into v_crown_points, v_shame_points
  from public.picks pk
  where pk.league_id = new.league_id and pk.week_number = new.week_number
    and pk.locked_at is not null and pk.total_points is not null;

  select string_agg(coalesce(m.display_name_override, p.display_name, 'Unknown'), ' & '
                    order by coalesce(m.display_name_override, p.display_name, 'Unknown'))
    into v_crown_names
  from public.picks pk
  join public.memberships m on m.league_id = pk.league_id and m.user_id = pk.user_id
  join public.profiles p on p.id = pk.user_id
  where pk.league_id = new.league_id and pk.week_number = new.week_number
    and pk.locked_at is not null and pk.total_points = v_crown_points;

  select string_agg(coalesce(m.display_name_override, p.display_name, 'Unknown'), ' & '
                    order by coalesce(m.display_name_override, p.display_name, 'Unknown'))
    into v_shame_names
  from public.picks pk
  join public.memberships m on m.league_id = pk.league_id and m.user_id = pk.user_id
  join public.profiles p on p.id = pk.user_id
  where pk.league_id = new.league_id and pk.week_number = new.week_number
    and pk.locked_at is not null and pk.total_points = v_shame_points;

  insert into private.push_notification_outbox(
    event_key, league_id, kind, title, body, destination, week_number, deliver_at
  ) values (
    'results-in:' || new.league_id || ':' || new.week_number,
    new.league_id,
    'results_in',
    'Week ' || new.week_number || ' results are in',
    case when v_crown_names is not null and v_shame_names is not null then
      'Crown: ' || v_crown_names || ' — ' || v_crown_points || case when v_crown_points = 1 then ' point. Shame: ' else ' points. Shame: ' end ||
      v_shame_names || ' — ' || v_shame_points || case when v_shame_points = 1 then ' point. Tap to open the Week ' else ' points. Tap to open the Week ' end ||
      new.week_number || ' Dispatch.'
    else
      v_league_name || ' has been scored. Tap to open the Week ' || new.week_number || ' Dispatch.'
    end,
    'results',
    new.week_number,
    clock_timestamp()
  )
  on conflict (event_key) do nothing;
  return new;
end;
$$;

revoke all on function private.queue_results_notification() from public, anon, authenticated;
