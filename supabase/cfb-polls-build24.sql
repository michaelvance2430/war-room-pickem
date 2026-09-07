-- Build 24: cached AP Top 25 snapshots and persistent room ballots.
-- Provider credentials remain server-side in the cfb-polls Edge Function.

create table if not exists public.cfb_ap_polls (
  season integer not null check (season between 2000 and 2200),
  week integer not null check (week between 0 and 30),
  poll_name text not null default 'Associated Press Top 25',
  effective_at timestamptz,
  rankings jsonb not null check (jsonb_typeof(rankings) = 'array'),
  fetched_at timestamptz not null default now(),
  primary key (season, week)
);

create or replace function public.cfb_ballot_has_ten_unique(candidate text[])
returns boolean
language sql
immutable
strict
set search_path = pg_catalog
as $$
  select cardinality(candidate) = 10
    and array_position(candidate, null) is null
    and cardinality(array(select distinct unnest(candidate))) = 10
$$;

create table if not exists public.cfb_member_ballots (
  league_id uuid not null references public.leagues(id) on delete cascade,
  season integer not null check (season between 2000 and 2200),
  week integer not null check (week between 0 and 30),
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  ranked_team_ids text[] not null check (public.cfb_ballot_has_ten_unique(ranked_team_ids)),
  reveal_at timestamptz not null,
  submitted_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (league_id, season, week, user_id)
);

create index if not exists cfb_member_ballots_poll_idx
  on public.cfb_member_ballots (league_id, season, week, submitted_at);

alter table public.cfb_ap_polls enable row level security;
alter table public.cfb_member_ballots enable row level security;

drop policy if exists "Authenticated users read AP polls" on public.cfb_ap_polls;
create policy "Authenticated users read AP polls"
  on public.cfb_ap_polls for select to authenticated
  using (true);

drop policy if exists "Members read own or revealed CFB ballots" on public.cfb_member_ballots;
create policy "Members read own or revealed CFB ballots"
  on public.cfb_member_ballots for select to authenticated
  using (
    public.is_league_member(league_id)
    and ((select auth.uid()) = user_id or now() >= reveal_at)
  );

drop policy if exists "Members file own CFB ballot" on public.cfb_member_ballots;
create policy "Members file own CFB ballot"
  on public.cfb_member_ballots for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and public.is_league_member(league_id)
  );

drop policy if exists "Members update own CFB ballot" on public.cfb_member_ballots;
create policy "Members update own CFB ballot"
  on public.cfb_member_ballots for update to authenticated
  using (
    (select auth.uid()) = user_id
    and public.is_league_member(league_id)
    and now() < reveal_at
  )
  with check (
    (select auth.uid()) = user_id
    and public.is_league_member(league_id)
    and now() < reveal_at
  );

revoke all on table public.cfb_ap_polls from anon;
revoke all on table public.cfb_member_ballots from anon;
grant select on table public.cfb_ap_polls to authenticated;
grant select, insert, update on table public.cfb_member_ballots to authenticated;
grant select, insert, update, delete on table public.cfb_ap_polls to service_role;
grant select, insert, update, delete on table public.cfb_member_ballots to service_role;
revoke all on function public.cfb_ballot_has_ten_unique(text[]) from public, anon;
grant execute on function public.cfb_ballot_has_ten_unique(text[]) to authenticated, service_role;

comment on table public.cfb_ap_polls is
  'Server-refreshed Sportradar AP Top 25 snapshots. No provider secret is exposed to clients.';
comment on table public.cfb_member_ballots is
  'One persistent Top 10 ballot per league member and CFB week; visible room-wide only after reveal.';
