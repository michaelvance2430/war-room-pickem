-- Foundry postseason lifecycle fixes.
--
-- 1. Permit every lifecycle stage emitted by score_foundry_postseason_week.
-- 2. Label the conference-championship week correctly on regular scorecards.
-- 3. Repair already-written Foundry scorecards for that week.

alter table public.foundry_season_lifecycle
  drop constraint if exists foundry_season_lifecycle_stage_check;

alter table public.foundry_season_lifecycle
  add constraint foundry_season_lifecycle_stage_check
  check (stage = any (array[
    'season_opening'::text,
    'championship_cold_open'::text,
    'week_open'::text,
    'week_locked'::text,
    'postseason_open'::text,
    'bowl_opening'::text,
    'bowl_finale_round1'::text,
    'quarterfinals'::text,
    'semifinals'::text,
    'championship'::text,
    'season_complete'::text
  ]));

alter table public.postseason_scorecards
  drop constraint if exists postseason_scorecards_phase_check;

alter table public.postseason_scorecards
  add constraint postseason_scorecards_phase_check
  check (phase = any (array[
    'regular_season'::text,
    'conference_championships'::text,
    'bowl_opening'::text,
    'bowl_finale_round1'::text,
    'quarterfinals'::text,
    'semifinals'::text,
    'championship'::text
  ]));

create or replace function public.write_foundry_regular_scorecards(
  p_league_id uuid,
  p_week_number integer
)
returns integer
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_count integer;
  v_phase text;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  if not exists (
    select 1 from public.leagues
    where id=p_league_id and mode='foundry' and commissioner_id=v_uid
  ) then raise exception 'Creator Foundry only'; end if;

  select case
    when p_week_number = regular_season_weeks + 1 then 'conference_championships'
    else 'regular_season'
  end
  into v_phase
  from public.leagues
  where id = p_league_id;

  with scored as (
    select
      p.league_id,p.user_id,p.week_number,p.total_points,p.prop_choice,coalesce(p.is_chaos,false) is_chaos,
      wc.prop_points,wr.prop_result,
      coalesce((
        select jsonb_agg(jsonb_build_object(
          'label',
            (case when pg.side='home' then cg.home_team else cg.away_team end)
            ||' · '||pg.confidence||' CONF'
            ||case when pg.is_best_bet then ' · BEST BET 2X' else '' end,
          'points',case when gr.winner<>'push' and pg.side=gr.winner
            then pg.confidence*case when pg.is_best_bet then 2 else 1 end else 0 end
        ) order by cg.sort_order)
        from public.pick_games pg
        join public.card_games cg on cg.id=pg.card_game_id
        join public.game_results gr on gr.week_result_id=wr.id and gr.card_game_id=pg.card_game_id
        where pg.pick_id=p.id
      ),'[]'::jsonb) game_components,
      coalesce((select sum(px.total_points) from public.picks px
        join public.week_results wrx on wrx.league_id=px.league_id and wrx.week_number=px.week_number
        where px.league_id=p.league_id and px.user_id=p.user_id and px.week_number<p.week_number
          and px.locked_at is not null and px.total_points is not null),0)::integer season_before
    from public.picks p
    join public.week_results wr on wr.league_id=p.league_id and wr.week_number=p.week_number
    join public.week_cards wc on wc.league_id=p.league_id and wc.week_number=p.week_number
    where p.league_id=p_league_id and p.week_number=p_week_number
      and p.locked_at is not null and p.total_points is not null
  ), assembled as (
    select s.*,
      s.game_components
      ||jsonb_build_array(jsonb_build_object(
          'label','WEEKLY PROP · '||case when s.prop_choice=s.prop_result then 'HIT' else 'MISS' end,
          'points',case when s.prop_choice=s.prop_result then s.prop_points else 0 end
        ))
      ||case when s.is_chaos then jsonb_build_array(jsonb_build_object(
          'label','CATCH-UP WEAPON · 50% EARNED BONUS',
          'points',s.total_points-floor(s.total_points*2.0/3.0)::integer
        )) else '[]'::jsonb end components
    from scored s
  ), ranked as (
    select a.*,
      case when a.week_number=0 then null
        else dense_rank() over(order by a.season_before desc,a.user_id)::integer end rank_before,
      dense_rank() over(order by (a.season_before+a.total_points) desc,a.user_id)::integer rank_after
    from assembled a
  )
  insert into public.postseason_scorecards(
    league_id,user_id,season_key,week_number,phase,components,weekly_total,
    season_total_before,season_total_after,rank_before,rank_after
  )
  select league_id,user_id,extract(year from now())::integer,week_number,v_phase,components,total_points,
    season_before,season_before+total_points,rank_before,rank_after
  from ranked
  on conflict(league_id,user_id,season_key,week_number) do update set
    phase=excluded.phase,components=excluded.components,weekly_total=excluded.weekly_total,
    season_total_before=excluded.season_total_before,season_total_after=excluded.season_total_after,
    rank_before=excluded.rank_before,rank_after=excluded.rank_after,created_at=now();

  get diagnostics v_count = row_count;
  return v_count;
end;
$function$;

update public.postseason_scorecards as scorecard
set phase = 'conference_championships'
from public.leagues as league
where scorecard.league_id = league.id
  and league.mode = 'foundry'
  and scorecard.week_number = league.regular_season_weeks + 1
  and scorecard.phase = 'regular_season';

notify pgrst, 'reload schema';
