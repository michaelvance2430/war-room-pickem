create or replace function public.sync_dormant_league_week(p_league_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_league public.leagues%rowtype;
  v_calendar_week integer;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select * into v_league from public.leagues where id = p_league_id for update;
  if not found then raise exception 'League not found'; end if;
  if v_league.commissioner_id <> v_uid then raise exception 'Commissioner only'; end if;
  if lower(coalesce(v_league.sport_id, 'cfb')) not in ('cfb', 'nfl') then
    return jsonb_build_object('week', v_league.current_week, 'advanced', false);
  end if;

  select scw.week_number into v_calendar_week
  from public.sport_card_windows scw
  where scw.sport_id = lower(v_league.sport_id)
    and scw.window_starts_at <= now()
    and scw.week_number <= v_league.regular_season_weeks
  order by scw.window_starts_at desc
  limit 1;

  v_calendar_week := coalesce(v_calendar_week, case when lower(v_league.sport_id) = 'nfl' then 1 else 0 end);

  if v_calendar_week > v_league.current_week
    and not exists (select 1 from public.week_cards wc where wc.league_id = p_league_id)
    and not exists (select 1 from public.week_results wr where wr.league_id = p_league_id)
    and not exists (select 1 from public.picks p where p.league_id = p_league_id)
  then
    update public.leagues set current_week = v_calendar_week where id = p_league_id;
    return jsonb_build_object('week', v_calendar_week, 'advanced', true);
  end if;

  return jsonb_build_object('week', v_league.current_week, 'advanced', false);
end;
$$;

revoke all on function public.sync_dormant_league_week(uuid) from public, anon;
grant execute on function public.sync_dormant_league_week(uuid) to authenticated;
