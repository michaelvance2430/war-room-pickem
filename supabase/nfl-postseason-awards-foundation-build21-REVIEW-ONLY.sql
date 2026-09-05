-- Build 21 review only: multi-recipient NFL postseason award ledger.
-- DO NOT apply to production without explicit deployment approval.
-- Apply before multi-sport-season-closeout-build21-REVIEW-ONLY.sql.

begin;

create table if not exists public.nfl_postseason_awards (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  season_key integer not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  award_key text not null check (award_key in ('championship','toilet_bowl')),
  division_snapshot text,
  postseason_points integer not null check (postseason_points >= 0),
  regular_season_points integer not null,
  trophy_id text not null,
  awarded_at timestamptz not null default now(),
  unique (league_id,season_key,award_key,user_id)
);

create index if not exists nfl_postseason_awards_profile_idx
  on public.nfl_postseason_awards(user_id,season_key desc);

alter table public.nfl_postseason_awards enable row level security;
drop policy if exists "Members read NFL postseason awards" on public.nfl_postseason_awards;
create policy "Members read NFL postseason awards"
  on public.nfl_postseason_awards for select to authenticated
  using (exists (
    select 1 from public.memberships membership
    where membership.league_id=nfl_postseason_awards.league_id
      and membership.user_id=(select auth.uid())
  ));
grant select on public.nfl_postseason_awards to authenticated;
revoke all on public.nfl_postseason_awards from anon;

commit;
