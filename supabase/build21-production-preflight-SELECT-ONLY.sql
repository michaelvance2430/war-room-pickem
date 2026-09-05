-- Build 21 production preflight. SELECT ONLY: this file performs no writes.
-- Every row must return passed=true before the guarded schema release begins.

with required_tables(name) as (
  values
    ('public.leagues'),
    ('public.memberships'),
    ('public.week_cards'),
    ('public.card_games'),
    ('public.picks'),
    ('public.week_results'),
    ('public.league_trophies'),
    ('public.league_season_closeouts'),
    ('public.league_postseason_snapshots'),
    ('public.nfl_postseason_scorecards'),
    ('public.live_football_score_cache'),
    ('public.platform_odds_api_usage')
), missing as (
  select array_agg(name order by name) filter (where to_regclass(name) is null) names
  from required_tables
)
select
  'required baseline tables exist' as check_name,
  coalesce(cardinality(names),0)=0 as passed,
  coalesce(array_to_string(names,', '),'all present') as detail
from missing;

with required_columns(table_name,column_name) as (
  values
    ('leagues','sport_id'),
    ('leagues','mode'),
    ('leagues','regular_season_weeks'),
    ('leagues','current_week'),
    ('memberships','is_bot'),
    ('memberships','eligible_from_week'),
    ('memberships','division'),
    ('memberships','total_points'),
    ('picks','locked_at'),
    ('picks','total_points')
), missing as (
  select array_agg(required.table_name||'.'||required.column_name order by required.table_name,required.column_name)
    filter (where columns.column_name is null) names
  from required_columns required
  left join information_schema.columns columns
    on columns.table_schema='public'
   and columns.table_name=required.table_name
   and columns.column_name=required.column_name
)
select
  'required baseline columns exist' as check_name,
  coalesce(cardinality(names),0)=0 as passed,
  coalesce(array_to_string(names,', '),'all present') as detail
from missing;

select
  'legacy NFL JDAM receipts are absent' as check_name,
  count(*) filter (where used_jdam)=0 as passed,
  count(*) filter (where used_jdam)::text||' legacy JDAM scorecard(s)' as detail
from public.nfl_postseason_scorecards;

select
  'live league sport values fit Build 21' as check_name,
  count(*) filter (where
    lower(coalesce(sport_id,'cfb')) not in ('cfb','nfl','ncaam','ncaaw')
    and not (
      lower(coalesce(sport_id,''))='cbb'
      and coalesce(mode::text,'production')='foundry'
    )
  )=0 as passed,
  count(*) filter (where
    lower(coalesce(sport_id,'cfb')) not in ('cfb','nfl','ncaam','ncaaw')
    and not (
      lower(coalesce(sport_id,''))='cbb'
      and coalesce(mode::text,'production')='foundry'
    )
  )::text||' incompatible live league row(s); legacy cbb is permitted only in Foundry' as detail
from public.leagues;

select
  'season closeout sport values fit Build 21' as check_name,
  count(*) filter (where lower(sport_id) not in ('cfb','nfl','ncaam','ncaaw'))=0 as passed,
  count(*) filter (where lower(sport_id) not in ('cfb','nfl','ncaam','ncaaw'))::text||' incompatible closeout row(s)' as detail
from public.league_season_closeouts;

select
  'league trophies have supported types' as check_name,
  count(*) filter (where trophy_type not in (
    'championship','toilet_bowl','crystal_ball',
    'division_north','division_south','division_east','division_west',
    'fieldhouse_region_east','fieldhouse_region_west',
    'fieldhouse_region_south','fieldhouse_region_midwest'
  ))=0 as passed,
  count(*) filter (where trophy_type not in (
    'championship','toilet_bowl','crystal_ball',
    'division_north','division_south','division_east','division_west',
    'fieldhouse_region_east','fieldhouse_region_west',
    'fieldhouse_region_south','fieldhouse_region_midwest'
  ))::text||' incompatible trophy row(s)' as detail
from public.league_trophies;
