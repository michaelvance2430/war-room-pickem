-- Per-install notification truth. A token alone cannot distinguish an Apple
-- permission denial from a device that has never registered.
create table if not exists public.push_notification_preferences (
  user_id uuid not null references public.profiles(id) on delete cascade,
  installation_id uuid not null,
  platform text not null default 'ios' check (platform in ('ios', 'android')),
  environment text not null check (environment in ('development', 'production')),
  authorization_status text not null check (
    authorization_status in ('not_determined', 'denied', 'authorized', 'provisional', 'ephemeral', 'unknown')
  ),
  preference_enabled boolean not null default true,
  app_build text not null,
  created_at timestamptz not null default clock_timestamp(),
  last_seen_at timestamptz not null default clock_timestamp(),
  primary key (user_id, installation_id)
);

alter table public.push_notification_preferences enable row level security;
revoke all on public.push_notification_preferences from anon;
grant select, insert, update, delete on public.push_notification_preferences to authenticated;

drop policy if exists push_notification_preferences_select_own on public.push_notification_preferences;
create policy push_notification_preferences_select_own
  on public.push_notification_preferences for select to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists push_notification_preferences_insert_own on public.push_notification_preferences;
create policy push_notification_preferences_insert_own
  on public.push_notification_preferences for insert to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists push_notification_preferences_update_own on public.push_notification_preferences;
create policy push_notification_preferences_update_own
  on public.push_notification_preferences for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists push_notification_preferences_delete_own on public.push_notification_preferences;
create policy push_notification_preferences_delete_own
  on public.push_notification_preferences for delete to authenticated
  using ((select auth.uid()) = user_id);

create index if not exists push_notification_preferences_status_idx
  on public.push_notification_preferences (authorization_status, preference_enabled, last_seen_at desc);
