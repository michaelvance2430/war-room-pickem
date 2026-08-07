-- Launch safety: client-side page gates are not authorization.
-- Restrict membership mutations to league operations staff and restrict the
-- platform-wide incident switch to the app creator's authenticated UUID.

drop policy if exists "Memberships update by commissioner or self"
  on public.memberships;
drop policy if exists "Commissioner updates memberships"
  on public.memberships;
drop policy if exists "Ops update memberships"
  on public.memberships;

create policy "Ops update memberships"
  on public.memberships
  for update
  to authenticated
  using (public.is_league_ops(league_id))
  with check (public.is_league_ops(league_id));

drop policy if exists "platform_status_update_auth"
  on public.platform_status;

create policy "Creator updates platform status"
  on public.platform_status
  for update
  to authenticated
  using (
    id = 1
    and (select auth.uid()) = '09544d2b-6eca-4131-a321-c000586c9029'::uuid
  )
  with check (
    id = 1
    and (select auth.uid()) = '09544d2b-6eca-4131-a321-c000586c9029'::uuid
  );

notify pgrst, 'reload schema';
