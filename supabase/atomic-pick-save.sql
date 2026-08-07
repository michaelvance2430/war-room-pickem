-- Save or edit one complete weekly pick card in a single transaction.
-- The server, not the browser, enforces membership, completeness, and kickoff.

create or replace function public.save_week_picks_atomic(
  p_league_id uuid,
  p_week_number integer,
  p_picks jsonb,
  p_best_bet_game_id uuid,
  p_prop_choice text,
  p_is_chaos boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_card public.week_cards%rowtype;
  v_pick_id uuid;
  v_existing_locked_at timestamptz;
  v_game_count integer;
  v_payload_count integer;
  v_first_kickoff timestamptz;
begin
  if v_uid is null then
    raise exception 'Authentication required';
  end if;

  if not exists (
    select 1 from public.memberships
    where league_id = p_league_id and user_id = v_uid
  ) then
    raise exception 'League membership required';
  end if;

  select * into v_card
  from public.week_cards
  where league_id = p_league_id and week_number = p_week_number
  for share;

  if not found or v_card.published_at is null then
    raise exception 'Published week card not found';
  end if;

  if exists (
    select 1 from public.week_results
    where league_id = p_league_id and week_number = p_week_number
  ) then
    raise exception 'This week has already been scored';
  end if;

  select count(*), min(nullif(start_time, '')::timestamptz)
    into v_game_count, v_first_kickoff
  from public.card_games
  where week_card_id = v_card.id;

  if v_game_count <> 5 then
    raise exception 'Week card must contain exactly five games';
  end if;
  if v_first_kickoff is null then
    raise exception 'Week card kickoff time is missing';
  end if;
  if clock_timestamp() >= v_first_kickoff then
    raise exception 'Card is frozen. First kickoff has passed';
  end if;

  if jsonb_typeof(p_picks) <> 'array' then
    raise exception 'Picks payload must be an array';
  end if;
  select count(*) into v_payload_count from jsonb_array_elements(p_picks);
  if v_payload_count <> v_game_count then
    raise exception 'Pick every game exactly once';
  end if;
  if p_best_bet_game_id is null then
    raise exception 'Mark one Best Bet';
  end if;
  if p_prop_choice is null or p_prop_choice not in (v_card.prop_option_a, v_card.prop_option_b) then
    raise exception 'Choose a valid weekly prop';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(p_picks) as x(game_id uuid, side text, confidence integer, locked_spread numeric, locked_favorite text)
    where x.game_id is null
       or x.side is null or x.side not in ('home', 'away')
       or x.confidence is null or x.confidence < 1 or x.confidence > v_game_count
  ) then
    raise exception 'Invalid pick payload';
  end if;

  if (
    select count(distinct x.game_id)
    from jsonb_to_recordset(p_picks) as x(game_id uuid)
  ) <> v_game_count or exists (
    select 1
    from jsonb_to_recordset(p_picks) as x(game_id uuid)
    left join public.card_games cg on cg.id=x.game_id and cg.week_card_id=v_card.id
    where cg.id is null
  ) then
    raise exception 'Picks do not match this week card';
  end if;

  if (
    select count(distinct x.confidence)
    from jsonb_to_recordset(p_picks) as x(confidence integer)
  ) <> v_game_count then
    raise exception 'Use each confidence exactly once';
  end if;

  if not exists (
    select 1 from jsonb_to_recordset(p_picks) as x(game_id uuid)
    where x.game_id = p_best_bet_game_id
  ) then
    raise exception 'Best Bet must be one of this week''s games';
  end if;

  select id, locked_at into v_pick_id, v_existing_locked_at
  from public.picks
  where league_id=p_league_id and user_id=v_uid and week_number=p_week_number
  for update;

  if v_pick_id is null then
    insert into public.picks (
      league_id,user_id,week_number,prop_choice,best_bet_game_id,locked_at,is_chaos
    ) values (
      p_league_id,v_uid,p_week_number,p_prop_choice,p_best_bet_game_id,clock_timestamp(),coalesce(p_is_chaos,false)
    ) returning id, locked_at into v_pick_id, v_existing_locked_at;
  else
    update public.picks set
      prop_choice=p_prop_choice,
      best_bet_game_id=p_best_bet_game_id,
      is_chaos=is_chaos or coalesce(p_is_chaos,false),
      updated_at=clock_timestamp()
    where id=v_pick_id;
    delete from public.pick_games where pick_id=v_pick_id;
  end if;

  insert into public.pick_games (
    pick_id,card_game_id,side,confidence,is_best_bet,locked_spread,locked_favorite
  )
  select v_pick_id,x.game_id,x.side,x.confidence,
         x.game_id=p_best_bet_game_id,cg.spread,cg.favorite
  from jsonb_to_recordset(p_picks) as x(game_id uuid, side text, confidence integer)
  join public.card_games cg on cg.id=x.game_id and cg.week_card_id=v_card.id;

  return jsonb_build_object(
    'pick_id',v_pick_id,
    'locked_at',v_existing_locked_at,
    'first_save',not exists (
      select 1 from public.picks p
      where p.id=v_pick_id and p.created_at < p.updated_at
    )
  );
end;
$$;

revoke all on function public.save_week_picks_atomic(uuid,integer,jsonb,uuid,text,boolean) from public;
revoke all on function public.save_week_picks_atomic(uuid,integer,jsonb,uuid,text,boolean) from anon;
grant execute on function public.save_week_picks_atomic(uuid,integer,jsonb,uuid,text,boolean) to authenticated;
