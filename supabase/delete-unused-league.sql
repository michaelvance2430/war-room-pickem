-- Commissioner-only cleanup for abandoned/test rooms.
-- A room becomes permanent at its first kickoff or first durable history row.

create or replace function public.delete_unused_league(
  p_league_id uuid,
  p_confirm_name text
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_name text;
  v_first_kickoff timestamptz;
  v_bad_kickoffs int := 0;
begin
  if v_uid is null then
    raise exception 'delete_league:not_authenticated' using errcode = '42501';
  end if;
  if p_league_id is null or nullif(btrim(p_confirm_name), '') is null then
    raise exception 'delete_league:invalid_request' using errcode = '22023';
  end if;

  select l.name into v_name
  from public.leagues l
  where l.id = p_league_id and l.commissioner_id = v_uid
  for update;

  if v_name is null then
    raise exception 'delete_league:commissioner_only' using errcode = '42501';
  end if;
  if p_confirm_name <> v_name then
    raise exception 'delete_league:name_mismatch' using errcode = '22023';
  end if;

  if exists (select 1 from public.week_results where league_id = p_league_id) then
    raise exception 'delete_league:history_exists' using errcode = '23514';
  end if;
  if to_regclass('public.league_trophies') is not null and exists (
    select 1 from public.league_trophies where league_id = p_league_id
  ) then
    raise exception 'delete_league:history_exists' using errcode = '23514';
  end if;
  if to_regclass('public.museum_events') is not null and exists (
    select 1 from public.museum_events where league_id = p_league_id
  ) then
    raise exception 'delete_league:history_exists' using errcode = '23514';
  end if;

  select
    min(public.d1c_parse_kickoff(cg.start_time)),
    count(*) filter (
      where nullif(btrim(cg.start_time), '') is not null
        and public.d1c_parse_kickoff(cg.start_time) is null
    )::int
  into v_first_kickoff, v_bad_kickoffs
  from public.week_cards wc
  join public.card_games cg on cg.week_card_id = wc.id
  where wc.league_id = p_league_id;

  if v_bad_kickoffs > 0 then
    raise exception 'delete_league:kickoff_unverifiable' using errcode = '23514';
  end if;
  if v_first_kickoff is not null and v_first_kickoff <= now() then
    raise exception 'delete_league:league_started' using errcode = '23514';
  end if;

  delete from public.leagues where id = p_league_id;

  return json_build_object('ok', true, 'deleted', true, 'league_name', v_name);
end;
$$;

revoke all on function public.delete_unused_league(uuid, text) from public, anon;
grant execute on function public.delete_unused_league(uuid, text) to authenticated;

notify pgrst, 'reload schema';
