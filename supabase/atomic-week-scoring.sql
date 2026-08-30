-- Score a complete weekly card and rebuild league standings in one transaction.
-- Client-side scoring remains presentation-only; this function is authoritative.

create or replace function public.score_league_week_atomic(
  p_league_id uuid,
  p_week_number integer,
  p_results jsonb,
  p_prop_result text
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_card public.week_cards%rowtype;
  v_week_result_id uuid;
  v_game_count integer;
  v_locked_count integer;
  v_bad_count integer;
  v_member record;
  v_scores integer[];
  v_score integer;
  v_positive boolean;
  v_streak integer;
  v_details jsonb;
  v_service boolean := coalesce(
    current_setting('request.jwt.claims', true)::jsonb ->> 'role',
    ''
  ) = 'service_role';
begin
  if auth.uid() is null and not v_service then
    raise exception 'Authentication required';
  end if;
  if not v_service and not public.is_league_ops(p_league_id) then
    raise exception 'Commissioner or deputy only';
  end if;
  if p_week_number < 0 then
    raise exception 'Invalid week number';
  end if;
  if jsonb_typeof(p_results) <> 'array' then
    raise exception 'Results must be an array';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_league_id::text || ':' || p_week_number::text, 0));

  select * into v_card
  from public.week_cards
  where league_id = p_league_id and week_number = p_week_number
  for update;
  if not found then
    raise exception 'Published week card not found';
  end if;

  select count(*) into v_game_count
  from public.card_games
  where week_card_id = v_card.id;
  if v_game_count = 0 then
    raise exception 'Week card has no games';
  end if;

  with supplied as (
    select game_id, winner
    from jsonb_to_recordset(p_results) as x(game_id uuid, winner text)
  )
  select count(*) into v_bad_count
  from supplied s
  left join public.card_games cg
    on cg.id = s.game_id and cg.week_card_id = v_card.id
  where cg.id is null or s.winner not in ('home', 'away');

  if v_bad_count > 0
     or jsonb_array_length(p_results) <> v_game_count
     or (select count(distinct x.game_id)
         from jsonb_to_recordset(p_results) as x(game_id uuid, winner text)) <> v_game_count then
    raise exception 'Enter one valid result for every published game';
  end if;

  if p_prop_result is null
     or p_prop_result not in (v_card.prop_option_a, v_card.prop_option_b) then
    raise exception 'Select a valid published prop result';
  end if;

  select count(*) into v_locked_count
  from public.picks
  where league_id = p_league_id
    and week_number = p_week_number
    and locked_at is not null;
  if v_locked_count = 0 then
    raise exception 'No locked picks for this week';
  end if;

  -- Every locked slip must contain exactly the published games, confidence
  -- values 1..N exactly once, one best bet, and a valid published prop choice.
  select count(*) into v_bad_count
  from public.picks p
  where p.league_id = p_league_id
    and p.week_number = p_week_number
    and p.locked_at is not null
    and (
      p.prop_choice not in (v_card.prop_option_a, v_card.prop_option_b)
      or p.best_bet_game_id is null
      or (select count(*) from public.pick_games pg where pg.pick_id = p.id) <> v_game_count
      or (select count(distinct pg.card_game_id) from public.pick_games pg
          join public.card_games cg on cg.id = pg.card_game_id and cg.week_card_id = v_card.id
          where pg.pick_id = p.id) <> v_game_count
      or (select count(distinct pg.confidence) from public.pick_games pg where pg.pick_id = p.id) <> v_game_count
      or (select min(pg.confidence) from public.pick_games pg where pg.pick_id = p.id) <> 1
      or (select max(pg.confidence) from public.pick_games pg where pg.pick_id = p.id) <> v_game_count
      or (select count(*) from public.pick_games pg where pg.pick_id = p.id and pg.is_best_bet) <> 1
      or not exists (
        select 1 from public.pick_games pg
        where pg.pick_id = p.id
          and pg.card_game_id = p.best_bet_game_id
          and pg.is_best_bet
      )
    );
  if v_bad_count > 0 then
    raise exception '% locked card(s) are incomplete or invalid', v_bad_count;
  end if;

  insert into public.week_results (league_id, week_number, prop_result, scored_at)
  values (p_league_id, p_week_number, p_prop_result, now())
  on conflict (league_id, week_number) do update
    set prop_result = excluded.prop_result,
        scored_at = excluded.scored_at
  returning id into v_week_result_id;

  delete from public.game_results where week_result_id = v_week_result_id;
  insert into public.game_results (week_result_id, card_game_id, winner)
  select v_week_result_id, x.game_id, x.winner
  from jsonb_to_recordset(p_results) as x(game_id uuid, winner text);

  -- Recalculate this week's locked slips from authoritative card/results rows.
  with game_points as (
    select p.id as pick_id,
           coalesce(sum(
             case when gr.winner <> 'push' and pg.side = gr.winner
               then pg.confidence * case when pg.is_best_bet then 2 else 1 end
               else 0 end
           ), 0)::integer as points
    from public.picks p
    join public.pick_games pg on pg.pick_id = p.id
    join public.game_results gr
      on gr.week_result_id = v_week_result_id and gr.card_game_id = pg.card_game_id
    where p.league_id = p_league_id
      and p.week_number = p_week_number
      and p.locked_at is not null
    group by p.id
  ), base_scores as (
    select p.id, coalesce(p.is_chaos, false) is_chaos,
      (gp.points + case when p.prop_choice = p_prop_result then v_card.prop_points else 0 end)::integer base_points
    from public.picks p
    join game_points gp on gp.pick_id = p.id
  ), totals as (
    select id,
      (base_points + case when is_chaos then (base_points + 1) / 2 else 0 end)::integer total
    from base_scores
  )
  update public.picks p
  set total_points = totals.total
  from totals
  where p.id = totals.id;

  -- Rebuild every derived standing from all officially scored locked slips.
  -- Corrections therefore replace history instead of incrementing stale counters.
  for v_member in
    select id, user_id from public.memberships where league_id = p_league_id
  loop
    select array_agg(p.total_points order by p.week_number desc)
      into v_scores
    from public.picks p
    join public.week_results wr
      on wr.league_id = p.league_id and wr.week_number = p.week_number
    where p.league_id = p_league_id
      and p.user_id = v_member.user_id
      and p.locked_at is not null
      and p.total_points is not null;

    v_streak := 0;
    if coalesce(array_length(v_scores, 1), 0) > 0 then
      v_positive := v_scores[1] >= 10;
      foreach v_score in array v_scores loop
        exit when (v_score >= 10) <> v_positive;
        v_streak := v_streak + case when v_positive then 1 else -1 end;
      end loop;
    end if;

    update public.memberships m
    set total_points = coalesce(s.total_points, 0),
        weekly_points = coalesce(s.weekly_points, array[]::integer[]),
        ats_correct = coalesce(s.ats_correct, 0),
        ats_total = coalesce(s.ats_total, 0),
        current_streak = v_streak,
        best_week = coalesce(s.best_week, 0),
        worst_week = coalesce(s.worst_week, 0),
        perfect_weeks = coalesce(s.perfect_weeks, 0),
        best_bet_hits = coalesce(s.best_bet_hits, 0),
        best_bet_total = coalesce(s.best_bet_total, 0),
        prop_hits = coalesce(s.prop_hits, 0),
        prop_total = coalesce(s.prop_total, 0),
        weeks_played = coalesce(s.weeks_played, 0)
    from (
      select
        sum(p.total_points)::integer as total_points,
        array(
          select coalesce(max(p2.total_points), 0)::integer
          from generate_series(
            0,
            coalesce((select max(week_number) from public.week_results where league_id = p_league_id), 0)
          ) gs(week_number)
          left join public.picks p2
            on p2.league_id = p_league_id
           and p2.user_id = v_member.user_id
           and p2.week_number = gs.week_number
           and p2.locked_at is not null
           and p2.total_points is not null
          group by gs.week_number
          order by gs.week_number
        ) as weekly_points,
        count(*)::integer as weeks_played,
        max(p.total_points)::integer as best_week,
        min(p.total_points)::integer as worst_week,
        count(*) filter (where p.total_points >= 18)::integer as perfect_weeks,
        count(*) filter (where p.prop_choice = wr.prop_result)::integer as prop_hits,
        count(*) filter (where p.prop_choice is not null and wr.prop_result is not null)::integer as prop_total,
        (
          select count(*)::integer
          from public.pick_games pg
          join public.picks px on px.id = pg.pick_id
          join public.week_results wrx
            on wrx.league_id = px.league_id and wrx.week_number = px.week_number
          join public.game_results gr
            on gr.week_result_id = wrx.id and gr.card_game_id = pg.card_game_id
          where px.league_id = p_league_id and px.user_id = v_member.user_id
            and px.locked_at is not null and gr.winner <> 'push' and pg.side = gr.winner
        ) as ats_correct,
        (
          select count(*)::integer
          from public.pick_games pg
          join public.picks px on px.id = pg.pick_id
          join public.week_results wrx
            on wrx.league_id = px.league_id and wrx.week_number = px.week_number
          join public.game_results gr
            on gr.week_result_id = wrx.id and gr.card_game_id = pg.card_game_id
          where px.league_id = p_league_id and px.user_id = v_member.user_id
            and px.locked_at is not null and gr.winner <> 'push'
        ) as ats_total,
        (
          select count(*)::integer
          from public.pick_games pg
          join public.picks px on px.id = pg.pick_id
          join public.week_results wrx
            on wrx.league_id = px.league_id and wrx.week_number = px.week_number
          join public.game_results gr
            on gr.week_result_id = wrx.id and gr.card_game_id = pg.card_game_id
          where px.league_id = p_league_id and px.user_id = v_member.user_id
            and px.locked_at is not null and pg.is_best_bet
            and gr.winner <> 'push' and pg.side = gr.winner
        ) as best_bet_hits,
        (
          select count(*)::integer
          from public.pick_games pg
          join public.picks px on px.id = pg.pick_id
          join public.week_results wrx
            on wrx.league_id = px.league_id and wrx.week_number = px.week_number
          join public.game_results gr
            on gr.week_result_id = wrx.id and gr.card_game_id = pg.card_game_id
          where px.league_id = p_league_id and px.user_id = v_member.user_id
            and px.locked_at is not null and pg.is_best_bet and gr.winner <> 'push'
        ) as best_bet_total
      from public.picks p
      join public.week_results wr
        on wr.league_id = p.league_id and wr.week_number = p.week_number
      where p.league_id = p_league_id
        and p.user_id = v_member.user_id
        and p.locked_at is not null
        and p.total_points is not null
    ) s
    where m.id = v_member.id;

    if not found then
      update public.memberships
      set total_points=0, weekly_points=array[]::integer[], ats_correct=0,
          ats_total=0, current_streak=0, best_week=0, worst_week=0,
          perfect_weeks=0, best_bet_hits=0, best_bet_total=0,
          prop_hits=0, prop_total=0, weeks_played=0
      where id = v_member.id;
    end if;
  end loop;

  select coalesce(jsonb_agg(jsonb_build_object(
    'userId', p.user_id,
    'name', coalesce(pr.display_name, 'Player'),
    'points', p.total_points
  ) order by coalesce(pr.display_name, 'Player')), '[]'::jsonb)
  into v_details
  from public.picks p
  left join public.profiles pr on pr.id = p.user_id
  where p.league_id = p_league_id
    and p.week_number = p_week_number
    and p.locked_at is not null;

  return jsonb_build_object(
    'ok', true,
    'weekResultId', v_week_result_id,
    'scoredCount', v_locked_count,
    'details', v_details
  );
end;
$$;

revoke all on function public.score_league_week_atomic(uuid, integer, jsonb, text) from public;
revoke all on function public.score_league_week_atomic(uuid, integer, jsonb, text) from anon;
grant execute on function public.score_league_week_atomic(uuid, integer, jsonb, text) to authenticated;
grant execute on function public.score_league_week_atomic(uuid, integer, jsonb, text) to service_role;
