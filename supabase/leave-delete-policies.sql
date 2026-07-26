-- Allow leave (delete own membership) and commissioner delete league
-- Run in Supabase → SQL Editor

drop policy if exists "Memberships delete own" on public.memberships;
create policy "Memberships delete own"
  on public.memberships for delete to authenticated
  using (user_id = auth.uid());

drop policy if exists "Commissioner deletes league" on public.leagues;
create policy "Commissioner deletes league"
  on public.leagues for delete to authenticated
  using (commissioner_id = auth.uid());
