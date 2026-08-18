-- War Room account deletion lifecycle boundary.
-- Applied to production after refreshed branch proof on 2026-08-18.

begin;

-- A profile becomes the durable, non-login participant record. Removing this
-- FK is what prevents Auth deletion from cascading through War Room history.
alter table public.profiles
  drop constraint if exists profiles_id_fkey;

alter table public.profiles
  add column if not exists account_state text not null default 'active',
  add column if not exists deleted_at timestamptz null;

alter table public.profiles
  drop constraint if exists profiles_account_state_check;

alter table public.profiles
  add constraint profiles_account_state_check
  check (account_state in ('active', 'deletion_in_progress', 'deleted'));

alter table public.profiles
  drop constraint if exists profiles_deleted_state_consistency_check;

alter table public.profiles
  add constraint profiles_deleted_state_consistency_check
  check (
    (account_state = 'deleted' and deleted_at is not null)
    or (account_state <> 'deleted' and deleted_at is null)
  );

create index if not exists profiles_account_state_idx
  on public.profiles (account_state)
  where account_state <> 'active';

-- Existing profile UPDATE policy allows users to edit their own row. Prevent a
-- browser JWT from changing lifecycle state while preserving normal profile edits.
create or replace function public.guard_profile_lifecycle_columns()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if current_user not in ('service_role', 'postgres', 'supabase_admin')
     and (
       new.account_state is distinct from old.account_state
       or new.deleted_at is distinct from old.deleted_at
     ) then
    raise exception 'Account lifecycle fields are server-managed';
  end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_lifecycle_columns
  on public.profiles;

create trigger guard_profile_lifecycle_columns
before update of account_state, deleted_at on public.profiles
for each row execute function public.guard_profile_lifecycle_columns();

revoke all on function public.guard_profile_lifecycle_columns() from public;

-- Keep the operation ledger outside the exposed public schema. It contains no
-- email, provider identity, display name, or deletion confirmation phrase.
create schema if not exists private;

create table if not exists private.account_deletion_operations (
  id uuid primary key default gen_random_uuid(),
  target_user_id uuid not null,
  requested_by uuid not null,
  status text not null default 'requested'
    check (status in (
      'requested',
      'blocked_commissioner',
      'revoking_sessions',
      'deleting_private_data',
      'redacting_history',
      'deleting_auth_user',
      'complete',
      'failed'
    )),
  attempt_count integer not null default 0 check (attempt_count >= 0),
  error_code text null,
  requested_at timestamptz not null default now(),
  started_at timestamptz null,
  completed_at timestamptz null,
  updated_at timestamptz not null default now()
);

create unique index if not exists account_deletion_one_open_operation_idx
  on private.account_deletion_operations (target_user_id)
  where status not in ('complete', 'failed');

alter table private.account_deletion_operations enable row level security;
revoke all on schema private from public, anon, authenticated;
revoke all on private.account_deletion_operations from public, anon, authenticated;

drop policy if exists "No client access" on private.account_deletion_operations;
create policy "No client access"
  on private.account_deletion_operations
  as restrictive
  for all
  to anon, authenticated
  using (false)
  with check (false);

grant usage on schema private to service_role;
grant select, insert, update on private.account_deletion_operations to service_role;

-- Policies and privileged RPCs call this in addition to checking auth.uid().
-- SECURITY DEFINER avoids recursive profiles RLS evaluation. The fixed empty
-- search_path and fully-qualified relation prevent object-shadowing attacks.
create or replace function private.is_active_account()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = (select auth.uid())
      and p.account_state = 'active'
  );
$$;

revoke all on function private.is_active_account() from public, anon;
grant usage on schema private to authenticated, service_role;
grant execute on function private.is_active_account() to authenticated, service_role;

comment on column public.profiles.account_state is
  'Server-managed account lifecycle. Non-active profiles must fail closed in protected RLS and RPC paths.';
comment on table private.account_deletion_operations is
  'Server-only idempotent account deletion ledger. Never expose through the Data API.';

commit;
