-- Shared live football score cache and single-flight refresh claim.
-- Additive only. Cached projections never modify certified results or memberships.

create table if not exists public.live_football_score_cache (
  sport text primary key check (sport in ('cfb', 'nfl')),
  events jsonb not null default '[]'::jsonb,
  fetched_at timestamptz,
  last_attempt_at timestamptz,
  provider_remaining int,
  provider_used int,
  provider_last_cost int,
  last_http_status int,
  last_error text
);

alter table public.live_football_score_cache enable row level security;
revoke all on public.live_football_score_cache from anon, authenticated;

create or replace function public.claim_live_football_score_refresh(
  p_sport text,
  p_min_age_seconds int default 25
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed boolean := false;
begin
  if p_sport not in ('cfb', 'nfl') then
    raise exception 'Unsupported sport';
  end if;

  insert into public.live_football_score_cache (sport, last_attempt_at)
  values (p_sport, now())
  on conflict (sport) do update
    set last_attempt_at = excluded.last_attempt_at
    where live_football_score_cache.last_attempt_at is null
       or live_football_score_cache.last_attempt_at < now() - make_interval(secs => greatest(10, p_min_age_seconds))
  returning true into claimed;

  return coalesce(claimed, false);
end;
$$;

revoke all on function public.claim_live_football_score_refresh(text, int) from public, anon, authenticated;
grant execute on function public.claim_live_football_score_refresh(text, int) to service_role;

comment on table public.live_football_score_cache is
  'Server-only shared provider cache. Clients receive it through the member-authenticated football-scores Edge Function.';
