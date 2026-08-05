-- ============================================================
-- League alias (display_name_override) — separate from Museum 1A
-- Run once in Supabase → SQL Editor → Run
--
-- Additive only: no backfill, no profile rewrites, no role changes.
-- ============================================================

begin;

-- ─── Column ──────────────────────────────────────────────────
alter table public.memberships
  add column if not exists display_name_override text null;

comment on column public.memberships.display_name_override is
  'Optional per-league display name. Null/blank = use profiles.display_name. Never rewrite profiles.';

-- Soft length guard (null allowed; empty string should be stored as null by RPC)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'memberships_display_name_override_len'
  ) then
    alter table public.memberships
      add constraint memberships_display_name_override_len
      check (
        display_name_override is null
        or (
          char_length(btrim(display_name_override)) between 2 and 40
        )
      );
  end if;
exception when others then
  raise notice 'memberships_display_name_override_len: %', sqlerrm;
end $$;

-- ─── Validation helper (matches app: 2–40 trim) ─────────────
create or replace function public.normalize_league_display_name(p_raw text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  v text;
begin
  if p_raw is null then
    return null;
  end if;
  v := btrim(regexp_replace(p_raw, '\s+', ' ', 'g'));
  if v = '' then
    return null;
  end if;
  if char_length(v) < 2 then
    raise exception 'Name needs at least 2 characters.';
  end if;
  if char_length(v) > 40 then
    raise exception 'Keep it under 40 characters.';
  end if;
  return v;
end;
$$;

revoke all on function public.normalize_league_display_name(text) from public;
revoke all on function public.normalize_league_display_name(text) from anon;
grant execute on function public.normalize_league_display_name(text) to authenticated;

-- ─── Narrow RPC: only caller's override on one league ───────
create or replace function public.set_my_league_display_name(
  p_league_id uuid,
  p_alias text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_norm text;
  v_account text;
  v_updated int := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if p_league_id is null then
    raise exception 'Missing league';
  end if;

  if not exists (
    select 1 from public.memberships m
    where m.league_id = p_league_id
      and m.user_id = v_uid
  ) then
    raise exception 'Not a member of this league';
  end if;

  v_norm := public.normalize_league_display_name(p_alias);

  -- Same as account name → store null (no duplicate)
  select nullif(btrim(p.display_name), '') into v_account
  from public.profiles p
  where p.id = v_uid;

  if v_norm is not null
     and v_account is not null
     and lower(v_norm) = lower(v_account) then
    v_norm := null;
  end if;

  update public.memberships m
  set display_name_override = v_norm
  where m.league_id = p_league_id
    and m.user_id = v_uid;

  get diagnostics v_updated = row_count;

  return json_build_object(
    'ok', true,
    'league_id', p_league_id,
    'display_name_override', v_norm,
    'updated', v_updated
  );
end;
$$;

revoke all on function public.set_my_league_display_name(uuid, text) from public;
revoke all on function public.set_my_league_display_name(uuid, text) from anon;
grant execute on function public.set_my_league_display_name(uuid, text) to authenticated;

-- ─── Roster: resolved league display name ───────────────────
create or replace function public.get_league_roster(p_league_id uuid)
returns table (
  membership_id uuid,
  user_id uuid,
  display_name text,
  avatar_url text,
  role text,
  division text,
  total_points int,
  is_bot boolean,
  is_moderator boolean,
  locker_muted boolean,
  is_deputy boolean,
  joined_at timestamptz,
  display_name_override text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    m.id as membership_id,
    m.user_id,
    coalesce(
      nullif(btrim(m.display_name_override), ''),
      nullif(btrim(p.display_name), ''),
      'Player'
    ) as display_name,
    p.avatar_url,
    m.role::text,
    m.division::text,
    m.total_points,
    coalesce(m.is_bot, false) as is_bot,
    coalesce(m.is_moderator, false) as is_moderator,
    coalesce(m.locker_muted, false) as locker_muted,
    coalesce(m.is_deputy, false) as is_deputy,
    m.joined_at,
    m.display_name_override
  from public.memberships m
  left join public.profiles p on p.id = m.user_id
  where m.league_id = p_league_id
    and (
      exists (
        select 1 from public.memberships me
        where me.league_id = p_league_id and me.user_id = auth.uid()
      )
      or exists (
        select 1 from public.leagues l
        where l.id = p_league_id and l.commissioner_id = auth.uid()
      )
    )
  order by coalesce(m.is_bot, false), 3 nulls last;
$$;

revoke all on function public.get_league_roster(uuid) from public;
revoke all on function public.get_league_roster(uuid) from anon;
grant execute on function public.get_league_roster(uuid) to authenticated;

-- ─── Museum snapshots: resolve alias at publish (new rows only) ──
-- Only replaces the rebuild function body if Museum Phase 1A is installed.
do $$
begin
  if to_regclass('public.museum_allegiance_snapshots') is null then
    raise notice 'museum_allegiance_snapshots missing — skip rebuild patch';
    return;
  end if;

  execute $fn$
create or replace function public.museum_rebuild_allegiance_snapshots(
  p_league_id uuid,
  p_week_number int,
  p_season int,
  p_sport_id text,
  p_week_card_id uuid,
  p_games jsonb,
  p_first_kickoff_at timestamptz default null
)
returns json
language plpgsql
security definer
set search_path = public
as $body$
declare
  v_uid uuid := auth.uid();
  v_frozen int := 0;
  v_inserted int := 0;
  v_should_freeze boolean := false;
  v_db_kickoff timestamptz;
  g jsonb;
  v_game_key text;
  v_provider text;
  v_away_id text;
  v_home_id text;
  v_away_name text;
  v_home_name text;
  v_card_game_id uuid;
  v_favorite text;
  v_spread numeric;
  v_underdog text;
  v_away_rank int;
  v_home_rank int;
  v_rank_source text;
  v_row_count int;
  v_card_ok boolean := false;
begin
  if p_league_id is null or p_week_number is null or p_season is null
     or p_sport_id is null or p_week_card_id is null then
    raise exception 'Missing required arguments';
  end if;

  if coalesce(auth.role(), '') = 'service_role' then
    null;
  elsif v_uid is null then
    raise exception 'Not authenticated';
  elsif not public.museum_is_league_ops(p_league_id) then
    raise exception 'Not authorized for this league';
  end if;

  if not public.museum_league_is_production(p_league_id) then
    return json_build_object(
      'ok', true, 'skipped', true, 'reason', 'non_production_league',
      'inserted', 0, 'frozen', false
    );
  end if;

  select exists (
    select 1 from public.week_cards wc
    where wc.id = p_week_card_id
      and wc.league_id = p_league_id
      and wc.week_number = p_week_number
  ) into v_card_ok;
  if not v_card_ok then
    raise exception 'week_card_id does not belong to league/week';
  end if;

  select count(*)::int into v_frozen
  from public.museum_allegiance_snapshots s
  where s.league_id = p_league_id
    and s.week_number = p_week_number
    and s.status = 'frozen';
  if v_frozen > 0 then
    return json_build_object(
      'ok', true, 'skipped', true, 'reason', 'already_frozen',
      'inserted', 0, 'frozen', true
    );
  end if;

  v_db_kickoff := public.museum_card_first_kickoff(p_league_id, p_week_number);
  if v_db_kickoff is not null and v_db_kickoff <= now() then
    v_should_freeze := true;
  elsif p_first_kickoff_at is not null
        and p_first_kickoff_at <= now()
        and v_db_kickoff is null then
    v_should_freeze := true;
  end if;

  delete from public.museum_allegiance_snapshots
  where league_id = p_league_id
    and week_number = p_week_number
    and status = 'prelock';

  if p_games is null or jsonb_typeof(p_games) <> 'array' then
    return json_build_object('ok', true, 'inserted', 0, 'frozen', false, 'games', 0);
  end if;

  for g in select * from jsonb_array_elements(p_games)
  loop
    v_away_id := nullif(trim(g->>'away_team_id'), '');
    v_home_id := nullif(trim(g->>'home_team_id'), '');
    v_away_name := coalesce(nullif(trim(g->>'away_team_name'), ''), 'Away');
    v_home_name := coalesce(nullif(trim(g->>'home_team_name'), ''), 'Home');
    v_provider := nullif(trim(g->>'provider_game_id'), '');
    v_game_key := nullif(trim(g->>'game_identity_key'), '');
    begin
      v_card_game_id := nullif(g->>'card_game_id', '')::uuid;
    exception when others then
      v_card_game_id := null;
    end;
    if v_card_game_id is not null then
      if not exists (
        select 1 from public.card_games cg
        where cg.id = v_card_game_id and cg.week_card_id = p_week_card_id
      ) then
        continue;
      end if;
    end if;
    v_favorite := nullif(trim(g->>'card_favorite'), '');
    if v_favorite is not null and v_favorite not in ('home', 'away') then
      v_favorite := null;
    end if;
    begin
      v_spread := nullif(g->>'card_spread', '')::numeric;
    exception when others then
      v_spread := null;
    end;
    if v_favorite = 'home' then v_underdog := 'away';
    elsif v_favorite = 'away' then v_underdog := 'home';
    else v_underdog := null;
    end if;
    begin
      v_away_rank := nullif(g->>'away_rank', '')::int;
      v_home_rank := nullif(g->>'home_rank', '')::int;
    exception when others then
      v_away_rank := null; v_home_rank := null;
    end;
    v_rank_source := nullif(trim(g->>'rank_source'), '');
    if v_away_id is null or v_home_id is null then continue; end if;
    if v_away_id = 'no-team' or v_home_id = 'no-team' then continue; end if;
    if v_away_id = v_home_id then continue; end if;
    if v_game_key is null or length(v_game_key) = 0 then
      v_game_key := coalesce(v_provider, v_away_id || '|' || v_home_id);
    end if;

    insert into public.museum_allegiance_snapshots (
      league_id, sport_id, season, week_number,
      week_card_id, card_game_id, provider_game_id, game_identity_key,
      away_team_id, home_team_id,
      away_team_name_snapshot, home_team_name_snapshot,
      user_id, display_name_snapshot, favorite_team_id_snapshot,
      represented_side, represented_team_id,
      status, snapshot_at, frozen_at,
      card_favorite, card_spread, underdog_side,
      away_rank, home_rank, rank_source
    )
    select
      p_league_id, trim(p_sport_id), p_season, p_week_number,
      p_week_card_id, v_card_game_id, v_provider, v_game_key,
      v_away_id, v_home_id, v_away_name, v_home_name,
      m.user_id,
      coalesce(
        nullif(btrim(m.display_name_override), ''),
        nullif(btrim(p.display_name), ''),
        'Player'
      ),
      f.team_id,
      case when f.team_id = v_away_id then 'away' else 'home' end,
      f.team_id,
      'prelock', now(), null,
      v_favorite, v_spread, v_underdog,
      v_away_rank, v_home_rank, v_rank_source
    from public.memberships m
    inner join public.profile_favorite_teams f
      on f.user_id = m.user_id and f.sport_id = trim(p_sport_id)
    left join public.profiles p on p.id = m.user_id
    where m.league_id = p_league_id
      and coalesce(m.is_bot, false) = false
      and f.team_id is not null
      and f.team_id <> 'no-team'
      and f.team_id in (v_away_id, v_home_id)
      and m.user_id::text not like 'guest-%'
      and m.user_id::text not like 'eyes-%';

    get diagnostics v_row_count = row_count;
    v_inserted := v_inserted + coalesce(v_row_count, 0);
  end loop;

  if v_should_freeze then
    update public.museum_allegiance_snapshots
    set status = 'frozen', frozen_at = now()
    where league_id = p_league_id
      and week_number = p_week_number
      and status = 'prelock';
  end if;

  return json_build_object(
    'ok', true, 'inserted', v_inserted, 'frozen', v_should_freeze,
    'games', jsonb_array_length(p_games)
  );
end;
$body$;
  $fn$;
end $$;

notify pgrst, 'reload schema';

commit;
