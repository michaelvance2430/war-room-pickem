-- Deployment Credit v2
-- Add immutable late-join policy selection to atomic league creation.

drop function if exists public.create_league_with_commissioner_seat(
  text, text, boolean, boolean, integer, integer, integer
);

create function public.create_league_with_commissioner_seat(
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

  if v_max < 2 or v_max > 100 then
    perform public.d1b_b_raise('validation_failed', 'max_human');
  end if;
  if v_cut < 10 or v_cut > 75 then
    perform public.d1b_b_raise('validation_failed', 'cut_percent');
  end if;
  if v_week < 0 or v_week > 40 then
    perform public.d1b_b_raise('validation_failed', 'current_week');
  end if;

  if v_policy not in ('reinforcement_credit', 'zero_backfill', 'closed_roster') then
    perform public.d1b_b_raise('validation_failed', 'late_join_policy');
  end if;

  if coalesce(p_list_as_open, false) then
    v_policy := 'reinforcement_credit';
  end if;

  v_code := public.d1b_b_generate_league_code();

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
    max_human_members,
    late_join_policy
  ) values (
    v_name,
    v_code,
    v_uid,
    v_sport,
    coalesce(p_crystal_ball_enabled, true),
    v_week,
    v_cut,
    coalesce(p_list_as_open, false),
    case when p_list_as_open then now() else null end,
    v_max,
    v_policy
  )
  returning id into v_league_id;

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
    'current_week', v_week,
    'late_join_policy', v_policy
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
