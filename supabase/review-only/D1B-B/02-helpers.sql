-- =============================================================================
-- D1B-B / 02-helpers.sql
-- REVIEW ONLY — DO NOT APPLY TO LIVE WITHOUT SEPARATE STAGE AUTH
-- =============================================================================
-- Shared helpers for join RPCs. Fair-entry points: see 02b-fair-entry.sql
-- Do not alter is_league_member grants (H-01).
-- =============================================================================

-- Error helper: VOLATILE (raises; not immutable)
create or replace function public.d1b_b_raise(p_code text, p_detail text default null)
returns void
language plpgsql
volatile
as $$
declare
  v_code text := lower(trim(coalesce(p_code, 'validation_failed')));
  v_allowed text[] := array[
    'not_authenticated',
    'invalid_code',
    'not_found',
    'not_open',
    'league_full',
    'validation_failed'
  ];
begin
  if not (v_code = any (v_allowed)) then
    v_code := 'validation_failed';
  end if;
  -- Message: d1b_b:<code> only — no codes, ids, or SQL internals in detail for client
  -- Detail is optional short token (e.g. 'name') — never league codes or user ids
  raise exception '%',
    'd1b_b:' || v_code ||
    case
      when p_detail is null or length(trim(p_detail)) = 0 then ''
      when length(trim(p_detail)) > 32 then ''
      when trim(p_detail) ~ '^[a-z0-9_]+$' then ' ' || trim(p_detail)
      else ''
    end
    using errcode = 'P0001';
end;
$$;

comment on function public.d1b_b_raise(text, text) is
  'D1B-B REVIEW-ONLY: VOLATILE structured errors. Prefix d1b_b:<code>. No secrets.';

-- Canonical live sports only (src/lib/sports/registry.ts status: live)
create or replace function public.d1b_b_normalize_sport_id(p_sport text)
returns text
language plpgsql
immutable
as $$
declare
  v text := lower(trim(coalesce(p_sport, '')));
begin
  if v = '' then
    return 'cfb';
  end if;
  if v in ('cfb', 'nfl') then
    return v;
  end if;
  -- Unsupported (including coming_soon shells like soccer_wwc, nba, nhl)
  return null;
end;
$$;

comment on function public.d1b_b_normalize_sport_id(text) is
  'D1B-B: allowlist live production sports only — cfb, nfl. Blank → cfb. Else null.';

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

-- Least-populated division (North/South/East/West) — NOT fair-entry points
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

-- Generate unique 6-char league code (same charset as join/page.tsx generateCode)
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
  v_j int;
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  for v_i in 1..32 loop
    v_code := '';
    for v_j in 1..6 loop
      v_code := v_code || substr(
        v_chars,
        1 + floor(random() * length(v_chars))::int,
        1
      );
    end loop;
    if not exists (select 1 from public.leagues l where l.code = v_code) then
      return v_code;
    end if;
  end loop;
  perform public.d1b_b_raise('validation_failed', 'code_gen');
  return null;
end;
$$;

revoke all on function public.d1b_b_generate_league_code() from public;

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

revoke all on function public.d1b_b_raise(text, text) from public;
revoke all on function public.d1b_b_normalize_sport_id(text) from public;

-- END 02 — REVIEW ONLY (fair-entry in 02b)
