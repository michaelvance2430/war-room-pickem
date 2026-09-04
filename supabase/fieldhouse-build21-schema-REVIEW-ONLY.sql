-- BUILD 21 REVIEW ONLY. Do not apply until the production release gate is approved.
-- Makes the shared weekly-card contract support ten-game NCAAM/NCAAW cards,
-- their distinct trophy catalogs, and multi-sport season closeout receipts.

begin;

-- Football divisions and basketball regions are different concepts. Do not overload
-- the legacy North/South/East/West enum: Fieldhouse requires a real Midwest region.
alter table public.memberships add column if not exists fieldhouse_region text;
alter table public.memberships drop constraint if exists memberships_fieldhouse_region_check;
alter table public.memberships add constraint memberships_fieldhouse_region_check
  check (fieldhouse_region is null or fieldhouse_region in ('East','West','South','Midwest'));

create or replace function public.assign_fieldhouse_region()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare v_sport text; v_region text;
begin
  select sport_id into v_sport from public.leagues where id=new.league_id;
  if v_sport not in ('ncaam','ncaaw') then return new; end if;
  if new.fieldhouse_region is not null then return new; end if;
  select r.region into v_region
  from (values ('East',1),('West',2),('South',3),('Midwest',4)) r(region,ord)
  left join public.memberships m on m.league_id=new.league_id and m.fieldhouse_region=r.region
  group by r.region,r.ord order by count(m.user_id),r.ord limit 1;
  new.fieldhouse_region:=v_region;
  return new;
end;
$$;
revoke all on function public.assign_fieldhouse_region() from public,anon,authenticated;

drop trigger if exists assign_fieldhouse_region_before_insert on public.memberships;
create trigger assign_fieldhouse_region_before_insert before insert on public.memberships
for each row execute function public.assign_fieldhouse_region();

with ranked as (
  select m.league_id,m.user_id,
    row_number() over(partition by m.league_id order by m.joined_at,m.user_id) rn
  from public.memberships m join public.leagues l on l.id=m.league_id
  where l.sport_id in ('ncaam','ncaaw') and m.fieldhouse_region is null
)
update public.memberships m set fieldhouse_region=
  (array['East','West','South','Midwest'])[1+((ranked.rn-1)%4)]
from ranked where m.league_id=ranked.league_id and m.user_id=ranked.user_id;

create or replace function public.d1b_b_normalize_sport_id(p_sport text)
returns text
language plpgsql
immutable
as $$
declare
  v text := lower(trim(coalesce(p_sport, '')));
begin
  if v = '' then return 'cfb'; end if;
  if v in ('cfb', 'nfl', 'ncaam', 'ncaaw') then return v; end if;
  return null;
end;
$$;

comment on function public.d1b_b_normalize_sport_id(text) is
  'Build 21 live sport allowlist: cfb, nfl, ncaam, ncaaw. Blank maps to cfb.';

alter table public.pick_games
  drop constraint if exists pick_games_confidence_check;
alter table public.pick_games
  add constraint pick_games_confidence_check
  check (confidence between 1 and 10);

alter table public.leagues
  drop constraint if exists leagues_championship_trophy_id_check;
alter table public.leagues
  add constraint leagues_championship_trophy_id_check check (
    championship_trophy_id is null or championship_trophy_id in (
      'command_cup','golden_gut','the_receipt','insufferable_crown','brass_football','last_one_standing',
      'nfl_sunday_scepter','nfl_gridiron_crown','nfl_fourth_down_forge','nfl_two_minute_monument','nfl_iron_end_zone','nfl_final_whistle',
      'm-iron-rim','m-net-cutter','m-hardwood-crown','m-final-possession','m-glass-house','m-fieldhouse-cup',
      'w-pure-game','w-extra-pass','w-94-feet','w-nylon-standard','w-forty-minutes','w-better-bracket'
    )
  );

-- Fieldhouse regional hardware belongs on the same permanent career shelf as
-- every football trophy. Keep one trophy_type per region so all four winners
-- can be engraved for the same league and season without colliding with the
-- existing (league_id, season_year, trophy_type) uniqueness contract.
alter table public.league_trophies
  drop constraint if exists league_trophies_trophy_type_check;
alter table public.league_trophies
  add constraint league_trophies_trophy_type_check check (
    trophy_type in (
      'championship','toilet_bowl','crystal_ball',
      'division_north','division_south','division_east','division_west',
      'fieldhouse_region_east','fieldhouse_region_west',
      'fieldhouse_region_south','fieldhouse_region_midwest'
    )
  );

alter table public.league_season_closeouts
  drop constraint if exists league_season_closeouts_sport_id_check;
alter table public.league_season_closeouts
  add constraint league_season_closeouts_sport_id_check
  check (sport_id in ('cfb','nfl','cbb','ncaam','ncaaw'));

alter table public.live_football_score_cache
  drop constraint if exists live_football_score_cache_sport_check;
alter table public.live_football_score_cache
  add constraint live_football_score_cache_sport_check
  check (sport in ('cfb','nfl','ncaam','ncaaw'));

alter table public.platform_odds_api_usage
  drop constraint if exists platform_odds_api_usage_sport_check;
alter table public.platform_odds_api_usage
  add constraint platform_odds_api_usage_sport_check
  check (sport is null or sport in ('cfb','nfl','ncaam','ncaaw'));
alter table public.platform_odds_api_usage
  drop constraint if exists platform_odds_api_usage_action_check;
alter table public.platform_odds_api_usage
  add constraint platform_odds_api_usage_action_check
  check (action in ('pull_odds','score_sync','tournament_score_sync'));

create or replace function public.claim_live_football_score_refresh(
  p_sport text,
  p_min_age_seconds int default 25
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed boolean := false;
begin
  if p_sport not in ('cfb', 'nfl', 'ncaam', 'ncaaw') then
    raise exception 'Unsupported sport';
  end if;

  insert into public.live_football_score_cache (sport, last_attempt_at)
  values (p_sport, now())
  on conflict (sport) do update
    set last_attempt_at = excluded.last_attempt_at
    where live_football_score_cache.last_attempt_at is null
       or live_football_score_cache.last_attempt_at < now() - make_interval(secs => greatest(10, p_min_age_seconds))
  returning true into claimed;

  return coalesce(claimed, false);
end;
$$;

revoke all on function public.claim_live_football_score_refresh(text, int) from public, anon, authenticated;
grant execute on function public.claim_live_football_score_refresh(text, int) to service_role;

create or replace function public.create_league_with_commissioner_seat(
  p_name text,
  p_sport_id text default 'cfb',
  p_list_as_open boolean default false,
  p_crystal_ball_enabled boolean default true,
  p_current_week integer default 0,
  p_cut_percent integer default 50,
  p_max_human_members integer default 32,
  p_late_join_policy text default 'reinforcement_credit'
)
returns json
language plpgsql
security definer
set search_path = 'public'
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := trim(coalesce(p_name, ''));
  v_sport text;
  v_policy text := lower(trim(coalesce(p_late_join_policy, 'reinforcement_credit')));
  v_code text;
  v_league_id uuid;
  v_max int := coalesce(p_max_human_members, 32);
  v_week int := coalesce(p_current_week, 0);
  v_cut int := coalesce(p_cut_percent, 50);
  v_is_fieldhouse boolean;
begin
  if v_uid is null then perform public.d1b_b_raise('not_authenticated'); end if;
  if v_name = '' or char_length(v_name) > 80 then perform public.d1b_b_raise('validation_failed', 'name'); end if;

  v_sport := public.d1b_b_normalize_sport_id(p_sport_id);
  if v_sport is null then perform public.d1b_b_raise('validation_failed', 'sport'); end if;
  v_is_fieldhouse := v_sport in ('ncaam', 'ncaaw');

  if v_max < 2 or v_max > 100 then perform public.d1b_b_raise('validation_failed', 'max_human'); end if;
  if v_cut < 10 or v_cut > 75 then perform public.d1b_b_raise('validation_failed', 'cut_percent'); end if;
  if v_week < 0 or v_week > 40 then perform public.d1b_b_raise('validation_failed', 'current_week'); end if;
  if v_policy not in ('reinforcement_credit', 'zero_backfill', 'closed_roster') then
    perform public.d1b_b_raise('validation_failed', 'late_join_policy');
  end if;
  if coalesce(p_list_as_open, false) then v_policy := 'reinforcement_credit'; end if;

  v_code := public.d1b_b_generate_league_code();

  insert into public.leagues (
    name, code, commissioner_id, sport_id, sport_settings,
    crystal_ball_enabled, current_week, cut_percent,
    is_open, open_listed_at, max_human_members, late_join_policy,
    games_per_week
  ) values (
    v_name, v_code, v_uid, v_sport,
    case when v_is_fieldhouse then jsonb_build_object('fieldhouseLeague', v_sport) else '{}'::jsonb end,
    coalesce(p_crystal_ball_enabled, true), v_week, v_cut,
    coalesce(p_list_as_open, false), case when p_list_as_open then now() else null end,
    v_max, v_policy, case when v_is_fieldhouse then 10 else 5 end
  ) returning id into v_league_id;

  insert into public.memberships (
    league_id, user_id, role, division, fieldhouse_region, total_points, weeks_played,
    is_bot, is_deputy, is_moderator, locker_muted
  ) values (
    v_league_id, v_uid, 'commissioner', case when v_is_fieldhouse then 'East' else 'North' end,
    case when v_is_fieldhouse then 'East' else null end,
    0, 0, false, false, false, false
  );

  begin
    perform public.record_league_first_join(v_league_id, v_uid);
  exception when others then null;
  end;

  return json_build_object(
    'ok', true, 'league_id', v_league_id, 'code', v_code,
    'sport_id', v_sport, 'name', v_name, 'cut_percent', v_cut,
    'max_human_members', v_max, 'is_open', coalesce(p_list_as_open, false),
    'current_week', v_week, 'late_join_policy', v_policy
  );
exception
  when unique_violation then
    perform public.d1b_b_raise('validation_failed', 'unique');
    return json_build_object('ok', false);
end;
$$;

revoke all on function public.create_league_with_commissioner_seat(
  text, text, boolean, boolean, integer, integer, integer, text
) from public, anon;
grant execute on function public.create_league_with_commissioner_seat(
  text, text, boolean, boolean, integer, integer, integer, text
) to authenticated;

-- The production notification trigger was originally hard-coded to fire when a
-- five-game football card was complete. Fieldhouse publishes ten games, so use
-- each league's authoritative games_per_week value instead. Event keys remain
-- unique and delivery receipts still enforce one notification per device.
create or replace function private.queue_card_notifications()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_card public.week_cards%rowtype;
  v_league_name text;
  v_games_required integer;
  v_lock_at timestamptz;
begin
  select wc.* into v_card
  from public.week_cards wc
  where wc.id = new.week_card_id;
  if not found then return new; end if;

  select l.name, greatest(1, coalesce(l.games_per_week, 5))
  into v_league_name, v_games_required
  from public.leagues l
  where l.id = v_card.league_id;

  if (select count(*) from public.card_games cg where cg.week_card_id = new.week_card_id) <> v_games_required then
    return new;
  end if;

  select min(cg.start_time::timestamptz) into v_lock_at
  from public.card_games cg
  where cg.week_card_id = new.week_card_id;

  insert into private.push_notification_outbox(
    event_key, league_id, kind, title, body, destination, week_number, deliver_at
  )
  select event_key, league_id, kind, title, body, destination, week_number, deliver_at
  from (values
    ('card-built:' || v_card.id, v_card.league_id, 'card_built',
      'Week ' || v_card.week_number || ' card is live',
      v_league_name || ' is ready. Make your picks before the card locks.',
      'picks', v_card.week_number, clock_timestamp()),
    ('card-lock-12h:' || v_card.id, v_card.league_id, 'card_lock_12h',
      'Card locks in 12 hours',
      'Week ' || v_card.week_number || ' in ' || v_league_name || ' is closing soon. Get your picks on the record.',
      'picks', v_card.week_number, v_lock_at - interval '12 hours'),
    ('card-lock-1h:' || v_card.id, v_card.league_id, 'card_lock_1h',
      'FINAL WARNING · 1 HOUR',
      'Week ' || v_card.week_number || ' in ' || v_league_name || ' locks in one hour. Finish and confirm your card.',
      'picks', v_card.week_number, v_lock_at - interval '1 hour')
  ) as queued(event_key, league_id, kind, title, body, destination, week_number, deliver_at)
  where queued.kind = 'card_built' or queued.deliver_at > clock_timestamp()
  on conflict (event_key) do nothing;

  return new;
end;
$$;
revoke all on function private.queue_card_notifications() from public, anon, authenticated;

commit;

-- Deploy in the same guarded release window, in this order:
--   1. fieldhouse-build21-schema-REVIEW-ONLY.sql
--   2. atomic-card-publish.sql
--   3. atomic-pick-save.sql
--   4. atomic-week-scoring.sql
