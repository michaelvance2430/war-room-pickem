-- Fieldhouse tournament core: official 68-team field, 67-decision brackets,
-- immutable locks, commissioner results, and auditable scorecards.
begin;

create table if not exists public.cbb_tournament_slates (
  league_id uuid not null references public.leagues(id) on delete cascade,
  season_key integer not null,
  teams jsonb not null check (jsonb_typeof(teams) = 'array'),
  games jsonb not null check (jsonb_typeof(games) = 'array'),
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (league_id, season_key)
);

create table if not exists public.cbb_tournament_entries (
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  season_key integer not null,
  picks jsonb not null default '{}'::jsonb check (jsonb_typeof(picks) = 'object'),
  used_hellfire boolean not null default false,
  locked_at timestamptz,
  score integer,
  updated_at timestamptz not null default now(),
  primary key (league_id, user_id, season_key),
  foreign key (league_id, season_key)
    references public.cbb_tournament_slates(league_id, season_key) on delete cascade
);

create table if not exists public.cbb_tournament_results (
  league_id uuid not null references public.leagues(id) on delete cascade,
  season_key integer not null,
  winners jsonb not null default '{}'::jsonb check (jsonb_typeof(winners) = 'object'),
  updated_at timestamptz not null default now(),
  primary key (league_id, season_key),
  foreign key (league_id, season_key)
    references public.cbb_tournament_slates(league_id, season_key) on delete cascade
);

create table if not exists public.cbb_tournament_scorecards (
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  season_key integer not null,
  first_four_points integer not null default 0,
  round_64_points integer not null default 0,
  round_32_points integer not null default 0,
  sweet_16_points integer not null default 0,
  elite_8_points integer not null default 0,
  final_four_points integer not null default 0,
  title_points integer not null default 0,
  total_points integer not null default 0,
  used_hellfire boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (league_id, user_id, season_key),
  foreign key (league_id, season_key)
    references public.cbb_tournament_slates(league_id, season_key) on delete cascade
);

create index if not exists cbb_tournament_entries_user_idx
  on public.cbb_tournament_entries(user_id);
create index if not exists cbb_tournament_entries_league_season_idx
  on public.cbb_tournament_entries(league_id, season_key);
create index if not exists cbb_tournament_scorecards_user_idx
  on public.cbb_tournament_scorecards(user_id);

alter table public.cbb_tournament_slates enable row level security;
alter table public.cbb_tournament_entries enable row level security;
alter table public.cbb_tournament_results enable row level security;
alter table public.cbb_tournament_scorecards enable row level security;

revoke all on public.cbb_tournament_slates, public.cbb_tournament_entries,
  public.cbb_tournament_results, public.cbb_tournament_scorecards
  from public, anon, authenticated;
grant select on public.cbb_tournament_slates, public.cbb_tournament_entries,
  public.cbb_tournament_results, public.cbb_tournament_scorecards to authenticated;

create policy "Active accounts only" on public.cbb_tournament_slates
  as restrictive for all to authenticated
  using ((select private.is_active_account()))
  with check ((select private.is_active_account()));
create policy "Active accounts only" on public.cbb_tournament_entries
  as restrictive for all to authenticated
  using ((select private.is_active_account()))
  with check ((select private.is_active_account()));
create policy "Active accounts only" on public.cbb_tournament_results
  as restrictive for all to authenticated
  using ((select private.is_active_account()))
  with check ((select private.is_active_account()));
create policy "Active accounts only" on public.cbb_tournament_scorecards
  as restrictive for all to authenticated
  using ((select private.is_active_account()))
  with check ((select private.is_active_account()));

create policy "Members read CBB tournament slate"
  on public.cbb_tournament_slates for select to authenticated
  using (public.is_league_member(league_id));
create policy "Players read own CBB tournament bracket"
  on public.cbb_tournament_entries for select to authenticated
  using (user_id = (select auth.uid()) and public.is_league_member(league_id));
create policy "Members read CBB tournament results"
  on public.cbb_tournament_results for select to authenticated
  using (public.is_league_member(league_id));
create policy "Members read CBB tournament scorecards"
  on public.cbb_tournament_scorecards for select to authenticated
  using (public.is_league_member(league_id));

create or replace function public.assert_cbb_tournament_slate(
  p_teams jsonb,
  p_games jsonb
) returns void
language plpgsql
immutable
security invoker
set search_path = public, pg_temp
as $function$
declare
  v_game jsonb;
  v_source text;
  v_round integer;
begin
  if jsonb_typeof(p_teams) <> 'array' or jsonb_array_length(p_teams) <> 68 then
    raise exception 'The Fieldhouse requires exactly 68 teams';
  end if;
  if (select count(distinct team->>'id') from jsonb_array_elements(p_teams) team) <> 68
     or exists(
       select 1 from jsonb_array_elements(p_teams) team
       where coalesce(trim(team->>'id'), '') = ''
          or coalesce(trim(team->>'name'), '') = ''
          or team->>'region' not in ('east', 'west', 'south', 'midwest')
          or (team->>'seed')::integer not between 1 and 16
     ) then
    raise exception 'Every Fieldhouse team needs a unique id, name, region, and seed 1 through 16';
  end if;

  if jsonb_typeof(p_games) <> 'array' or jsonb_array_length(p_games) <> 67 then
    raise exception 'The Fieldhouse bracket requires exactly 67 games';
  end if;
  if (select count(distinct game->>'id') from jsonb_array_elements(p_games) game) <> 67
     or exists(
       select 1 from jsonb_array_elements(p_games) game
       where coalesce(trim(game->>'id'), '') = ''
          or (game->>'round')::integer not between 0 and 6
          or coalesce(game->>'sourceA', '') = ''
          or coalesce(game->>'sourceB', '') = ''
     ) then
    raise exception 'Every Fieldhouse game needs a unique id, round 0 through 6, and two sources';
  end if;

  if (select count(*) from jsonb_array_elements(p_games) game where (game->>'round')::integer = 0) <> 4
     or (select count(*) from jsonb_array_elements(p_games) game where (game->>'round')::integer = 1) <> 32
     or (select count(*) from jsonb_array_elements(p_games) game where (game->>'round')::integer = 2) <> 16
     or (select count(*) from jsonb_array_elements(p_games) game where (game->>'round')::integer = 3) <> 8
     or (select count(*) from jsonb_array_elements(p_games) game where (game->>'round')::integer = 4) <> 4
     or (select count(*) from jsonb_array_elements(p_games) game where (game->>'round')::integer = 5) <> 2
     or (select count(*) from jsonb_array_elements(p_games) game where (game->>'round')::integer = 6) <> 1 then
    raise exception 'Fieldhouse rounds require game counts 4, 32, 16, 8, 4, 2, and 1';
  end if;

  for v_game in select value from jsonb_array_elements(p_games) loop
    v_round := (v_game->>'round')::integer;
    foreach v_source in array array[v_game->>'sourceA', v_game->>'sourceB'] loop
      if v_source like 'team:%' then
        if not exists(
          select 1 from jsonb_array_elements(p_teams) team
          where team->>'id' = substr(v_source, 6)
        ) then raise exception 'A Fieldhouse game references an unknown team'; end if;
      elsif v_source like 'game:%' then
        if not exists(
          select 1 from jsonb_array_elements(p_games) source_game
          where source_game->>'id' = substr(v_source, 6)
            and (source_game->>'round')::integer < v_round
        ) then raise exception 'A Fieldhouse game must reference a game from an earlier round'; end if;
      else
        raise exception 'Fieldhouse sources must begin with team: or game:';
      end if;
    end loop;
  end loop;
end
$function$;

create or replace function public.assert_cbb_tournament_path(
  p_teams jsonb,
  p_games jsonb,
  p_picks jsonb,
  p_require_complete boolean default false
) returns void
language plpgsql
immutable
security invoker
set search_path = public, pg_temp
as $function$
declare
  v_game jsonb;
  v_game_id text;
  v_source_a text;
  v_source_b text;
  v_team_a text;
  v_team_b text;
  v_winner text;
begin
  if jsonb_typeof(p_picks) <> 'object' then
    raise exception 'Fieldhouse bracket decisions must be a JSON object';
  end if;
  if exists(
    select 1 from jsonb_object_keys(p_picks) key
    where not exists(select 1 from jsonb_array_elements(p_games) game where game->>'id' = key)
  ) then raise exception 'Unknown Fieldhouse bracket decision'; end if;
  if p_require_complete and (select count(*) from jsonb_object_keys(p_picks)) <> 67 then
    raise exception 'The Fieldhouse bracket requires all 67 decisions';
  end if;

  for v_game in
    select value from jsonb_array_elements(p_games)
    order by (value->>'round')::integer, value->>'id'
  loop
    v_game_id := v_game->>'id';
    if not (p_picks ? v_game_id) then continue; end if;
    v_source_a := v_game->>'sourceA';
    v_source_b := v_game->>'sourceB';
    v_team_a := case when v_source_a like 'team:%' then substr(v_source_a, 6)
                     else p_picks->>substr(v_source_a, 6) end;
    v_team_b := case when v_source_b like 'team:%' then substr(v_source_b, 6)
                     else p_picks->>substr(v_source_b, 6) end;
    if v_team_a is null or v_team_b is null then
      raise exception 'A Fieldhouse winner cannot be selected before both source games';
    end if;
    v_winner := p_picks->>v_game_id;
    if v_winner not in (v_team_a, v_team_b) then
      raise exception 'A Fieldhouse winner did not play in that game';
    end if;
  end loop;
end
$function$;

revoke all on function public.assert_cbb_tournament_slate(jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function public.assert_cbb_tournament_path(jsonb, jsonb, jsonb, boolean)
  from public, anon, authenticated;

create or replace function public.validate_cbb_tournament_slate() returns trigger
language plpgsql security invoker set search_path = public, pg_temp
as $function$
begin
  if tg_op = 'UPDATE'
     and (new.teams is distinct from old.teams or new.games is distinct from old.games)
     and exists(
       select 1 from public.cbb_tournament_entries entry
       where entry.league_id = old.league_id
         and entry.season_key = old.season_key
         and entry.locked_at is not null
     ) then raise exception 'The Fieldhouse field is frozen after the first bracket lock'; end if;
  perform public.assert_cbb_tournament_slate(new.teams, new.games);
  new.updated_at := now();
  return new;
end
$function$;

create or replace function public.validate_cbb_tournament_entry() returns trigger
language plpgsql security invoker set search_path = public, pg_temp
as $function$
declare v_slate public.cbb_tournament_slates%rowtype;
begin
  if not (select private.is_active_account()) then
    raise exception 'An active War Room account is required';
  end if;
  if tg_op = 'UPDATE' and old.locked_at is not null
     and (new.picks is distinct from old.picks
       or new.used_hellfire is distinct from old.used_hellfire
       or new.locked_at is distinct from old.locked_at) then
    raise exception 'This Fieldhouse bracket is already sealed';
  end if;
  select * into v_slate from public.cbb_tournament_slates
  where league_id = new.league_id and season_key = new.season_key;
  if not found then raise exception 'Official Fieldhouse bracket not found'; end if;
  perform public.assert_cbb_tournament_path(v_slate.teams, v_slate.games, new.picks, new.locked_at is not null);
  new.updated_at := now();
  return new;
end
$function$;

create or replace function public.validate_cbb_tournament_results() returns trigger
language plpgsql security invoker set search_path = public, pg_temp
as $function$
declare v_slate public.cbb_tournament_slates%rowtype;
begin
  if tg_op = 'UPDATE' and exists(
    select 1 from jsonb_each_text(old.winners) old_winner
    where new.winners->>old_winner.key is distinct from old_winner.value
  ) then raise exception 'Recorded Fieldhouse winners are permanent'; end if;
  select * into v_slate from public.cbb_tournament_slates
  where league_id = new.league_id and season_key = new.season_key;
  if not found then raise exception 'Official Fieldhouse bracket not found'; end if;
  perform public.assert_cbb_tournament_path(v_slate.teams, v_slate.games, new.winners, false);
  new.updated_at := now();
  return new;
end
$function$;

revoke all on function public.validate_cbb_tournament_slate() from public, anon, authenticated;
revoke all on function public.validate_cbb_tournament_entry() from public, anon, authenticated;
revoke all on function public.validate_cbb_tournament_results() from public, anon, authenticated;

create trigger validate_cbb_tournament_slate
  before insert or update on public.cbb_tournament_slates
  for each row execute function public.validate_cbb_tournament_slate();
create trigger validate_cbb_tournament_entry
  before insert or update on public.cbb_tournament_entries
  for each row execute function public.validate_cbb_tournament_entry();
create trigger validate_cbb_tournament_results
  before insert or update on public.cbb_tournament_results
  for each row execute function public.validate_cbb_tournament_results();

create or replace function public.publish_cbb_tournament_slate(
  p_league_id uuid,
  p_season_key integer,
  p_teams jsonb,
  p_games jsonb
) returns public.cbb_tournament_slates
language plpgsql security definer set search_path = public, pg_temp
as $function$
declare v_slate public.cbb_tournament_slates;
begin
  if not (select private.is_active_account()) then raise exception 'An active War Room account is required'; end if;
  if not exists(
    select 1 from public.leagues league
    where league.id = p_league_id and league.sport_id = 'cbb'
      and league.commissioner_id = (select auth.uid())
  ) then raise exception 'Fieldhouse commissioner authority required'; end if;
  insert into public.cbb_tournament_slates(league_id, season_key, teams, games, published_at)
  values(p_league_id, p_season_key, p_teams, p_games, now())
  on conflict(league_id, season_key) do update
    set teams = excluded.teams, games = excluded.games,
        published_at = now(), updated_at = now()
  returning * into v_slate;
  return v_slate;
end
$function$;

create or replace function public.save_cbb_tournament_bracket(
  p_league_id uuid,
  p_season_key integer,
  p_picks jsonb,
  p_used_hellfire boolean default false,
  p_lock boolean default false
) returns public.cbb_tournament_entries
language plpgsql security definer set search_path = public, pg_temp
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_entry public.cbb_tournament_entries;
  v_league public.leagues%rowtype;
  v_slate public.cbb_tournament_slates%rowtype;
begin
  if not (select private.is_active_account()) then raise exception 'An active War Room account is required'; end if;
  select * into v_league from public.leagues where id = p_league_id;
  if v_uid is null or not found or v_league.sport_id <> 'cbb'
     or not public.is_league_member(p_league_id) then
    raise exception 'Fieldhouse league membership required';
  end if;
  select * into v_slate from public.cbb_tournament_slates
  where league_id = p_league_id and season_key = p_season_key;
  if not found then raise exception 'The commissioner has not published the official Fieldhouse bracket'; end if;
  perform public.assert_cbb_tournament_path(v_slate.teams, v_slate.games, p_picks, p_lock);
  if p_used_hellfire and not p_lock then
    raise exception 'A Hellfire-generated Fieldhouse bracket must be sealed immediately';
  end if;

  insert into public.cbb_tournament_entries(
    league_id, user_id, season_key, picks, used_hellfire, locked_at
  ) values(
    p_league_id, v_uid, p_season_key, p_picks, p_used_hellfire,
    case when p_lock then now() else null end
  )
  on conflict(league_id, user_id, season_key) do update
    set picks = excluded.picks,
        used_hellfire = excluded.used_hellfire,
        locked_at = excluded.locked_at,
        updated_at = now()
  where public.cbb_tournament_entries.locked_at is null
  returning * into v_entry;
  if not found then raise exception 'This Fieldhouse bracket is already sealed'; end if;

  if p_used_hellfire then
    insert into public.weapon_service_events(
      user_id, league_id, league_name, sport_id, season_year, week_number,
      weapon_type, phase, source_event_id, decisions_changed, fact_payload
    ) values(
      v_uid, p_league_id, v_league.name, 'cbb', p_season_key, v_league.current_week,
      'hellfire', 'postseason',
      'cbb-hellfire-' || p_league_id || '-' || v_uid || '-' || p_season_key,
      67, jsonb_build_object('entry', 'fieldhouse_bracket')
    ) on conflict(source_event_id) do nothing;
    insert into public.weapon_service_totals(user_id, hellfires, total_authorizations)
    values(v_uid, 1, 1)
    on conflict(user_id) do update
      set hellfires = public.weapon_service_totals.hellfires + 1,
          total_authorizations = public.weapon_service_totals.total_authorizations + 1,
          updated_at = now();
  end if;
  return v_entry;
end
$function$;

create or replace function public.save_cbb_tournament_results(
  p_league_id uuid,
  p_season_key integer,
  p_winners jsonb
) returns public.cbb_tournament_results
language plpgsql security definer set search_path = public, pg_temp
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_row public.cbb_tournament_results;
  v_entry record;
  v_first_four integer;
  v_round_64 integer;
  v_round_32 integer;
  v_sweet_16 integer;
  v_elite_8 integer;
  v_final_four integer;
  v_title integer;
  v_total integer;
begin
  if not (select private.is_active_account()) then raise exception 'An active War Room account is required'; end if;
  if not exists(
    select 1 from public.leagues league
    where league.id = p_league_id and league.sport_id = 'cbb'
      and league.commissioner_id = v_uid
  ) then raise exception 'Fieldhouse commissioner authority required'; end if;

  insert into public.cbb_tournament_results(league_id, season_key, winners)
  values(p_league_id, p_season_key, p_winners)
  on conflict(league_id, season_key) do update
    set winners = excluded.winners, updated_at = now()
  returning * into v_row;

  if (select count(*) from jsonb_object_keys(p_winners)) = 67 then
    for v_entry in
      select entry.*
      from public.cbb_tournament_entries entry
      where entry.league_id = p_league_id
        and entry.season_key = p_season_key
        and entry.locked_at is not null
    loop
      select count(*)::integer into v_first_four
      from jsonb_each_text(p_winners) result
      join jsonb_array_elements((select games from public.cbb_tournament_slates
        where league_id = p_league_id and season_key = p_season_key)) game
        on game->>'id' = result.key and (game->>'round')::integer = 0
      where v_entry.picks->>result.key = result.value;
      select count(*)::integer into v_round_64
      from jsonb_each_text(p_winners) result
      join jsonb_array_elements((select games from public.cbb_tournament_slates
        where league_id = p_league_id and season_key = p_season_key)) game
        on game->>'id' = result.key and (game->>'round')::integer = 1
      where v_entry.picks->>result.key = result.value;
      select (count(*) * 2)::integer into v_round_32
      from jsonb_each_text(p_winners) result
      join jsonb_array_elements((select games from public.cbb_tournament_slates
        where league_id = p_league_id and season_key = p_season_key)) game
        on game->>'id' = result.key and (game->>'round')::integer = 2
      where v_entry.picks->>result.key = result.value;
      select (count(*) * 4)::integer into v_sweet_16
      from jsonb_each_text(p_winners) result
      join jsonb_array_elements((select games from public.cbb_tournament_slates
        where league_id = p_league_id and season_key = p_season_key)) game
        on game->>'id' = result.key and (game->>'round')::integer = 3
      where v_entry.picks->>result.key = result.value;
      select (count(*) * 8)::integer into v_elite_8
      from jsonb_each_text(p_winners) result
      join jsonb_array_elements((select games from public.cbb_tournament_slates
        where league_id = p_league_id and season_key = p_season_key)) game
        on game->>'id' = result.key and (game->>'round')::integer = 4
      where v_entry.picks->>result.key = result.value;
      select (count(*) * 16)::integer into v_final_four
      from jsonb_each_text(p_winners) result
      join jsonb_array_elements((select games from public.cbb_tournament_slates
        where league_id = p_league_id and season_key = p_season_key)) game
        on game->>'id' = result.key and (game->>'round')::integer = 5
      where v_entry.picks->>result.key = result.value;
      select (count(*) * 32)::integer into v_title
      from jsonb_each_text(p_winners) result
      join jsonb_array_elements((select games from public.cbb_tournament_slates
        where league_id = p_league_id and season_key = p_season_key)) game
        on game->>'id' = result.key and (game->>'round')::integer = 6
      where v_entry.picks->>result.key = result.value;
      v_total := v_first_four + v_round_64 + v_round_32 + v_sweet_16
        + v_elite_8 + v_final_four + v_title;

      if not exists(
        select 1 from public.cbb_tournament_scorecards scorecard
        where scorecard.league_id = p_league_id
          and scorecard.user_id = v_entry.user_id
          and scorecard.season_key = p_season_key
      ) then
        insert into public.cbb_tournament_scorecards(
          league_id, user_id, season_key, first_four_points, round_64_points,
          round_32_points, sweet_16_points, elite_8_points, final_four_points,
          title_points, total_points, used_hellfire
        ) values(
          p_league_id, v_entry.user_id, p_season_key, v_first_four, v_round_64,
          v_round_32, v_sweet_16, v_elite_8, v_final_four, v_title, v_total,
          v_entry.used_hellfire
        );
        update public.memberships
        set total_points = total_points + v_total,
            weekly_points = array_append(weekly_points, v_total),
            weeks_played = weeks_played + 1
        where league_id = p_league_id and user_id = v_entry.user_id;
        update public.cbb_tournament_entries
        set score = v_total, updated_at = now()
        where league_id = p_league_id and user_id = v_entry.user_id
          and season_key = p_season_key;
      end if;
    end loop;
  end if;
  return v_row;
end
$function$;

revoke all on function public.publish_cbb_tournament_slate(uuid, integer, jsonb, jsonb)
  from public, anon;
grant execute on function public.publish_cbb_tournament_slate(uuid, integer, jsonb, jsonb)
  to authenticated;
revoke all on function public.save_cbb_tournament_bracket(uuid, integer, jsonb, boolean, boolean)
  from public, anon;
grant execute on function public.save_cbb_tournament_bracket(uuid, integer, jsonb, boolean, boolean)
  to authenticated;
revoke all on function public.save_cbb_tournament_results(uuid, integer, jsonb)
  from public, anon;
grant execute on function public.save_cbb_tournament_results(uuid, integer, jsonb)
  to authenticated;

commit;
