-- Foundry CFB certification v2
-- Week 15 is selection (not a scored card). This Foundry-only transition
-- opens Week 16 and creates a bot-inclusive disposable bracket so the real
-- Championship and Toilet Bowl surfaces can be certified end to end.

create or replace function public.rebuild_foundry_postseason_snapshot(
  p_league_id uuid,
  p_season_key integer
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_league public.leagues%rowtype;
  v_snapshot uuid;
  v_n integer;
  v_q integer;
begin
  select * into v_league from public.leagues where id = p_league_id for update;
  if v_uid <> '09544d2b-6eca-4131-a321-c000586c9029'::uuid
    or not found
    or v_league.mode <> 'foundry'
    or v_league.commissioner_id <> v_uid then
    raise exception 'Creator Foundry only';
  end if;
  if exists (
    select 1 from public.memberships
    where league_id = p_league_id and not is_bot and user_id <> v_uid
  ) then
    raise exception 'Human roster detected';
  end if;

  select count(*) into v_n from public.memberships where league_id = p_league_id;
  if v_n < 8 then raise exception 'Foundry roster incomplete'; end if;
  v_q := greatest(2, least(v_n, ceil(v_n * (100 - v_league.cut_percent)::numeric / 100)::integer));

  delete from public.league_postseason_snapshots
  where league_id = p_league_id and season_key = p_season_key::text;

  insert into public.league_postseason_snapshots(
    league_id, season_key, sport_id, cut_week, cut_percent,
    eligible_human_count, qualifier_count, toilet_bowl_active,
    snapshot_version, creation_reason, created_by, metadata
  ) values (
    p_league_id, p_season_key::text, 'cfb', v_league.regular_season_weeks,
    v_league.cut_percent, v_n, v_q, (v_n - v_q) >= 4,
    1, 'system_backfill', v_uid,
    jsonb_build_object('foundryOnly', true, 'botsIncluded', true)
  ) returning id into v_snapshot;

  with ordered as (
    select
      m.user_id,
      coalesce(nullif(trim(m.display_name_override), ''), p.display_name, 'Foundry Bot') as display_name,
      m.division::text as division,
      greatest(0, coalesce(m.total_points, 0) - coalesce(m.deployment_credit, 0)) as earned_points,
      row_number() over (
        order by greatest(0, coalesce(m.total_points, 0) - coalesce(m.deployment_credit, 0)) desc,
                 coalesce(nullif(trim(m.display_name_override), ''), p.display_name, 'Foundry Bot'),
                 m.user_id
      )::integer as overall_rank
    from public.memberships m
    left join public.profiles p on p.id = m.user_id
    where m.league_id = p_league_id
  ), classified as (
    select *, case when overall_rank <= v_q then 'championship' else 'toilet' end as field
    from ordered
  ), seeded as (
    select *,
      row_number() over (partition by field order by
        case when field = 'championship' then overall_rank else -overall_rank end
      )::integer as field_seed,
      count(*) over (partition by field)::integer as field_count
    from classified
  )
  insert into public.league_postseason_participants(
    snapshot_id, user_id, display_name_snapshot, field, seed, first_round_bye,
    division_snapshot, standings_rank_at_cut, season_points_at_cut
  )
  select
    v_snapshot, user_id, display_name, field, field_seed,
    field_seed <= case
      when field_count <= 2 then 2 - field_count
      when field_count <= 4 then 4 - field_count
      when field_count <= 8 then 8 - field_count
      when field_count <= 16 then 16 - field_count
      else 32 - field_count
    end,
    division, overall_rank, earned_points
  from seeded;

  return v_snapshot;
end;
$$;

create or replace function public.open_foundry_cfb_postseason(
  p_league_id uuid,
  p_season_key integer
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_league public.leagues%rowtype;
  v_snapshot uuid;
  v_seed jsonb;
begin
  select * into v_league from public.leagues where id = p_league_id for update;
  if v_uid <> '09544d2b-6eca-4131-a321-c000586c9029'::uuid
    or not found
    or v_league.mode <> 'foundry'
    or v_league.commissioner_id <> v_uid then
    raise exception 'Creator Foundry only';
  end if;
  if exists (
    select 1 from public.memberships
    where league_id = p_league_id and not is_bot and user_id <> v_uid
  ) then
    raise exception 'Human roster detected';
  end if;
  if v_league.current_week <> v_league.regular_season_weeks + 1 then
    raise exception 'Foundry must be at Bowl Selection';
  end if;
  if not exists (
    select 1 from public.cfb_postseason_slates
    where league_id = p_league_id and season_key = p_season_key
  ) then
    raise exception 'Publish the Foundry postseason slate first';
  end if;

  -- process_foundry_week stages a next card mechanically. Week 15 is a
  -- selection window, so remove that card and its seeded slips atomically.
  delete from public.picks
  where league_id = p_league_id and week_number = v_league.regular_season_weeks + 1;
  delete from public.week_cards
  where league_id = p_league_id and week_number = v_league.regular_season_weeks + 1;

  update public.leagues
  set current_week = regular_season_weeks + 2
  where id = p_league_id;

  insert into public.foundry_season_lifecycle(league_id, stage, week_number, updated_at)
  values (p_league_id, 'postseason_open', v_league.regular_season_weeks + 2, now())
  on conflict (league_id) do update set
    stage = excluded.stage,
    week_number = excluded.week_number,
    updated_at = now();

  v_snapshot := public.rebuild_foundry_postseason_snapshot(p_league_id, p_season_key);
  v_seed := public.seed_foundry_cfb_postseason(p_league_id, p_season_key);

  return jsonb_build_object(
    'ok', true,
    'selectionWeek', v_league.regular_season_weeks + 1,
    'postseasonWeek', v_league.regular_season_weeks + 2,
    'snapshotId', v_snapshot,
    'seeded', v_seed
  );
end;
$$;

revoke all on function public.rebuild_foundry_postseason_snapshot(uuid, integer) from public, anon, authenticated;
revoke all on function public.open_foundry_cfb_postseason(uuid, integer) from public, anon;
grant execute on function public.open_foundry_cfb_postseason(uuid, integer) to authenticated;

notify pgrst, 'reload schema';
