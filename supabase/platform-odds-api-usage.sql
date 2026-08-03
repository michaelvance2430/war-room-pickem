-- Platform Odds API usage log (Foundry ops)
-- Additive only — no destructive statements.
-- Run in Supabase SQL Editor before relying on Foundry Platform API Usage.
--
-- Access model:
--   RLS enabled, no policies for authenticated/anon → default deny.
--   Server inserts + Foundry aggregate reads use SUPABASE_SERVICE_ROLE_KEY only.

create table if not exists public.platform_odds_api_usage (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),

  league_id uuid null references public.leagues (id) on delete set null,
  user_id uuid null,

  sport text null check (sport is null or sport in ('cfb', 'nfl')),
  action text not null check (action in ('pull_odds', 'score_sync')),
  endpoint text not null,

  provider_remaining int null,
  provider_used int null,
  provider_last_cost int null,
  estimated_credit_cost int not null default 1,

  success boolean not null default false,
  http_status int null,
  error_code text null,
  duration_ms int null,

  dry_run boolean not null default false,
  week_number int null
);

create index if not exists platform_odds_api_usage_created_at_idx
  on public.platform_odds_api_usage (created_at desc);

create index if not exists platform_odds_api_usage_league_created_idx
  on public.platform_odds_api_usage (league_id, created_at desc);

create index if not exists platform_odds_api_usage_action_created_idx
  on public.platform_odds_api_usage (action, created_at desc);

create index if not exists platform_odds_api_usage_success_created_idx
  on public.platform_odds_api_usage (success, created_at desc);

alter table public.platform_odds_api_usage enable row level security;

-- Explicit deny for normal roles (service_role bypasses RLS).
-- No SELECT/INSERT/UPDATE/DELETE policies for anon or authenticated.

comment on table public.platform_odds_api_usage is
  'Server-side Odds API call log for Foundry platform ops. Tracking starts when first row is inserted; no historical backfill.';
