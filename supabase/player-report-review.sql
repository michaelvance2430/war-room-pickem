-- Staff review queue for player reports. Identity/content columns are immutable.

alter table public.player_reports
  add column if not exists resolved_at timestamptz,
  add column if not exists resolved_by uuid references public.profiles(id) on delete set null;

revoke update on public.player_reports from authenticated;
grant update (status, resolved_at, resolved_by) on public.player_reports to authenticated;

drop policy if exists "League staff update report status" on public.player_reports;
create policy "League staff update report status" on public.player_reports
  for update to authenticated
  using (public.is_league_staff(league_id))
  with check (
    public.is_league_staff(league_id)
    and status in ('open', 'reviewing', 'resolved', 'dismissed')
    and (resolved_by is null or resolved_by = (select auth.uid()))
  );

notify pgrst, 'reload schema';
