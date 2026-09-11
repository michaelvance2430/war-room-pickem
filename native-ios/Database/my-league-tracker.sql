-- Personal tracker preferences. Does not change league membership or visibility for anyone else.
create table public.league_tracker_preferences (
  user_id uuid not null references auth.users(id) on delete cascade,
  league_id uuid not null references public.leagues(id) on delete cascade,
  hidden boolean not null default false,
  primary key (user_id, league_id)
);
alter table public.league_tracker_preferences enable row level security;
revoke all on public.league_tracker_preferences from anon, authenticated;
grant select, insert, update, delete on public.league_tracker_preferences to authenticated;
create policy "Players read their tracker preferences" on public.league_tracker_preferences
for select to authenticated using (user_id = (select auth.uid()));
create policy "Players insert their tracker preferences" on public.league_tracker_preferences
for insert to authenticated with check (
  user_id = (select auth.uid()) and exists (
    select 1 from public.memberships m where m.league_id = league_tracker_preferences.league_id and m.user_id = (select auth.uid())
  )
);
create policy "Players update their tracker preferences" on public.league_tracker_preferences
for update to authenticated using (user_id = (select auth.uid())) with check (
  user_id = (select auth.uid()) and exists (
    select 1 from public.memberships m where m.league_id = league_tracker_preferences.league_id and m.user_id = (select auth.uid())
  )
);
create policy "Players delete their tracker preferences" on public.league_tracker_preferences
for delete to authenticated using (user_id = (select auth.uid()));
create policy "Active accounts only" on public.league_tracker_preferences as restrictive
for all to authenticated using ((select private.is_active_account())) with check ((select private.is_active_account()));

-- Joining availability is deliberately irrelevant. A completed season remains off the
-- tracker until a fresh card is published after its latest official league closeout.
create function public.get_my_league_tracker_settings()
returns table (league_id uuid, hidden boolean, season_ended boolean)
language sql stable security invoker set search_path = '' as $function$
  select m.league_id, coalesce(p.hidden, false),
    c.closed_at is not null and not exists (
      select 1 from public.week_cards wc
      where wc.league_id = m.league_id and wc.published_at > c.closed_at
    ) as season_ended
  from public.memberships m
  join public.leagues l on l.id = m.league_id
  left join public.league_tracker_preferences p on p.league_id = m.league_id and p.user_id = m.user_id
  left join lateral (
    select max(sc.closed_at) as closed_at from public.league_season_closeouts sc
    where sc.league_id = m.league_id and sc.sport_id = l.sport_id and sc.competition_type = 'league'
  ) c on true
  where m.user_id = (select auth.uid());
$function$;
revoke all on function public.get_my_league_tracker_settings() from public, anon;
grant execute on function public.get_my_league_tracker_settings() to authenticated;
