-- ============================================================
-- Gazette Archive — weekly headlines survive the season
-- Wiped on season reset. Trophy Room is NOT touched.
-- Run once in Supabase → SQL Editor → Run
-- ============================================================

create table if not exists public.gazette_editions (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  week_number int not null check (week_number >= 0 and week_number <= 24),
  week_label text not null default '',
  volume_label text not null default '',
  -- Full edition snapshot (crown / shame / standings deadlock copy)
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (league_id, week_number)
);

create index if not exists gazette_editions_league_week_idx
  on public.gazette_editions (league_id, week_number desc);

alter table public.gazette_editions enable row level security;

drop policy if exists "Members read gazette archive" on public.gazette_editions;
create policy "Members read gazette archive"
  on public.gazette_editions for select to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.league_id = gazette_editions.league_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "Commissioner writes gazette archive" on public.gazette_editions;
create policy "Commissioner writes gazette archive"
  on public.gazette_editions for all to authenticated
  using (
    exists (
      select 1 from public.leagues l
      where l.id = gazette_editions.league_id
        and l.commissioner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.leagues l
      where l.id = gazette_editions.league_id
        and l.commissioner_id = auth.uid()
    )
  );

-- Season reset: wipe gazette archive (+ existing season data). Trophies stay.
create or replace function public.reset_league_season(p_league_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_picks int := 0;
  v_cards int := 0;
  v_results int := 0;
  v_members int := 0;
  v_gazette int := 0;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;

  if not exists (
    select 1
    from public.leagues l
    where l.id = p_league_id
      and l.commissioner_id = v_uid
  ) then
    raise exception 'Only the commissioner can reset the season';
  end if;

  delete from public.picks where league_id = p_league_id;
  get diagnostics v_picks = row_count;

  delete from public.week_results where league_id = p_league_id;
  get diagnostics v_results = row_count;

  delete from public.week_cards where league_id = p_league_id;
  get diagnostics v_cards = row_count;

  delete from public.announcements where league_id = p_league_id;

  -- Gazette archive (season paper trail only)
  begin
    delete from public.gazette_editions where league_id = p_league_id;
    get diagnostics v_gazette = row_count;
  exception when undefined_table then
    v_gazette := 0;
  end;

  -- Crystal Ball season picks (optional clean slate; trophies/table stay)
  begin
    delete from public.crystal_ball_picks where league_id = p_league_id;
  exception when undefined_table then
    null;
  end;
  begin
    delete from public.crystal_ball_result where league_id = p_league_id;
  exception when undefined_table then
    null;
  end;
  begin
    delete from public.achievements where league_id = p_league_id;
  exception when undefined_table then
    null;
  end;

  update public.memberships
  set
    total_points = 0,
    weekly_points = '{}',
    ats_correct = 0,
    ats_total = 0,
    current_streak = 0,
    best_week = 0,
    worst_week = 0,
    perfect_weeks = 0,
    best_bet_hits = 0,
    best_bet_total = 0,
    prop_hits = 0,
    prop_total = 0,
    weeks_played = 0
  where league_id = p_league_id;
  get diagnostics v_members = row_count;

  update public.leagues
  set current_week = 0
  where id = p_league_id;

  return json_build_object(
    'ok', true,
    'membersKept', v_members,
    'picksDeleted', v_picks,
    'cardsDeleted', v_cards,
    'resultsDeleted', v_results,
    'gazetteDeleted', v_gazette
  );
end;
$$;

revoke all on function public.reset_league_season(uuid) from public;
grant execute on function public.reset_league_season(uuid) to authenticated;
