-- =============================================================================
-- D1C-S2B / 02-helpers.sql
-- REVIEW ONLY — NON-PRODUCTION — DO NOT APPLY TO LIVE SUPABASE
-- =============================================================================
-- Depends on: 01-schema.sql, existing is_league_member / is_league_commissioner if present.
-- T8: is_platform_staff — NOT is_league_ops (deputies).
-- =============================================================================

-- ── T8: platform staff (distinct from league ops/staff) ─────────────────────

create or replace function public.is_platform_staff()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.platform_staff ps
    where ps.user_id = auth.uid()
      and ps.revoked_at is null
  );
$$;

comment on function public.is_platform_staff() is
  'D1C-S2B REVIEW-ONLY: true only if auth.uid() is on platform_staff allowlist. NOT deputy/ops.';

revoke all on function public.is_platform_staff() from public;
grant execute on function public.is_platform_staff() to authenticated;

-- League commissioner only (not deputies)
create or replace function public.is_league_commissioner_uid(p_league_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.leagues l
    where l.id = p_league_id
      and l.commissioner_id = auth.uid()
  );
$$;

revoke all on function public.is_league_commissioner_uid(uuid) from public;
grant execute on function public.is_league_commissioner_uid(uuid) to authenticated;

-- ── T5: season year — prefer persisted league field / deadlines / existing state ─
-- Does NOT finalize solely from current date. Clock year is last-resort fallback
-- for ephemeral empty DBs only; production must set active_competition_season_year
-- or season_deadlines.

create or replace function public.crystal_ball_resolve_season_year(p_league_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_sport text;
  v_year integer;
begin
  select l.sport_id, l.active_competition_season_year
    into v_sport, v_year
  from public.leagues l
  where l.id = p_league_id;

  if v_year is not null then
    return v_year;
  end if;

  -- Prefer highest season_year already on state for this league (historical sticky)
  select max(s.season_year) into v_year
  from public.crystal_ball_state s
  where s.league_id = p_league_id;
  if v_year is not null then
    return v_year;
  end if;

  -- Prefer season_deadlines for sport (server-owned; not RLS literal)
  if v_sport is null or v_sport = '' then
    v_sport := 'cfb';
  end if;
  if v_sport not in ('cfb', 'nfl') then
    v_sport := 'cfb';
  end if;

  select max(d.season_year) into v_year
  from public.crystal_ball_season_deadlines d
  where d.sport_id = v_sport;
  if v_year is not null then
    return v_year;
  end if;

  -- LAST RESORT (ephemeral empty catalog only). Production should never rely on this.
  return extract(year from (now() at time zone 'America/New_York'))::integer;
end;
$$;

comment on function public.crystal_ball_resolve_season_year(uuid) is
  'D1C-S2B REVIEW-ONLY: league.active_competition_season_year > state max > deadlines max > clock last-resort.';

revoke all on function public.crystal_ball_resolve_season_year(uuid) from public;
grant execute on function public.crystal_ball_resolve_season_year(uuid) to authenticated;

-- Ensure state row exists (idempotent; does not touch picks)
create or replace function public.crystal_ball_ensure_state(
  p_league_id uuid,
  p_season_year integer default null
)
returns public.crystal_ball_state
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year integer := coalesce(p_season_year, public.crystal_ball_resolve_season_year(p_league_id));
  v_row public.crystal_ball_state;
begin
  select * into v_row
  from public.crystal_ball_state s
  where s.league_id = p_league_id and s.season_year = v_year;

  if found then
    return v_row;
  end if;

  insert into public.crystal_ball_state (league_id, season_year, lock_source)
  values (p_league_id, v_year, 'unset')
  on conflict (league_id, season_year) do nothing;

  select * into v_row
  from public.crystal_ball_state s
  where s.league_id = p_league_id and s.season_year = v_year;

  return v_row;
end;
$$;

revoke all on function public.crystal_ball_ensure_state(uuid, integer) from public;
-- Intentionally not granted to authenticated for production posture in review package;
-- ephemeral tests may GRANT. Service/automation only in target design.
-- grant execute on function public.crystal_ball_ensure_state(uuid, integer) to service_role;

-- ── Write open / peers revealed ─────────────────────────────────────────────

create or replace function public.crystal_ball_is_write_open(
  p_league_id uuid,
  p_season_year integer default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_year integer := coalesce(p_season_year, public.crystal_ball_resolve_season_year(p_league_id));
  v_lock timestamptz;
  v_enabled boolean;
begin
  -- Feature flag
  select coalesce(l.crystal_ball_enabled, true) into v_enabled
  from public.leagues l where l.id = p_league_id;
  if v_enabled is false then
    return false;
  end if;

  -- Crown closes further pick writes (P2 side effect)
  if exists (
    select 1 from public.crystal_ball_result r where r.league_id = p_league_id
  ) then
    return false;
  end if;

  select s.lock_at into v_lock
  from public.crystal_ball_state s
  where s.league_id = p_league_id and s.season_year = v_year;

  -- Missing state or null lock_at ⇒ fail-open submissions (P5/P12)
  if v_lock is null then
    return true;
  end if;

  return now() < v_lock;
end;
$$;

comment on function public.crystal_ball_is_write_open(uuid, integer) is
  'D1C-S2B REVIEW-ONLY: true when picks may be written. Null lock_at = open. Crown = closed.';

revoke all on function public.crystal_ball_is_write_open(uuid, integer) from public;
grant execute on function public.crystal_ball_is_write_open(uuid, integer) to authenticated;

create or replace function public.crystal_ball_is_peers_revealed(
  p_league_id uuid,
  p_season_year integer default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_year integer := coalesce(p_season_year, public.crystal_ball_resolve_season_year(p_league_id));
  v_reveal timestamptz;
begin
  -- P2 permanent crown backstop — no week_results, no year literals
  if exists (
    select 1 from public.crystal_ball_result r where r.league_id = p_league_id
  ) then
    return true;
  end if;

  select s.reveal_at into v_reveal
  from public.crystal_ball_state s
  where s.league_id = p_league_id and s.season_year = v_year;

  if v_reveal is null then
    return false; -- fail-closed peers (P5/P12)
  end if;

  return now() >= v_reveal;
end;
$$;

comment on function public.crystal_ball_is_peers_revealed(uuid, integer) is
  'D1C-S2B REVIEW-ONLY: peers visible after reveal_at or crown. Never week_results.';

revoke all on function public.crystal_ball_is_peers_revealed(uuid, integer) from public;
grant execute on function public.crystal_ball_is_peers_revealed(uuid, integer) to authenticated;

-- App dual-read RPC
create or replace function public.crystal_ball_lock_state(
  p_league_id uuid,
  p_season_year integer default null
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_year integer;
  v_sport text;
  v_state public.crystal_ball_state;
  v_member boolean;
begin
  if auth.uid() is null then
    return json_build_object('ok', false, 'error', 'Not authenticated');
  end if;

  -- Prefer existing is_league_member when present
  begin
    execute 'select public.is_league_member($1)' into v_member using p_league_id;
  exception when undefined_function then
    v_member := exists (
      select 1 from public.memberships m
      where m.league_id = p_league_id and m.user_id = auth.uid()
    );
  end;

  if not coalesce(v_member, false) then
    return json_build_object('ok', false, 'error', 'Not a league member');
  end if;

  v_year := coalesce(p_season_year, public.crystal_ball_resolve_season_year(p_league_id));
  select l.sport_id into v_sport from public.leagues l where l.id = p_league_id;

  select * into v_state
  from public.crystal_ball_state s
  where s.league_id = p_league_id and s.season_year = v_year;

  return json_build_object(
    'ok', true,
    'sport_id', v_sport,
    'season_year', v_year,
    'lock_at', v_state.lock_at,
    'reveal_at', v_state.reveal_at,
    'is_locked', (
      v_state.lock_at is not null and now() >= v_state.lock_at
    ),
    'is_write_open', public.crystal_ball_is_write_open(p_league_id, v_year),
    'is_peers_revealed', public.crystal_ball_is_peers_revealed(p_league_id, v_year),
    'lock_source', coalesce(v_state.lock_source, 'unset'),
    'lock_reason', v_state.lock_reason,
    'schedule_warning', coalesce(v_state.schedule_warning, true),
    'schedule_warning_code', v_state.schedule_warning_code,
    'kickoff_known', v_state.proposed_kickoff_at is not null,
    'crowned', exists (
      select 1 from public.crystal_ball_result r where r.league_id = p_league_id
    ),
    'state_missing', v_state.league_id is null
  );
end;
$$;

revoke all on function public.crystal_ball_lock_state(uuid, integer) from public;
grant execute on function public.crystal_ball_lock_state(uuid, integer) to authenticated;

-- ── Sticky propose from schedule (automation; no free-text in RLS) ──────────

create or replace function public.crystal_ball_parse_iso_timestamptz(p_raw text)
returns timestamptz
language plpgsql
immutable
as $$
begin
  if p_raw is null or length(trim(p_raw)) = 0 then
    return null;
  end if;
  -- ISO-like only — reject free-form schedule strings
  if p_raw !~ '^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}' then
    return null;
  end if;
  begin
    return p_raw::timestamptz;
  exception when others then
    return null;
  end;
end;
$$;

create or replace function public.crystal_ball_opening_week_first_kickoff(
  p_league_id uuid,
  p_opening_week integer
)
returns timestamptz
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_min timestamptz;
begin
  select min(public.crystal_ball_parse_iso_timestamptz(cg.start_time))
    into v_min
  from public.week_cards wc
  join public.card_games cg on cg.week_card_id = wc.id
  where wc.league_id = p_league_id
    and wc.week_number = p_opening_week
    and wc.published_at is not null
    and length(trim(wc.published_at::text)) > 0
    and cg.start_time is not null;

  return v_min;
end;
$$;

-- Apply candidate with sticky rules:
-- - populate if unset
-- - may move EARLIER only if current lock_at not yet passed
-- - never move LATER via automation
-- - never replace with null/invalid
create or replace function public.crystal_ball_apply_lock_candidate(
  p_league_id uuid,
  p_season_year integer,
  p_candidate timestamptz,
  p_source text,
  p_reason text default null,
  p_kickoff timestamptz default null,
  p_calendar timestamptz default null,
  p_allow_earlier boolean default true
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_row public.crystal_ball_state;
  v_old timestamptz;
begin
  perform public.crystal_ball_ensure_state(p_league_id, p_season_year);

  select * into v_row
  from public.crystal_ball_state
  where league_id = p_league_id and season_year = p_season_year
  for update;

  v_old := v_row.lock_at;

  -- Invalid / null candidate: never clobber valid lock
  if p_candidate is null then
    update public.crystal_ball_state
    set schedule_warning = true,
        schedule_warning_code = coalesce(schedule_warning_code, 'invalid_or_missing_schedule'),
        proposed_kickoff_at = coalesce(p_kickoff, proposed_kickoff_at),
        proposed_calendar_at = coalesce(p_calendar, proposed_calendar_at),
        updated_at = now()
    where league_id = p_league_id and season_year = p_season_year;
    return json_build_object(
      'ok', true,
      'action', 'warning_only',
      'lock_at', v_old
    );
  end if;

  -- Unset → populate
  if v_old is null then
    update public.crystal_ball_state
    set lock_at = p_candidate,
        reveal_at = p_candidate, -- P1 default equal
        lock_source = p_source,
        lock_reason = p_reason,
        reveal_source = p_source,
        schedule_warning = false,
        schedule_warning_code = null,
        proposed_kickoff_at = p_kickoff,
        proposed_calendar_at = p_calendar,
        authority_version = authority_version + 1,
        updated_at = now()
    where league_id = p_league_id and season_year = p_season_year;
    return json_build_object('ok', true, 'action', 'set', 'lock_at', p_candidate);
  end if;

  -- Already locked past deadline: immutable via automation
  if now() >= v_old then
    return json_build_object(
      'ok', true,
      'action', 'sticky_post_lock',
      'lock_at', v_old
    );
  end if;

  -- Never move later via automation
  if p_candidate > v_old then
    return json_build_object(
      'ok', true,
      'action', 'reject_later',
      'lock_at', v_old
    );
  end if;

  -- Equal: no-op
  if p_candidate = v_old then
    update public.crystal_ball_state
    set proposed_kickoff_at = coalesce(p_kickoff, proposed_kickoff_at),
        proposed_calendar_at = coalesce(p_calendar, proposed_calendar_at),
        updated_at = now()
    where league_id = p_league_id and season_year = p_season_year;
    return json_build_object('ok', true, 'action', 'unchanged', 'lock_at', v_old);
  end if;

  -- Earlier move (pre-lock only)
  if p_allow_earlier and p_candidate < v_old then
    update public.crystal_ball_state
    set lock_at = p_candidate,
        reveal_at = p_candidate, -- keep equal by default; never drift later
        lock_source = p_source,
        lock_reason = p_reason,
        reveal_source = p_source,
        proposed_kickoff_at = p_kickoff,
        proposed_calendar_at = p_calendar,
        authority_version = authority_version + 1,
        updated_at = now()
    where league_id = p_league_id and season_year = p_season_year;
    return json_build_object(
      'ok', true,
      'action', 'moved_earlier',
      'old_lock_at', v_old,
      'lock_at', p_candidate
    );
  end if;

  return json_build_object('ok', true, 'action', 'sticky', 'lock_at', v_old);
end;
$$;

revoke all on function public.crystal_ball_apply_lock_candidate(
  uuid, integer, timestamptz, text, text, timestamptz, timestamptz, boolean
) from public;
-- Automation / service only in target; ephemeral tests may grant.

create or replace function public.crystal_ball_propose_lock_from_schedule(p_league_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_sport text;
  v_year integer;
  v_opening int;
  v_cal timestamptz;
  v_kick timestamptz;
  v_cand timestamptz;
  v_source text;
begin
  select coalesce(nullif(l.sport_id, ''), 'cfb') into v_sport
  from public.leagues l where l.id = p_league_id;
  if v_sport not in ('cfb', 'nfl') then
    v_sport := 'cfb';
  end if;

  v_year := public.crystal_ball_resolve_season_year(p_league_id);
  v_opening := case when v_sport = 'nfl' then 1 else 0 end;

  select d.lock_at into v_cal
  from public.crystal_ball_season_deadlines d
  where d.sport_id = v_sport and d.season_year = v_year;

  v_kick := public.crystal_ball_opening_week_first_kickoff(p_league_id, v_opening);

  if v_sport = 'nfl' then
    if v_kick is null then
      return public.crystal_ball_apply_lock_candidate(
        p_league_id, v_year, null, 'unset',
        'no published W1 kickoff', null, null, true
      );
    end if;
    return public.crystal_ball_apply_lock_candidate(
      p_league_id, v_year, v_kick, 'nfl_w1_kickoff',
      'formally published week 1 first kickoff', v_kick, null, true
    );
  end if;

  -- CFB: earlier of calendar and W0 kickoff when both valid
  if v_cal is not null and v_kick is not null then
    if v_cal <= v_kick then
      v_cand := v_cal;
      v_source := 'cfb_min_calendar_kickoff';
    else
      v_cand := v_kick;
      v_source := 'cfb_min_calendar_kickoff';
    end if;
  elsif v_cal is not null then
    v_cand := v_cal;
    v_source := 'cfb_calendar';
  elsif v_kick is not null then
    v_cand := v_kick;
    v_source := 'cfb_w0_kickoff';
  else
    return public.crystal_ball_apply_lock_candidate(
      p_league_id, v_year, null, 'unset',
      'missing cfb calendar and kickoff', null, null, true
    );
  end if;

  return public.crystal_ball_apply_lock_candidate(
    p_league_id, v_year, v_cand, v_source,
    'cfb schedule proposal', v_kick, v_cal, true
  );
end;
$$;

revoke all on function public.crystal_ball_propose_lock_from_schedule(uuid) from public;

-- =============================================================================
-- END 02-helpers.sql — REVIEW ONLY — NON-PRODUCTION
-- =============================================================================
