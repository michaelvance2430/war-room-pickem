-- Keep NFL postseason RLS paths unambiguous and cover every foreign key.
begin;

drop policy if exists "Commissioner writes NFL postseason slate" on public.nfl_postseason_slates;
create policy "Commissioner inserts NFL postseason slate" on public.nfl_postseason_slates
for insert to authenticated
with check (exists(select 1 from public.leagues l where l.id=league_id and l.commissioner_id=(select auth.uid())));
create policy "Commissioner updates NFL postseason slate" on public.nfl_postseason_slates
for update to authenticated
using (exists(select 1 from public.leagues l where l.id=league_id and l.commissioner_id=(select auth.uid())))
with check (exists(select 1 from public.leagues l where l.id=league_id and l.commissioner_id=(select auth.uid())));
create policy "Commissioner deletes NFL postseason slate" on public.nfl_postseason_slates
for delete to authenticated
using (exists(select 1 from public.leagues l where l.id=league_id and l.commissioner_id=(select auth.uid())));

drop policy if exists "Commissioner writes NFL results" on public.nfl_postseason_results;
create policy "Commissioner inserts NFL results" on public.nfl_postseason_results
for insert to authenticated
with check (exists(select 1 from public.leagues l where l.id=league_id and l.commissioner_id=(select auth.uid())));
create policy "Commissioner updates NFL results" on public.nfl_postseason_results
for update to authenticated
using (exists(select 1 from public.leagues l where l.id=league_id and l.commissioner_id=(select auth.uid())))
with check (exists(select 1 from public.leagues l where l.id=league_id and l.commissioner_id=(select auth.uid())));
create policy "Commissioner deletes NFL results" on public.nfl_postseason_results
for delete to authenticated
using (exists(select 1 from public.leagues l where l.id=league_id and l.commissioner_id=(select auth.uid())));

create index if not exists nfl_postseason_entries_league_season_idx
on public.nfl_postseason_entries(league_id,season_key);
create index if not exists nfl_postseason_entries_user_idx
on public.nfl_postseason_entries(user_id);
create index if not exists nfl_postseason_scorecards_user_idx
on public.nfl_postseason_scorecards(user_id);

commit;

