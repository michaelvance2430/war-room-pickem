-- REVIEW ONLY. Do not apply to production until the Patreon OAuth client and
-- Edge Function secrets are configured and the complete flow is validated.

create schema if not exists private;

grant usage on schema private to service_role;

create table if not exists private.patreon_oauth_states (
  state_hash text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

create index if not exists patreon_oauth_states_user_id_idx
  on private.patreon_oauth_states (user_id);

create table if not exists private.patreon_connections (
  user_id uuid primary key references auth.users(id) on delete cascade,
  patreon_user_id text not null unique,
  patreon_display_name text,
  patreon_avatar_url text,
  membership_status text not null default 'not_member'
    check (membership_status in ('active_patron', 'free_member', 'declined_patron', 'former_patron', 'not_member')),
  last_charge_status text,
  currently_entitled_amount_cents bigint not null default 0
    check (currently_entitled_amount_cents >= 0),
  campaign_id text,
  access_token_ciphertext text not null,
  refresh_token_ciphertext text not null,
  token_expires_at timestamptz not null,
  token_scope text,
  connected_at timestamptz not null default now(),
  verified_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table private.patreon_connections is
  'Server-only Patreon OAuth links. Tokens are AES-GCM encrypted by the Edge Function and never exposed through the Data API.';

revoke all on private.patreon_oauth_states from public, anon, authenticated;
revoke all on private.patreon_connections from public, anon, authenticated;
grant select, insert, update, delete on private.patreon_oauth_states to service_role;
grant select, insert, update, delete on private.patreon_connections to service_role;
