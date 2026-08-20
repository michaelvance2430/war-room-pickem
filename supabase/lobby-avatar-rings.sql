-- Keep each player UUID unique while carrying the public avatar and selected ring into the Lobby board.
create or replace function public.list_lobby_leaderboards()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_players json;
  v_crews json;
begin
  if v_uid is null then raise exception 'lobby:not_authenticated'; end if;

  with eligible_players as (
    select distinct m.user_id
    from public.memberships m
    join public.leagues l on l.id = m.league_id and coalesce(l.mode::text, 'production') = 'production'
    join public.profiles p on p.id = m.user_id and coalesce(p.account_state::text, 'active') = 'active' and p.deleted_at is null
    where m.is_bot is false
  ), award_points as (
    select a.user_id, sum(case
      when a.code in ('hot_hand','clean_sheet','parlay_pilot','underdog_believer','volume_shooter','crew_midseason_loyal','crew_card_grinder','iron_lungs','clutch_gene','four_green_friday','sweep_adjacent','best_bet_banker','prop_prophet','underdog_spree','ten_week_tenant','full_conference','road_dog','home_cookin') then 25
      when a.code in ('lock_it_in','on_the_board','saturday_starter','green_light','gameday_ready','card_complete','prop_merchant','best_bet_marked','confidence_ladder','week_one_warrior','two_week_tour','double_digit_club','fifty_club','century_club','spread_survivor','rematch_ready') then 10 else 0 end)::int as points
    from public.achievements a
    join eligible_players ep on ep.user_id = a.user_id
    join public.leagues l on l.id = a.league_id and coalesce(l.mode::text, 'production') = 'production'
    group by a.user_id
  ), chosen_handle as (
    select distinct on (m.user_id)
           m.user_id,
           coalesce(nullif(trim(m.display_name_override), ''), nullif(trim(p.display_name), ''), 'Player') as game_handle,
           l.name as league_name,
           p.display_name,
           p.avatar_url,
           p.equipped_border_id
    from public.memberships m
    join public.leagues l on l.id = m.league_id and coalesce(l.mode::text, 'production') = 'production'
    join public.profiles p on p.id = m.user_id and coalesce(p.account_state::text, 'active') = 'active' and p.deleted_at is null
    where m.is_bot is false
    order by m.user_id,
             (nullif(trim(m.display_name_override), '') is not null) desc,
             m.joined_at desc nulls last,
             m.league_id
  ), ranked as (
    select ch.user_id,
           ch.game_handle,
           ch.league_name,
           ch.avatar_url,
           ch.equipped_border_id,
           (coalesce(ap.points, 0) + case when nullif(trim(ch.display_name), '') is not null then 10 else 0 end + case when nullif(trim(ch.avatar_url), '') is not null then 10 else 0 end)::int as cheevo_points
    from chosen_handle ch
    left join award_points ap on ap.user_id = ch.user_id
    order by cheevo_points desc, game_handle
    limit 10
  )
  select coalesce(json_agg(row_to_json(ranked)), '[]'::json) into v_players from ranked;

  with award_points as (
    select a.league_id, a.user_id, sum(case
      when a.code in ('hot_hand','clean_sheet','parlay_pilot','underdog_believer','volume_shooter','crew_midseason_loyal','crew_card_grinder','iron_lungs','clutch_gene','four_green_friday','sweep_adjacent','best_bet_banker','prop_prophet','underdog_spree','ten_week_tenant','full_conference','road_dog','home_cookin') then 25
      when a.code in ('lock_it_in','on_the_board','saturday_starter','green_light','gameday_ready','card_complete','prop_merchant','best_bet_marked','confidence_ladder','week_one_warrior','two_week_tour','double_digit_club','fifty_club','century_club','spread_survivor','rematch_ready') then 10 else 0 end)::int as points
    from public.achievements a group by a.league_id, a.user_id
  ), scored as (
    select m.league_id, (coalesce(ap.points, 0) + case when nullif(trim(p.display_name), '') is not null then 10 else 0 end + case when nullif(trim(p.avatar_url), '') is not null then 10 else 0 end)::int as points
    from public.memberships m
    join public.leagues l on l.id = m.league_id and coalesce(l.mode::text, 'production') = 'production'
    join public.profiles p on p.id = m.user_id and coalesce(p.account_state::text, 'active') = 'active' and p.deleted_at is null
    left join award_points ap on ap.league_id = m.league_id and ap.user_id = m.user_id
    where m.is_bot is false
  ), ranked as (
    select l.name as crew_name, sum(s.points)::int as cheevo_points
    from scored s join public.leagues l on l.id = s.league_id
    group by s.league_id, l.name having sum(s.points) > 0
    order by cheevo_points desc, crew_name limit 10
  )
  select coalesce(json_agg(row_to_json(ranked)), '[]'::json) into v_crews from ranked;

  return json_build_object('ok', true, 'players', v_players, 'crews', v_crews, 'updated_at', now());
end;
$$;

revoke all on function public.list_lobby_leaderboards() from public, anon;
grant execute on function public.list_lobby_leaderboards() to authenticated;

comment on function public.list_lobby_leaderboards() is 'Top Cheevo players ranked once per user UUID with avatar rings plus creative crew names; excludes bots, Foundry, and inactive accounts.';
