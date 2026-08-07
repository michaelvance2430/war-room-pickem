-- Locker Room private picture storage.
-- Object path: <league_id>/<user_id>/<random_uuid>.<extension>

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'locker-media', 'locker-media', false, 6291456,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "League members read locker media" on storage.objects;
create policy "League members read locker media"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'locker-media'
    and exists (
      select 1 from public.memberships m
      where m.league_id::text = (storage.foldername(name))[1]
        and m.user_id = (select auth.uid())
    )
  );

drop policy if exists "League members upload locker media" on storage.objects;
create policy "League members upload locker media"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'locker-media'
    and (storage.foldername(name))[2] = (select auth.uid())::text
    and exists (
      select 1 from public.memberships m
      where m.league_id::text = (storage.foldername(name))[1]
        and m.user_id = (select auth.uid())
        and coalesce(m.is_bot, false) = false
        and coalesce(m.locker_muted, false) = false
    )
  );

drop policy if exists "Authors and staff delete locker media" on storage.objects;
create policy "Authors and staff delete locker media"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'locker-media'
    and (
      owner_id = (select auth.uid())::text
      or public.is_league_staff(((storage.foldername(name))[1])::uuid)
    )
  );
