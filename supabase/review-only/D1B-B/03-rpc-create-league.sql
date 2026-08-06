-- =============================================================================
-- D1B-B / 03-rpc-create-league.sql
-- REVIEW ONLY — DO NOT APPLY TO LIVE WITHOUT SEPARATE STAGE AUTH
-- =============================================================================
-- B5 atomic create + commissioner seat. Commissioner total_points = 0 (no FE).
-- cut_percent: validated 0–100, default 50; persisted when column exists.
-- Sport: live allowlist only via d1b_b_normalize_sport_id.
-- =============================================================================

create or replace function public.create_league_with_commissioner_seat(
  p_name text,
  p_sport_id text default 'cfb',
  p_list_as_open boolean default false,
  p_crystal_ball_enabled boolean default true,
  p_current_week integer default 0,
  p_cut_percent integer default 50,
  p_max_human_members integer default 32
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := trim(coalesce(p_name, ''));
  v_sport text;
  v_code text;
  v_league_id uuid;
  v_max int := coalesce(p_max_human_members, 32);
  v_week int := coalesce(p_current_week, 0);
  v_cut int := coalesce(p_cut_percent, 50);
begin
  if v_uid is null then
    perform public.d1b_b_raise('not_authenticated');
  end if;

  if v_name = '' or char_length(v_name) > 80 then
    perform public.d1b_b_raise('validation_failed', 'name');
  end if;

  v_sport := public.d1b_b_normalize_sport_id(p_sport_id);
  if v_sport is null then
    perform public.d1b_b_raise('validation_failed', 'sport');
  end if;

  if v_max < 2 or v_max > 64 then
    perform public.d1b_b_raise('validation_failed', 'max_human');
  end if;

  if v_cut < 0 or v_cut > 100 then
    perform public.d1b_b_raise('validation_failed', 'cut_percent');
  end if;

  if v_week < 0 or v_week > 40 then
    perform public.d1b_b_raise('validation_failed', 'current_week');
  end if;

  v_code := public.d1b_b_generate_league_code();

  begin
    insert into public.leagues (
      name,
      code,
      commissioner_id,
      sport_id,
      crystal_ball_enabled,
      current_week,
      cut_percent,
      is_open,
      open_listed_at,
      max_human_members
    ) values (
      v_name,
      v_code,
      v_uid,
      v_sport,
      coalesce(p_crystal_ball_enabled, true),
      v_week,
      v_cut,
      case when p_list_as_open then true else false end,
      case when p_list_as_open then now() else null end,
      v_max
    )
    returning id into v_league_id;
  exception
    when undefined_column then
      -- Fallback without max_human_members / cut if columns missing (disposable base)
      insert into public.leagues (
        name, code, commissioner_id, sport_id,
        crystal_ball_enabled, current_week, is_open, open_listed_at
      ) values (
        v_name, v_code, v_uid, v_sport,
        coalesce(p_crystal_ball_enabled, true), v_week,
        case when p_list_as_open then true else false end,
        case when p_list_as_open then now() else null end
      )
      returning id into v_league_id;
  end;

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
    v_league_id,
    v_uid,
    'commissioner',
    'North',
    0,
    0,
    false,
    false,
    false,
    false
  );

  begin
    perform public.record_league_first_join(v_league_id, v_uid);
  exception when others then
    null;
  end;

  return json_build_object(
    'ok', true,
    'league_id', v_league_id,
    'code', v_code,
    'sport_id', v_sport,
    'name', v_name,
    'cut_percent', v_cut,
    'max_human_members', v_max,
    'is_open', coalesce(p_list_as_open, false),
    'current_week', v_week
  );
exception
  when unique_violation then
    perform public.d1b_b_raise('validation_failed', 'unique');
    return json_build_object('ok', false);
end;
$$;

comment on function public.create_league_with_commissioner_seat(text, text, boolean, boolean, integer, integer, integer) is
  'D1B-B REVIEW-ONLY: atomic league + commissioner (points 0). Live sports only.';

revoke all on function public.create_league_with_commissioner_seat(
  text, text, boolean, boolean, integer, integer, integer
) from public;
revoke all on function public.create_league_with_commissioner_seat(
  text, text, boolean, boolean, integer, integer, integer
) from anon;
grant execute on function public.create_league_with_commissioner_seat(
  text, text, boolean, boolean, integer, integer, integer
) to authenticated;

-- END 03 — REVIEW ONLY
