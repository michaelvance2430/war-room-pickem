-- =============================================================================
-- D1B-B / 03-rpc-create-league.sql
-- REVIEW ONLY — DO NOT APPLY TO LIVE WITHOUT SEPARATE STAGE AUTH
-- =============================================================================
-- B5 atomic create + commissioner seat. B1 path 1.
-- =============================================================================

create or replace function public.create_league_with_commissioner_seat(
  p_name text,
  p_sport_id text default 'cfb',
  p_list_as_open boolean default false,
  p_crystal_ball_enabled boolean default true,
  p_current_week integer default 0,
  p_cut_percent integer default null,
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
  v_sport text := lower(trim(coalesce(p_sport_id, 'cfb')));
  v_code text;
  v_league_id uuid;
  v_max int := coalesce(p_max_human_members, 32);
  v_week int := coalesce(p_current_week, 0);
begin
  if v_uid is null then
    perform public.d1b_b_raise('not_authenticated');
  end if;

  if v_name = '' or char_length(v_name) > 80 then
    perform public.d1b_b_raise('validation_failed', 'name');
  end if;

  if v_sport not in ('cfb', 'nfl') then
    -- extend allowlist as product adds sports
    if v_sport is null or v_sport = '' then
      v_sport := 'cfb';
    end if;
  end if;

  if v_max < 2 or v_max > 64 then
    perform public.d1b_b_raise('validation_failed', 'max_human_members');
  end if;

  v_code := public.d1b_b_generate_league_code();

  insert into public.leagues (
    name,
    code,
    commissioner_id,
    sport_id,
    crystal_ball_enabled,
    current_week,
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
    case when p_list_as_open then true else false end,
    case when p_list_as_open then now() else null end,
    v_max
  )
  returning id into v_league_id;

  -- Commissioner membership — forced role and safe defaults (B1/B5)
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

  -- First-join history (D-03 function; ignore if unavailable)
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
    'max_human_members', v_max,
    'is_open', p_list_as_open
  );
exception
  when unique_violation then
    perform public.d1b_b_raise('validation_failed', 'unique_violation');
    return json_build_object('ok', false);
end;
$$;

comment on function public.create_league_with_commissioner_seat(text, text, boolean, boolean, integer, integer, integer) is
  'D1B-B REVIEW-ONLY: atomic league + commissioner seat. Do not apply without stage auth.';

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
