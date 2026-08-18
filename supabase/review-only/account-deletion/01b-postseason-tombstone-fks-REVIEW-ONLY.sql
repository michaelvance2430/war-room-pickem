-- Account deletion postseason history boundary.
-- Applied to production after refreshed branch proof on 2026-08-18.

begin;

-- These tables were added after the original account-deletion design and
-- pointed directly at auth.users with ON DELETE CASCADE. That would erase
-- Bowl/CFP entries and explanatory scorecards when a login is deleted.
-- Point them at the durable profile tombstone instead.
alter table public.cfb_postseason_entries
  drop constraint if exists cfb_postseason_entries_user_id_fkey;
alter table public.cfb_postseason_entries
  add constraint cfb_postseason_entries_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete restrict;

alter table public.postseason_scorecards
  drop constraint if exists postseason_scorecards_user_id_fkey;
alter table public.postseason_scorecards
  add constraint postseason_scorecards_user_id_fkey
  foreign key (user_id) references public.profiles(id) on delete restrict;

commit;
