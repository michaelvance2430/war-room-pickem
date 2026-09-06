-- BUILD 21 REVIEW ONLY. Add the free schedule scan to the already deployed
-- Fieldhouse usage ledger without reapplying the historical base migration.

begin;

alter table public.platform_odds_api_usage
  drop constraint if exists platform_odds_api_usage_action_check;
alter table public.platform_odds_api_usage
  add constraint platform_odds_api_usage_action_check
  check (action in (
    'pull_odds', 'score_sync', 'schedule_sync',
    'tournament_score_sync', 'tournament_odds_sync'
  ));

commit;
