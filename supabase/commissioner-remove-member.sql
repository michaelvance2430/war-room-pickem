-- Allow commissioner to remove players from a league
-- Run in Supabase → SQL Editor → New query → Run
-- (Leave still uses "Memberships delete own" for self-leave)

drop policy if exists "Commissioner deletes memberships" on public.memberships;
create policy "Commissioner deletes memberships"
  on public.memberships for delete to authenticated
  using (
    exists (
      select 1 from public.leagues l
      where l.id = league_id and l.commissioner_id = auth.uid()
    )
  );
