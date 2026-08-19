begin;

drop function if exists public.get_week_board(uuid, integer);

create function public.get_week_board(
  p_league_id uuid,
  p_week_number integer
)
returns table (
  id uuid,
  user_id uuid,
  total_points integer,
  prop_choice text,
  display_name text,
  favorite_team_id text,
  pick_games jsonb
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_first_kickoff timestamptz;
  v_is_scored boolean;
  v_sport_id text;
begin
  if auth.uid() is null or not public.is_league_member(p_league_id) then
    raise exception 'Not authorized for this league';
  end if;

  select l.sport_id into v_sport_id
  from public.leagues l
  where l.id = p_league_id;

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
    pft.team_id as favorite_team_id,
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
  left join public.profile_favorite_teams pft
    on pft.user_id = p.user_id and pft.sport_id = v_sport_id
  left join public.pick_games pg on pg.pick_id = p.id
  left join public.card_games cg on cg.id = pg.card_game_id
  where p.league_id = p_league_id
    and p.week_number = p_week_number
    and p.locked_at is not null
  group by p.id, p.user_id, p.total_points, p.prop_choice, pr.display_name, pft.team_id
  order by p.total_points desc nulls last, pr.display_name asc;
end;
$$;

revoke all on function public.get_week_board(uuid, integer) from public, anon;
grant execute on function public.get_week_board(uuid, integer) to authenticated;

with bot_loyalties(display_name, team_id) as (
  values
    ('Confidence King', 'alabama'),
    ('Couch QB', 'colorado'),
    ('DJ Chaos', 'miami'),
    ('Dog Walker', 'georgia'),
    ('Fade Master', 'ohio-state'),
    ('Late Lock', 'florida-state'),
    ('Line Shopper', 'oregon'),
    ('Locksmith', 'notre-dame'),
    ('Over Under', 'texas'),
    ('Parlay Pete', 'lsu'),
    ('Pick Wizard', 'michigan'),
    ('Prime Time', 'usc'),
    ('Spread Sheet', 'penn-state'),
    ('Sunday Scaries', 'tennessee'),
    ('Unit Manager', 'army'),
    ('Vegas Vic', 'unlv')
)
insert into public.profile_favorite_teams(user_id, sport_id, team_id)
select distinct m.user_id, l.sport_id, b.team_id
from public.memberships m
join public.leagues l on l.id = m.league_id and l.mode = 'foundry'
join public.profiles p on p.id = m.user_id
join bot_loyalties b on b.display_name = p.display_name
where m.is_bot
on conflict (user_id, sport_id) do update set team_id = excluded.team_id;

commit;
