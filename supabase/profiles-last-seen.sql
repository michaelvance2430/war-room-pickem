-- Last time a player opened the app (presence / activity).
-- Run once in Supabase SQL Editor.

alter table public.profiles
  add column if not exists last_seen_at timestamptz;

comment on column public.profiles.last_seen_at is
  'Last time this user hit the app (client-updated, throttled).';

create index if not exists profiles_last_seen_at_idx
  on public.profiles (last_seen_at desc nulls last);
