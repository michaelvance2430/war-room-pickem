-- =============================================================================
-- D1B-B / 04-rpc-join-by-code.sql
-- REVIEW ONLY — DO NOT APPLY TO LIVE WITHOUT SEPARATE STAGE AUTH
-- =============================================================================
-- B1 path 2 + B3 code privacy (code never listed; accepted as input only).
-- Concurrency: lock league row FOR UPDATE before capacity check (B2).
-- =============================================================================

create or replace function public.join_league_by_code(p_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_code text := upper(trim(coalesce(p_code, '')));
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

  if v_code = '' or char_length(v_code) > 16 then
    perform public.d1b_b_raise('invalid_code');
  end if;

  -- Lock target league for capacity race (B2)
  select * into v_league
  from public.leagues l
  where l.code = v_code
  for update;

  if not found then
    perform public.d1b_b_raise('invalid_code');
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
      'code', v_league.code,
      'sport_id', v_league.sport_id,
      'name', v_league.name
    );
  end if;

  v_max := public.d1b_b_max_human_members(v_league.id);
  v_humans := public.d1b_b_human_member_count(v_league.id);

  if v_humans >= v_max then
    perform public.d1b_b_raise('league_full');
  end if;

  -- Division placement (independent of Fair Entry points)
  v_div := public.d1b_b_next_division(v_league.id);
  -- Fair Entry total_points under same league lock (exclude joiner)
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

  -- D-03 first-join is required history: failure rolls back join (R4).
  perform public.record_league_first_join(v_league.id, v_uid);

  return json_build_object(
    'ok', true,
    'already_member', false,
    'league_id', v_league.id,
    'code', v_league.code,
    'sport_id', v_league.sport_id,
    'name', v_league.name,
    'division', v_div,
    'total_points', v_pts
  );
exception
  when unique_violation then
    -- Concurrent insert lost race — treat as rejoin if now member
    if exists (
      select 1 from public.memberships m
      where m.league_id = v_league.id and m.user_id = v_uid
    ) then
      return json_build_object(
        'ok', true,
        'already_member', true,
        'league_id', v_league.id,
        'code', v_league.code
      );
    end if;
    perform public.d1b_b_raise('league_full', 'unique_race');
    return json_build_object('ok', false);
end;
$$;

comment on function public.join_league_by_code(text) is
  'D1B-B REVIEW-ONLY: join by private code with human capacity lock. No production apply yet.';

revoke all on function public.join_league_by_code(text) from public;
revoke all on function public.join_league_by_code(text) from anon;
grant execute on function public.join_league_by_code(text) to authenticated;

-- END 04 — REVIEW ONLY
