-- =============================================================================
-- D1B-B / 00b-jwt-and-fixtures.sql
-- REVIEW ONLY — DISPOSABLE EMPTY BRANCH ONLY — REQUIRES SENTINEL
-- NEVER APPLY TO PRODUCTION
-- =============================================================================

do $$
begin
  if not exists (select 1 from public.d1b_b_disposable_environment) then
    raise exception 'D1B-B fixtures: missing d1b_b_disposable_environment sentinel — refuse';
  end if;
  if to_regclass('public.leagues') is null then
    raise exception 'D1B-B fixtures: run 00-disposable-baseline.sql first';
  end if;
end $$;

-- ── JWT claim helpers (transaction-local) ───────────────────────────────────
create or replace function public.d1b_b_disp_set_auth(p_uid uuid)
returns void
language plpgsql
volatile
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from public.d1b_b_disposable_environment) then
    raise exception 'auth harness: sentinel required';
  end if;
  if p_uid is null then
    perform set_config('request.jwt.claim.sub', '', true);
    perform set_config('request.jwt.claims', '', true);
    return;
  end if;
  perform set_config('request.jwt.claim.sub', p_uid::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', p_uid::text, 'role', 'authenticated')::text,
    true
  );
end;
$$;

create or replace function public.d1b_b_disp_clear_auth()
returns void
language sql
volatile
as $$
  select public.d1b_b_disp_set_auth(null);
$$;

comment on function public.d1b_b_disp_set_auth(uuid) is
  'DISPOSABLE: set auth.uid() via JWT claim simulation. Reset between cases.';

-- ── Synthetic identities (deterministic UUIDs — not production) ─────────────
-- creator:  aaaaaaaa-bbbb-cccc-dddd-000000000001
-- player_a: aaaaaaaa-bbbb-cccc-dddd-000000000002
-- player_b: aaaaaaaa-bbbb-cccc-dddd-000000000003
-- nonmember:aaaaaaaa-bbbb-cccc-dddd-000000000004
-- bot_1:    aaaaaaaa-bbbb-cccc-dddd-0000000000b1

insert into public.profiles (id, display_name) values
  ('aaaaaaaa-bbbb-cccc-dddd-000000000001', 'Disp Creator'),
  ('aaaaaaaa-bbbb-cccc-dddd-000000000002', 'Disp Player A'),
  ('aaaaaaaa-bbbb-cccc-dddd-000000000003', 'Disp Player B'),
  ('aaaaaaaa-bbbb-cccc-dddd-000000000004', 'Disp Nonmember'),
  ('aaaaaaaa-bbbb-cccc-dddd-0000000000b1', 'Disp Bot One')
on conflict (id) do nothing;

-- Fixture registry
create table if not exists public.d1b_b_disp_fixture_registry (
  key text primary key,
  league_id uuid,
  note text
);

-- Pre-seeded closed league with private code + open league shells are created
-- by the test runner after RPCs exist (or here via direct SQL for capacity FE).

-- END 00b
