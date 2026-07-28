-- ============================================================
-- EVERYONE can upload a profile photo (not just commissioner)
-- Run this ENTIRE file once in Supabase → SQL Editor → Run
-- ============================================================

-- 1) Profile column
alter table public.profiles
  add column if not exists avatar_url text;

alter table public.profiles enable row level security;

-- 2) Profiles: every signed-in user manages ONLY their own row
drop policy if exists "Profiles viewable authenticated" on public.profiles;
drop policy if exists "Users insert own profile" on public.profiles;
drop policy if exists "Users update own profile" on public.profiles;
drop policy if exists "profiles_select_authenticated" on public.profiles;
drop policy if exists "profiles_insert_own" on public.profiles;
drop policy if exists "profiles_update_own" on public.profiles;

create policy "profiles_select_authenticated"
  on public.profiles for select to authenticated
  using (true);

create policy "profiles_insert_own"
  on public.profiles for insert to authenticated
  with check (id = auth.uid());

create policy "profiles_update_own"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- 3) Public avatars bucket (2 MB, common image types)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif'];

-- 4) Drop every known avatar storage policy name (old + new)
drop policy if exists "Avatar images are publicly accessible" on storage.objects;
drop policy if exists "Users can upload own avatar" on storage.objects;
drop policy if exists "Users can update own avatar" on storage.objects;
drop policy if exists "Users can delete own avatar" on storage.objects;
drop policy if exists "avatars public read" on storage.objects;
drop policy if exists "avatars own insert" on storage.objects;
drop policy if exists "avatars own update" on storage.objects;
drop policy if exists "avatars own delete" on storage.objects;
drop policy if exists "avatars_public_read" on storage.objects;
drop policy if exists "avatars_authenticated_insert" on storage.objects;
drop policy if exists "avatars_authenticated_update" on storage.objects;
drop policy if exists "avatars_authenticated_delete" on storage.objects;
drop policy if exists "Give users access to own folder 1oj01fe_0" on storage.objects;
drop policy if exists "Give users access to own folder 1oj01fe_1" on storage.objects;
drop policy if exists "Give users access to own folder 1oj01fe_2" on storage.objects;

-- Helper: own file under {auth.uid()}/...
-- Uses several checks because storage.foldername() is flaky on some projects.

-- Anyone can READ avatars (public bucket + <img> tags)
create policy "avatars_public_read"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Any authenticated user can UPLOAD into their own folder only
create policy "avatars_authenticated_insert"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or name like auth.uid()::text || '/%'
      or split_part(name, '/', 1) = auth.uid()::text
    )
  );

-- Update (needed for upsert / replace photo)
create policy "avatars_authenticated_update"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or name like auth.uid()::text || '/%'
      or split_part(name, '/', 1) = auth.uid()::text
    )
  )
  with check (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or name like auth.uid()::text || '/%'
      or split_part(name, '/', 1) = auth.uid()::text
    )
  );

-- Delete own avatar
create policy "avatars_authenticated_delete"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or name like auth.uid()::text || '/%'
      or split_part(name, '/', 1) = auth.uid()::text
    )
  );

-- Done. Every signed-in player (not just commissioner) can upload under:
--   avatars/{their-user-id}/avatar.jpg
