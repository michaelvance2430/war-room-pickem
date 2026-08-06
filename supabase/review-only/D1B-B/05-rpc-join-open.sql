-- =============================================================================
-- D1B-B / 05-rpc-join-open.sql
-- REVIEW ONLY — DO NOT APPLY TO LIVE WITHOUT SEPARATE STAGE AUTH
-- =============================================================================
-- B1 path 3 + server is_open check + human capacity concurrency.
-- =============================================================================

create or replace function public.join_open_league_by_id(p_league_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_league public.leagues%rowtype;
  v_humans int;
  v_max int;
  v_div public.division;
  v_pts int;
  v_existing uuid;
begin
  if v_uid is null then
    perform public.d1b_b_raise('not_authenticated');
  end if;

  if p_league_id is null then
    perform public.d1b_b_raise('not_found');
  end if;

  select * into v_league
  from public.leagues l
  where l.id = p_league_id
  for update;

  if not found then
    perform public.d1b_b_raise('not_found');
  end if;

  if v_league.is_open is distinct from true then
    perform public.d1b_b_raise('not_open');
  end if;

  select m.id into v_existing
  from public.memberships m
  where m.league_id = v_league.id
    and m.user_id = v_uid;

  if v_existing is not null then
    return json_build_object(
      'ok', true,
      'already_member', true,
      'league_id', v_league.id,
      'name', v_league.name,
      'sport_id', v_league.sport_id
      -- intentionally omit code for open join path privacy
    );
  end if;

  v_max := public.d1b_b_max_human_members(v_league.id);
  v_humans := public.d1b_b_human_member_count(v_league.id);

  if v_humans >= v_max then
    -- best-effort unlist when full
    update public.leagues
    set is_open = false
    where id = v_league.id
      and is_open is true;
    perform public.d1b_b_raise('league_full');
  end if;

  v_div := public.d1b_b_next_division(v_league.id);
  v_pts := public.d1b_b_fair_entry_points(v_league.id, v_uid);

  insert into public.memberships (
    league_id,
    user_id,
    role,
    division,
    total_points,
    weeks_played,
    is_bot,
    is_deputy,
    is_moderator,
    locker_muted
  ) values (
    v_league.id,
    v_uid,
    'player',
    v_div,
    v_pts,
    0,
    false,
    false,
    false,
    false
  );

  -- If this was the last seat, unlist
  if public.d1b_b_human_member_count(v_league.id) >= v_max then
    update public.leagues
    set is_open = false
    where id = v_league.id
      and is_open is true;
  end if;

  begin
    perform public.record_league_first_join(v_league.id, v_uid);
  exception when others then
    null;
  end;

  return json_build_object(
    'ok', true,
    'already_member', false,
    'league_id', v_league.id,
    'name', v_league.name,
    'sport_id', v_league.sport_id,
    'division', v_div,
    'total_points', v_pts
  );
exception
  when unique_violation then
    if exists (
      select 1 from public.memberships m
      where m.league_id = p_league_id and m.user_id = v_uid
    ) then
      return json_build_object(
        'ok', true,
        'already_member', true,
        'league_id', p_league_id
      );
    end if;
    perform public.d1b_b_raise('league_full', 'unique_race');
    return json_build_object('ok', false);
end;
$$;

comment on function public.join_open_league_by_id(uuid) is
  'D1B-B REVIEW-ONLY: join open league by id with is_open + human capacity. No production apply yet.';

revoke all on function public.join_open_league_by_id(uuid) from public;
revoke all on function public.join_open_league_by_id(uuid) from anon;
grant execute on function public.join_open_league_by_id(uuid) to authenticated;

-- END 05 — REVIEW ONLY
