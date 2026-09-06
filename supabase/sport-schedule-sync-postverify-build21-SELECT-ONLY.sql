-- Build 21 schedule authority post-verify. SELECT ONLY: no writes.
-- Run after schema, seeds, worker auth, Edge deployment, and cron installation.
-- Every `passed` value must be true before the release is considered complete.

with required_columns(column_name) as (
  values
    ('sport_id'), ('season_key'), ('week_number'),
    ('window_starts_at'), ('window_ends_at'), ('first_game_at'),
    ('timing_status'), ('last_ingested_at'), ('provider_event_count')
), missing as (
  select array_agg(required.column_name order by required.column_name)
    filter (where columns.column_name is null) names
  from required_columns required
  left join information_schema.columns columns
    on columns.table_schema = 'public'
   and columns.table_name = 'sport_card_windows'
   and columns.column_name = required.column_name
)
select
  'schedule columns exist' check_name,
  coalesce(cardinality(names), 0) = 0 passed,
  coalesce(array_to_string(names, ', '), 'all present') detail
from missing;

select
  'card windows remain internally valid' check_name,
  count(*) filter (where
    window_ends_at <= window_starts_at
    or first_game_at < window_starts_at
    or first_game_at >= window_ends_at
    or provider_event_count < 0
  ) = 0 passed,
  count(*) filter (where
    window_ends_at <= window_starts_at
    or first_game_at < window_starts_at
    or first_game_at >= window_ends_at
    or provider_event_count < 0
  )::text || ' invalid row(s)' detail
from public.sport_card_windows;

select
  'current and next schedule scaffolds exist' check_name,
  count(distinct (sport_id, season_key)) = 8 passed,
  count(distinct (sport_id, season_key))::text || ' of 8 sport-season pairs present' detail
from public.sport_card_windows
where sport_id in ('cfb', 'nfl', 'ncaam', 'ncaaw')
  and season_key in (2026, 2027);

select
  'provider-verified rows carry evidence' check_name,
  count(*) filter (where
    last_ingested_at is not null
    and (timing_status <> 'official' or provider_event_count <= 0 or source_note is null)
  ) = 0 passed,
  count(*) filter (where
    last_ingested_at is not null
    and (timing_status <> 'official' or provider_event_count <= 0 or source_note is null)
  )::text || ' ingested row(s) missing evidence' detail
from public.sport_card_windows;

select
  'schedule worker authorization exists' check_name,
  to_regprocedure('public.authorize_sport_schedule_worker(text)') is not null passed,
  coalesce(to_regprocedure('public.authorize_sport_schedule_worker(text)')::text, 'missing') detail;

select
  'schedule worker Vault secret exists' check_name,
  count(*) = 1 passed,
  count(*)::text || ' matching secret(s)' detail
from vault.secrets
where name = 'war_room_sport_schedule_cron_secret';

select
  'one daily schedule job is active' check_name,
  count(*) = 1 passed,
  count(*)::text || ' matching cron job(s)' detail
from cron.job
where jobname = 'war-room-sport-schedule-sync'
  and active
  and schedule = '15 10 * * *';

select
  'schedule scans cost zero credits' check_name,
  count(*) filter (where estimated_credit_cost <> 0) = 0 passed,
  count(*) filter (where estimated_credit_cost <> 0)::text || ' nonzero scan(s)' detail
from public.platform_odds_api_usage
where action = 'schedule_sync';
