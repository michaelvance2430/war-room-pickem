-- Optional: equip a badge as a name title (visible league-wide).
-- Run once in Supabase SQL Editor.

alter table public.profiles
  add column if not exists equipped_title_id text;

comment on column public.profiles.equipped_title_id is
  'Badge id worn as a name title (e.g. war_room_legend → War Room Legend).';

-- Players update their own profile row (existing RLS usually already allows this).
