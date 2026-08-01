-- War Room platform status (Founder Dashboard incident banner)
-- Run once in Supabase → SQL Editor. Safe to re-run.

create table if not exists public.platform_status (
  id int primary key default 1 check (id = 1),
  incident_active boolean not null default false,
  incident_message text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid null
);

insert into public.platform_status (id, incident_active, incident_message)
values (1, false, '')
on conflict (id) do nothing;

alter table public.platform_status enable row level security;

-- Everyone (incl. anon) can read — banner must show before login too
drop policy if exists "platform_status_select_all" on public.platform_status;
create policy "platform_status_select_all"
  on public.platform_status for select
  to anon, authenticated
  using (true);

-- Authenticated can update the single row (Founder UI is creator-gated in app)
drop policy if exists "platform_status_update_auth" on public.platform_status;
create policy "platform_status_update_auth"
  on public.platform_status for update
  to authenticated
  using (id = 1)
  with check (id = 1);

-- No insert/delete from clients
drop policy if exists "platform_status_insert_none" on public.platform_status;
drop policy if exists "platform_status_delete_none" on public.platform_status;
