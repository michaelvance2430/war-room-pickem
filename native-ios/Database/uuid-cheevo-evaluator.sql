-- Canonical Cheevo certification. The iOS app can preview eligibility, but this
-- trigger awards only from official UUID-linked scored slips.
create schema if not exists private;

create or replace function private.certify_membership_cheevos()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public, private, pg_temp
as $$
declare
  v_mode text;
  v_underdogs integer := 0;
  v_home integer := 0;
  v_road integer := 0;
  v_pick_streak integer := 0;
  v_week_streak integer := 0;
  v_first_eight integer := 0;
  v_scored_weeks integer := 0;
begin
  select mode into v_mode from public.leagues where id = new.league_id;
  if v_mode is null or (v_mode = 'foundry' and not coalesce(new.is_bot, false)) then
    return new;
  end if;

  with outcomes as (
    select px.week_number, cg.sort_order,
      pg.side = gr.winner as correct,
      pg.side <> coalesce(pg.locked_favorite, cg.favorite) as underdog,
      pg.side = 'home' as picked_home,
      pg.side = 'away' as picked_away
    from public.picks px
    join public.pick_games pg on pg.pick_id = px.id
    join public.card_games cg on cg.id = pg.card_game_id
    join public.week_results wr on wr.league_id = px.league_id and wr.week_number = px.week_number
    join public.game_results gr on gr.week_result_id = wr.id and gr.card_game_id = pg.card_game_id
    where px.league_id = new.league_id and px.user_id = new.user_id
      and px.locked_at is not null and gr.winner <> 'push'
  ), ordered as (
    select correct,
      sum(case when correct then 0 else 1 end) over(order by week_number desc, sort_order desc) as misses
    from outcomes
  )
  select count(*) filter(where correct and underdog),
         count(*) filter(where correct and picked_home),
         count(*) filter(where correct and picked_away),
         (select count(*) from ordered where misses = 0)
  into v_underdogs, v_home, v_road, v_pick_streak
  from outcomes;

  with played as (
    select distinct week_number from public.picks
    where league_id = new.league_id and user_id = new.user_id
      and locked_at is not null and total_points is not null
  ), numbered as (
    select week_number, row_number() over(order by week_number desc)::integer rn,
           max(week_number) over() latest
    from played
  )
  select count(*) filter(where week_number = latest - rn + 1)
  into v_week_streak
  from numbered;

  select count(*) into v_first_eight
  from public.picks px
  where px.league_id = new.league_id and px.user_id = new.user_id
    and px.locked_at is not null and px.total_points is not null
    and px.week_number in (
      select wr.week_number from public.week_results wr
      where wr.league_id = new.league_id order by wr.week_number limit 8
    );

  select count(*) into v_scored_weeks
  from public.week_results where league_id = new.league_id;

  insert into public.achievements(league_id, user_id, code, title, flavor)
  select new.league_id, new.user_id, rule.code, rule.title, rule.flavor
  from (values
    ('lock_it_in','Lock It In','A full card entered the vault. The alibi is now laminated.', new.weeks_played >= 1),
    ('card_complete','Card Complete','Five games, five confidence slots, one Best Bet, no missing paperwork.', new.weeks_played >= 1),
    ('confidence_ladder','Confidence Ladder','Every rung numbered. Every future regret carefully prioritized.', new.weeks_played >= 1),
    ('saturday_starter','Saturday Starter','The first Saturday card is official. There is no refund for optimism.', new.weeks_played >= 1),
    ('green_light','Green Light','The board finally moved. Parade permits remain premature.', new.total_points > 0),
    ('week_one_warrior','Week One Warrior','Points were scored in an officially certified week.', new.total_points > 0),
    ('on_the_board','On the Board','One spread survived contact with reality.', new.ats_correct >= 1),
    ('spread_survivor','Spread Survivor','The number tried to kill the pick. The pick lived.', new.ats_correct >= 1),
    ('best_bet_marked','Best Bet Marked','You circled one pick in permanent ink and invited consequences.', new.best_bet_total >= 1),
    ('prop_merchant','Prop Merchant','The side quest has entered the official record.', new.prop_total >= 1),
    ('two_week_tour','Two Week Tour','You came back after learning exactly what this place does to people.', new.weeks_played >= 2),
    ('rematch_ready','Rematch Ready','Two consecutive cards. Apparently the first lesson did not take.', v_week_streak >= 2),
    ('gameday_ready','Gameday Ready','Three weeks submitted. The uniform now smells permanent.', new.weeks_played >= 3),
    ('double_digit_club','Double Digit Club','Ten season points. Please act like you have been here before.', new.total_points >= 10),
    ('fifty_club','Fifty Club','Fifty season points and an increasingly dangerous amount of confidence.', new.total_points >= 50),
    ('century_club','Century Club','One hundred season points. The room has begun auditing your methods.', new.total_points >= 100),
    ('hot_hand','Hot Hand','Five straight ATS hits. Do not touch anything flammable.', v_pick_streak >= 5),
    ('underdog_spree','Underdog Spree','Three actual dogs cashed. The kennel has requested your scouting report.', v_underdogs >= 3),
    ('underdog_believer','Underdog Believer','Five actual underdogs covered. Chalk is now a personal insult.', v_underdogs >= 5),
    ('home_cookin','Home Cookin','Five home teams covered and the kitchen is refusing reservations.', v_home >= 5),
    ('road_dog','Road Dog','Five road teams covered. The suitcase now has its own film room.', v_road >= 5),
    ('iron_lungs','Iron Lungs','Six consecutive complete weeks. The oxygen tank is mostly decorative.', v_week_streak >= 6),
    ('crew_card_grinder','Card Grinder','Eight complete weekly cards fed into the machine.', new.weeks_played >= 8),
    ('crew_midseason_loyal','Midseason Loyal','At least six of the opening eight cards survived your attendance.', v_first_eight >= 6 and v_scored_weeks >= 8),
    ('best_bet_banker','Best Bet Banker','Three Best Bets cleared. The vault manager has stopped making eye contact.', new.best_bet_hits >= 3),
    ('parlay_pilot','Parlay Pilot','Five Best Bets landed. You may taxi directly to unbearable.', new.best_bet_hits >= 5),
    ('clutch_gene','Clutch Gene','Seven Best Bets hit when the points were loudest.', new.best_bet_hits >= 7),
    ('prop_prophet','Prop Prophet','Five props answered correctly through methods classified as probably guessing.', new.prop_hits >= 5),
    ('volume_shooter','Volume Shooter','Fifty correct ATS picks in one season. Ammunition was not the issue.', new.ats_correct >= 50),
    ('ten_week_tenant','Ten Week Tenant','Ten weeks in the room. Your security deposit is long gone.', new.weeks_played >= 10),
    ('full_conference','Full Conference','Points in eight different weeks. No bye week for the ego.', (select count(*) from unnest(new.weekly_points) p where p > 0) >= 8),
    ('four_green_friday','Four Green Friday','Twelve points in one week. The board briefly looked professionally managed.', coalesce((select max(p) from unnest(new.weekly_points) p),0) >= 12),
    ('sweep_adjacent','Sweep Adjacent','Fifteen to seventeen points: close enough to perfection to become irritating.', exists(select 1 from unnest(new.weekly_points) p where p between 15 and 17)),
    ('clean_sheet','Clean Sheet','Eighteen or more points. The weekly autopsy was canceled for lack of a body.', coalesce((select max(p) from unnest(new.weekly_points) p),0) >= 18)
  ) as rule(code,title,flavor,earned)
  where rule.earned
  on conflict (league_id, user_id, code) do nothing;

  return new;
end;
$$;

revoke execute on function private.certify_membership_cheevos() from public, anon, authenticated;

drop trigger if exists certify_membership_cheevos_after_score on public.memberships;
create trigger certify_membership_cheevos_after_score
after update of total_points, weekly_points, ats_correct, best_bet_hits, best_bet_total,
  prop_hits, prop_total, weeks_played
on public.memberships
for each row execute function private.certify_membership_cheevos();
