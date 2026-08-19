create or replace function public.get_week_board(
  p_league_id uuid,
  p_week_number integer
)
returns table (
  id uuid,
  user_id uuid,
  total_points integer,
  prop_choice text,
  display_name text,
  pick_games jsonb
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_first_kickoff timestamptz;
  v_is_scored boolean;
begin
  if auth.uid() is null or not public.is_league_member(p_league_id) then
    raise exception 'Not authorized for this league';
  end if;

  select min(nullif(cg.start_time, '')::timestamptz)
    into v_first_kickoff
  from public.week_cards wc
  join public.card_games cg on cg.week_card_id = wc.id
  where wc.league_id = p_league_id
    and wc.week_number = p_week_number;

  select exists (
    select 1 from public.week_results wr
    where wr.league_id = p_league_id
      and wr.week_number = p_week_number
  ) into v_is_scored;

  if not v_is_scored and (v_first_kickoff is null or now() < v_first_kickoff) then
    raise exception 'The Board opens at kickoff';
  end if;

  return query
  select
    p.id,
    p.user_id,
    p.total_points,
    p.prop_choice,
    coalesce(pr.display_name, 'Unknown Player') as display_name,
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'card_game_id', pg.card_game_id,
          'side', pg.side,
          'confidence', pg.confidence,
          'is_best_bet', pg.is_best_bet
        ) order by cg.sort_order
      ) filter (where pg.id is not null),
      '[]'::jsonb
    ) as pick_games
  from public.picks p
  left join public.profiles pr on pr.id = p.user_id
  left join public.pick_games pg on pg.pick_id = p.id
  left join public.card_games cg on cg.id = pg.card_game_id
  where p.league_id = p_league_id
    and p.week_number = p_week_number
    and p.locked_at is not null
  group by p.id, p.user_id, p.total_points, p.prop_choice, pr.display_name
  order by p.total_points desc nulls last, pr.display_name asc;
end;
$$;

revoke all on function public.get_week_board(uuid, integer) from public, anon;
grant execute on function public.get_week_board(uuid, integer) to authenticated;

create or replace function public.get_week_lock_status(
  p_league_id uuid,
  p_week_number integer
)
returns table (user_id uuid)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if auth.uid() is null or not public.is_league_member(p_league_id) then
    raise exception 'Not authorized for this league';
  end if;

  return query
  select p.user_id
  from public.picks p
  where p.league_id = p_league_id
    and p.week_number = p_week_number
    and p.locked_at is not null;
end;
$$;

revoke all on function public.get_week_lock_status(uuid, integer) from public, anon;
grant execute on function public.get_week_lock_status(uuid, integer) to authenticated;

drop policy if exists "Commissioner reads league picks" on public.picks;
drop policy if exists "Commissioner reads league pick_games" on public.pick_games;
