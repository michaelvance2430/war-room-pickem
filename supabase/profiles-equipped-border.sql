-- Profile avatar borders unlocked by achievements.
-- Run once in Supabase SQL Editor.

alter table public.profiles
  add column if not exists equipped_border_id text;

comment on column public.profiles.equipped_border_id is
  'Profile border id from PROFILE_BORDER_CATALOG (e.g. legend, toilet, plain).';
