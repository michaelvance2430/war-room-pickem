-- REVIEW ONLY. Do not apply to production until the Fieldhouse release gate is approved.
-- Read-only live projection source for NCAAM/NCAAW standings. Official membership
-- totals remain owned by score_league_week_atomic after all ten games are final.

create or replace function public.get_fieldhouse_live_board(
  p_league_id uuid,
  p_week_number integer
)
returns table (
  id uuid,
  user_id uuid,
  total_points integer,
  prop_choice text,
  is_hellfire boolean,
  pick_games jsonb
)
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_first_tip timestamptz;
  v_last_tip timestamptz;
  v_is_scored boolean;
  v_sport_id text;
begin
  if auth.uid() is null or not public.is_league_member(p_league_id) then
    raise exception 'Not authorized for this league';
  end if;

  select lower(coalesce(l.sport_id, '')) into v_sport_id
  from public.leagues l
  where l.id = p_league_id;

  if v_sport_id not in ('cbb', 'ncaam', 'ncaaw') then
    raise exception 'Fieldhouse league required';
  end if;

  select
    min(nullif(cg.start_time, '')::timestamptz),
    max(nullif(cg.start_time, '')::timestamptz)
  into v_first_tip, v_last_tip
  from public.week_cards wc
  join public.card_games cg on cg.week_card_id = wc.id
  where wc.league_id = p_league_id
    and wc.week_number = p_week_number;

  select exists (
    select 1 from public.week_results wr
    where wr.league_id = p_league_id
      and wr.week_number = p_week_number
  ) into v_is_scored;

  if not v_is_scored and (v_first_tip is null or now() < v_first_tip) then
    raise exception 'The Board opens at first tip';
  end if;

  return query
  select
    p.id,
    p.user_id,
    p.total_points,
    case when v_is_scored or now() >= v_last_tip then p.prop_choice else null end,
    coalesce(p.is_chaos, false) as is_hellfire,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'card_game_id', pg.card_game_id,
          'side', pg.side,
          'confidence', pg.confidence,
          'is_best_bet', pg.is_best_bet
        ) order by cg.sort_order
      ) filter (
        where pg.id is not null
          and (v_is_scored or nullif(cg.start_time, '')::timestamptz <= now())
      ),
      '[]'::jsonb
    ) as pick_games
  from public.picks p
  left join public.pick_games pg on pg.pick_id = p.id
  left join public.card_games cg on cg.id = pg.card_game_id
  where p.league_id = p_league_id
    and p.week_number = p_week_number
    and p.locked_at is not null
  group by p.id, p.user_id, p.total_points, p.prop_choice, p.is_chaos
  order by p.total_points desc nulls last, p.user_id;
end;
$function$;

revoke all on function public.get_fieldhouse_live_board(uuid, integer) from public, anon;
grant execute on function public.get_fieldhouse_live_board(uuid, integer) to authenticated;
