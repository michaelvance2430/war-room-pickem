-- Avatar upload fix — run ALL of this in Supabase SQL Editor
-- Fixes: "new row violates row-level security policy"

-- ========== PROFILES ==========
alter table public.profiles
  add column if not exists avatar_url text;

alter table public.profiles enable row level security;

drop policy if exists "Profiles viewable authenticated" on public.profiles;
create policy "Profiles viewable authenticated"
  on public.profiles for select to authenticated
  using (true);

drop policy if exists "Users insert own profile" on public.profiles;
create policy "Users insert own profile"
  on public.profiles for insert to authenticated
  with check (auth.uid() = id);

drop policy if exists "Users update own profile" on public.profiles;
create policy "Users update own profile"
  on public.profiles for update to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- ========== STORAGE BUCKET ==========
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  2097152,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update set
  public = true,
  file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

-- ========== STORAGE POLICIES ==========
-- Drop every common variant so we start clean
drop policy if exists "Avatar images are publicly accessible" on storage.objects;
drop policy if exists "Users can upload own avatar" on storage.objects;
drop policy if exists "Users can update own avatar" on storage.objects;
drop policy if exists "Users can delete own avatar" on storage.objects;
drop policy if exists "avatars public read" on storage.objects;
drop policy if exists "avatars own insert" on storage.objects;
drop policy if exists "avatars own update" on storage.objects;
drop policy if exists "avatars own delete" on storage.objects;

-- Public read (so <img src="..."> works)
create policy "avatars public read"
  on storage.objects for select
  using (bucket_id = 'avatars');

-- Authenticated users manage files only under their userId folder
-- Path format: {userId}/avatar.jpg
create policy "avatars own insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or name like auth.uid()::text || '/%'
    )
  );

create policy "avatars own update"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or name like auth.uid()::text || '/%'
    )
  )
  with check (
    bucket_id = 'avatars'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or name like auth.uid()::text || '/%'
    )
  );

create policy "avatars own delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (
      auth.uid()::text = (storage.foldername(name))[1]
      or name like auth.uid()::text || '/%'
    )
  );
