-- Publish a complete five-game card atomically.
-- Once any player has a pick row, the card is immutable so republishing cannot
-- cascade-delete pick_games or detach Best Bets.

create or replace function public.publish_week_card_atomic(
  p_league_id uuid,
  p_week_number integer,
  p_games jsonb,
  p_prop_question text,
  p_prop_option_a text,
  p_prop_option_b text,
  p_prop_points integer
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_card_id uuid;
  v_game_count integer;
  v_games jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not public.is_league_ops(p_league_id) then
    raise exception 'Commissioner or deputy required';
  end if;
  if p_week_number < 0 or p_week_number > 99 then raise exception 'Invalid week'; end if;
  if coalesce(btrim(p_prop_question),'')='' or coalesce(btrim(p_prop_option_a),'')=''
     or coalesce(btrim(p_prop_option_b),'')='' or p_prop_option_a=p_prop_option_b then
    raise exception 'Complete the weekly prop';
  end if;
  if p_prop_points < 0 or p_prop_points > 25 then raise exception 'Invalid prop points'; end if;
  if jsonb_typeof(p_games)<>'array' then raise exception 'Games payload must be an array'; end if;
  select count(*) into v_game_count from jsonb_array_elements(p_games);
  if v_game_count<>5 then raise exception 'Select exactly five games'; end if;

  if exists (
    select 1 from jsonb_to_recordset(p_games) as g(
      sort_order integer, away_team text, home_team text, spread numeric,
      favorite text, start_time text, bookmaker text, away_rank integer, home_rank integer
    )
    where g.sort_order is null or g.sort_order<0 or g.sort_order>4
       or coalesce(btrim(g.away_team),'')='' or coalesce(btrim(g.home_team),'')=''
       or g.away_team=g.home_team or g.spread is null
       or g.favorite is null or g.favorite not in ('home','away')
       or coalesce(btrim(g.start_time),'')=''
  ) then raise exception 'Every game needs valid teams, spread, favorite, and kickoff'; end if;
  if (select count(distinct g.sort_order) from jsonb_to_recordset(p_games) as g(sort_order integer))<>5 then
    raise exception 'Game order must be unique';
  end if;
  if exists (
    select 1 from jsonb_to_recordset(p_games) as g(start_time text)
    where g.start_time::timestamptz <= clock_timestamp()
  ) then raise exception 'Cannot publish a game after kickoff'; end if;

  perform pg_advisory_xact_lock(
    hashtextextended(p_league_id::text || ':' || p_week_number::text, 0)
  );
  select id into v_card_id from public.week_cards
  where league_id=p_league_id and week_number=p_week_number for update;

  if v_card_id is not null and exists (
    select 1 from public.picks where league_id=p_league_id and week_number=p_week_number
  ) then raise exception 'Card is locked because player picks already exist'; end if;
  if exists (
    select 1 from public.week_results where league_id=p_league_id and week_number=p_week_number
  ) then raise exception 'Card is locked because the week is scored'; end if;

  if v_card_id is null then
    insert into public.week_cards(
      league_id,week_number,prop_question,prop_option_a,prop_option_b,prop_points,published_at
    ) values (
      p_league_id,p_week_number,btrim(p_prop_question),btrim(p_prop_option_a),
      btrim(p_prop_option_b),p_prop_points,clock_timestamp()
    ) returning id into v_card_id;
  else
    update public.week_cards set
      prop_question=btrim(p_prop_question),prop_option_a=btrim(p_prop_option_a),
      prop_option_b=btrim(p_prop_option_b),prop_points=p_prop_points,
      published_at=clock_timestamp()
    where id=v_card_id;
    delete from public.card_games where week_card_id=v_card_id;
  end if;

  insert into public.card_games(
    week_card_id,sort_order,away_team,home_team,spread,favorite,start_time,
    bookmaker,away_rank,home_rank
  )
  select v_card_id,g.sort_order,btrim(g.away_team),btrim(g.home_team),g.spread,
         g.favorite,g.start_time,nullif(btrim(g.bookmaker),''),g.away_rank,g.home_rank
  from jsonb_to_recordset(p_games) as g(
    sort_order integer, away_team text, home_team text, spread numeric,
    favorite text, start_time text, bookmaker text, away_rank integer, home_rank integer
  );

  update public.leagues set current_week=p_week_number where id=p_league_id;
  select jsonb_agg(jsonb_build_object('id',id,'sort_order',sort_order) order by sort_order)
    into v_games from public.card_games where week_card_id=v_card_id;
  return jsonb_build_object('week_card_id',v_card_id,'games',v_games);
end;
$$;

revoke all on function public.publish_week_card_atomic(uuid,integer,jsonb,text,text,text,integer) from public;
revoke all on function public.publish_week_card_atomic(uuid,integer,jsonb,text,text,text,integer) from anon;
grant execute on function public.publish_week_card_atomic(uuid,integer,jsonb,text,text,text,integer) to authenticated;
