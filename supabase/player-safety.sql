-- Player-facing report and block controls required for App Store review.
-- Apply through the reviewed Supabase migration workflow before enabling UI publicly.

create table if not exists public.player_blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint player_blocks_not_self check (blocker_id <> blocked_id)
);

alter table public.player_blocks enable row level security;
grant select, insert, delete on public.player_blocks to authenticated;

drop policy if exists "Players read own blocks" on public.player_blocks;
create policy "Players read own blocks" on public.player_blocks
  for select to authenticated
  using ((select auth.uid()) = blocker_id);

drop policy if exists "Players block shared-league members" on public.player_blocks;
create policy "Players block shared-league members" on public.player_blocks
  for insert to authenticated
  with check (
    (select auth.uid()) = blocker_id
    and exists (
      select 1 from public.memberships mine
      join public.memberships theirs on theirs.league_id = mine.league_id
      where mine.user_id = (select auth.uid()) and theirs.user_id = blocked_id
    )
  );

drop policy if exists "Players remove own blocks" on public.player_blocks;
create policy "Players remove own blocks" on public.player_blocks
  for delete to authenticated
  using ((select auth.uid()) = blocker_id);

create table if not exists public.player_reports (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  reported_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check (category in ('harassment', 'hate', 'threats', 'spam', 'other')),
  details text not null default '' check (char_length(details) <= 500),
  status text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  constraint player_reports_not_self check (reporter_id <> reported_id)
);

create index if not exists player_reports_league_status_idx
  on public.player_reports (league_id, status, created_at desc);
create index if not exists player_reports_reporter_idx
  on public.player_reports (reporter_id, created_at desc);

alter table public.player_reports enable row level security;
grant select, insert on public.player_reports to authenticated;

drop policy if exists "Players submit shared-league reports" on public.player_reports;
create policy "Players submit shared-league reports" on public.player_reports
  for insert to authenticated
  with check (
    (select auth.uid()) = reporter_id
    and exists (
      select 1 from public.memberships mine
      join public.memberships theirs
        on theirs.league_id = mine.league_id and theirs.user_id = reported_id
      where mine.league_id = player_reports.league_id
        and mine.user_id = (select auth.uid())
    )
  );

drop policy if exists "Reporters and staff read reports" on public.player_reports;
create policy "Reporters and staff read reports" on public.player_reports
  for select to authenticated
  using (
    (select auth.uid()) = reporter_id
    or public.is_league_staff(league_id)
  );

notify pgrst, 'reload schema';
