-- Disposable branch only: reproduce production columns added by loose SQL files.
-- This is test scaffolding, not a production migration.

alter table public.profiles
  add column if not exists avatar_url text null,
  add column if not exists equipped_border_id text null,
  add column if not exists equipped_title_id text null,
  add column if not exists last_seen_at timestamptz null,
  add column if not exists birthday_mmdd text null,
  add column if not exists birthday_locked_at timestamptz null,
  add column if not exists blue_falcon_count integer not null default 0;

alter table public.memberships
  add column if not exists is_bot boolean not null default false,
  add column if not exists is_moderator boolean not null default false,
  add column if not exists locker_muted boolean not null default false,
  add column if not exists is_deputy boolean not null default false,
  add column if not exists display_name_override text null;

alter table public.leagues
  add column if not exists open_room_nudge_pending boolean not null default false,
  add column if not exists open_room_nudge_left_name text null,
  add column if not exists open_room_nudge_at timestamptz null;

