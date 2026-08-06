-- =============================================================================
-- D1B-B / 02-helpers.sql
-- REVIEW ONLY — DO NOT APPLY TO LIVE WITHOUT SEPARATE STAGE AUTH
-- =============================================================================
-- Shared helpers for join RPCs. Do not alter is_league_member grants (H-01).
-- =============================================================================

-- Error contract: raise with SQLSTATE + message prefix d1b_b:
--   d1b_b:not_authenticated
--   d1b_b:invalid_code
--   d1b_b:not_found
--   d1b_b:not_open
--   d1b_b:league_full
--   d1b_b:validation_failed
--   d1b_b:already_exists (optional rejoin uses success return instead)

create or replace function public.d1b_b_raise(p_code text, p_detail text default null)
returns void
language plpgsql
immutable
as $$
begin
  raise exception '%',
    'd1b_b:' || p_code || coalesce(' ' || p_detail, '')
    using errcode = 'P0001';
end;
$$;

comment on function public.d1b_b_raise(text, text) is
  'D1B-B REVIEW-ONLY: structured error helper for join RPCs';

-- Count human members (not bots) for capacity
create or replace function public.d1b_b_human_member_count(p_league_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.memberships m
  where m.league_id = p_league_id
    and coalesce(m.is_bot, false) = false;
$$;

comment on function public.d1b_b_human_member_count(uuid) is
  'D1B-B: human seats only (is_bot false or null). Commissioner included.';

revoke all on function public.d1b_b_human_member_count(uuid) from public;
-- Internal to DEFINER RPCs; optional grant to authenticated not required.

-- Least-populated division (North/South/East/West)
create or replace function public.d1b_b_next_division(p_league_id uuid)
returns public.division
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_best public.division := 'North';
  v_best_n int := 2147483647;
  v_d text;
  v_n int;
begin
  for v_d in select unnest(array['North', 'South', 'East', 'West'])
  loop
    select count(*)::int into v_n
    from public.memberships m
    where m.league_id = p_league_id
      and m.division::text = v_d;
    if v_n < v_best_n then
      v_best_n := v_n;
      v_best := v_d::public.division;
    end if;
  end loop;
  return v_best;
end;
$$;

revoke all on function public.d1b_b_next_division(uuid) from public;

-- Generate unique 6-char league code (A-Z0-9), retry on collision
create or replace function public.d1b_b_generate_league_code()
returns text
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  v_code text;
  v_i int;
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  for v_i in 1..32 loop
    v_code := '';
    -- 6 chars
    v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::int, 1);
    if not exists (select 1 from public.leagues l where l.code = v_code) then
      return v_code;
    end if;
  end loop;
  perform public.d1b_b_raise('validation_failed', 'code generation exhausted');
  return null;
end;
$$;

revoke all on function public.d1b_b_generate_league_code() from public;

-- Resolve max_human_members (default 32 if column null/missing use)
create or replace function public.d1b_b_max_human_members(p_league_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_max int;
begin
  begin
    select l.max_human_members into v_max
    from public.leagues l
    where l.id = p_league_id;
  exception when undefined_column then
    return 32;
  end;
  if v_max is null or v_max < 2 then
    return 32;
  end if;
  return v_max;
end;
$$;

revoke all on function public.d1b_b_max_human_members(uuid) from public;

-- Fair-entry stub: v1 returns 0; integrate fair-entry rules later without client trust
create or replace function public.d1b_b_fair_entry_points(p_league_id uuid)
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select 0;
$$;

comment on function public.d1b_b_fair_entry_points(uuid) is
  'D1B-B REVIEW-ONLY stub. Replace with server fair-entry band logic before mid-season join production hardening.';

revoke all on function public.d1b_b_fair_entry_points(uuid) from public;

-- END 02 — REVIEW ONLY
