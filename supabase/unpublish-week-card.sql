-- Commissioner-only pre-kickoff card withdrawal.
-- Atomically removes the published card and that week's picks, then announces
-- the reset so every player knows a replacement card requires new picks.

create or replace function public.unpublish_week_card(
  p_league_id uuid,
  p_week_number int
)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_card_id uuid;
  v_first_kickoff timestamptz;
  v_bad_kickoffs int := 0;
  v_picks int := 0;
  v_cards int := 0;
begin
  if v_uid is null then
    raise exception 'unpublish:not_authenticated' using errcode = '42501';
  end if;
  if p_league_id is null or p_week_number is null or p_week_number < 0 then
    raise exception 'unpublish:invalid_request' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.leagues l
    where l.id = p_league_id and l.commissioner_id = v_uid
  ) then
    raise exception 'unpublish:commissioner_only' using errcode = '42501';
  end if;

  select wc.id into v_card_id
  from public.week_cards wc
  where wc.league_id = p_league_id
    and wc.week_number = p_week_number
  for update;

  if v_card_id is null then
    return json_build_object(
      'ok', true,
      'already_clear', true,
      'week_number', p_week_number,
      'picks_removed', 0,
      'cards_removed', 0
    );
  end if;

  if exists (
    select 1 from public.week_results wr
    where wr.league_id = p_league_id and wr.week_number = p_week_number
  ) then
    raise exception 'unpublish:week_already_scored' using errcode = '23514';
  end if;

  select
    min(public.d1c_parse_kickoff(cg.start_time)),
    count(*) filter (
      where nullif(btrim(cg.start_time), '') is not null
        and public.d1c_parse_kickoff(cg.start_time) is null
    )::int
  into v_first_kickoff, v_bad_kickoffs
  from public.card_games cg
  where cg.week_card_id = v_card_id;

  if v_bad_kickoffs > 0 or v_first_kickoff is null then
    raise exception 'unpublish:kickoff_unverifiable' using errcode = '23514';
  end if;
  if v_first_kickoff <= now() then
    raise exception 'unpublish:kickoff_started' using errcode = '23514';
  end if;

  delete from public.picks p
  where p.league_id = p_league_id and p.week_number = p_week_number;
  get diagnostics v_picks = row_count;

  begin
    delete from public.museum_allegiance_snapshots mas
    where mas.league_id = p_league_id
      and mas.week_number = p_week_number
      and mas.status = 'prelock';
  exception when undefined_table then
    null;
  end;

  delete from public.week_cards wc where wc.id = v_card_id;
  get diagnostics v_cards = row_count;

  insert into public.announcements (league_id, author_id, title, body)
  values (
    p_league_id,
    v_uid,
    'Week ' || p_week_number || ' card withdrawn',
    'The commissioner cleared this week''s card. Your picks were removed. A replacement card is coming, because apparently we enjoy doing things twice.'
  );

  return json_build_object(
    'ok', true,
    'already_clear', false,
    'week_number', p_week_number,
    'picks_removed', v_picks,
    'cards_removed', v_cards,
    'announcement_created', true
  );
end;
$$;

revoke all on function public.unpublish_week_card(uuid, int) from public, anon;
grant execute on function public.unpublish_week_card(uuid, int) to authenticated;

notify pgrst, 'reload schema';
