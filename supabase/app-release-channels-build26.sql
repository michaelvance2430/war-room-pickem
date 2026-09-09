-- Server-controlled iOS update notice. Keep disabled until Apple confirms that
-- the recommended build is publicly available.
begin;

create table if not exists public.app_release_channels (
  platform text primary key check (platform in ('ios')),
  recommended_build integer not null default 0 check (recommended_build >= 0),
  minimum_build integer not null default 0 check (minimum_build >= 0),
  release_version text not null,
  message text,
  product_url text,
  enabled boolean not null default false,
  updated_at timestamptz not null default now(),
  constraint app_release_channels_minimum_check check (minimum_build <= recommended_build)
);

alter table public.app_release_channels enable row level security;
revoke all on table public.app_release_channels from anon, authenticated;
grant select on table public.app_release_channels to anon, authenticated;

drop policy if exists "Public release channels are readable" on public.app_release_channels;
create policy "Public release channels are readable"
  on public.app_release_channels for select to anon, authenticated using (true);

insert into public.app_release_channels
  (platform, recommended_build, minimum_build, release_version, message, product_url, enabled)
values
  ('ios', 0, 0, '3.4', 'A new War Room Pick''Em update is ready. Update now to get the latest fixes and features.',
   'https://apps.apple.com/app/id6802751064', false)
on conflict (platform) do nothing;

notify pgrst, 'reload schema';
commit;

-- After Apple shows a build as Ready for Sale:
-- update public.app_release_channels
-- set recommended_build = 27, minimum_build = 0, release_version = '3.4',
--     enabled = true, updated_at = now()
-- where platform = 'ios';
