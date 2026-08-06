-- =============================================================================
-- D1C-S2B / 04-rpc-bot-crown-deadline.sql
-- REVIEW ONLY — NON-PRODUCTION — DO NOT APPLY TO LIVE SUPABASE
-- =============================================================================

-- ── Bot seed: hard-deny after lock (P6) ─────────────────────────────────────
-- Replaces body pattern of seed_bot_crystal_ball_picks; safe to create if missing.

create or replace function public.seed_bot_crystal_ball_picks(
  p_league_id uuid,
  p_picks jsonb
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_item jsonb;
  v_bot uuid;
  v_team text;
  v_inserted int := 0;
  v_skipped int := 0;
begin
  if v_uid is null then
    return json_build_object('ok', false, 'error', 'Not authenticated');
  end if;

  if not public.is_league_commissioner_uid(p_league_id) then
    return json_build_object('ok', false, 'error', 'Commissioner only');
  end if;

  -- P6: same production lock as humans
  if not public.crystal_ball_is_write_open(p_league_id) then
    return json_build_object('ok', false, 'error', 'Crystal Ball locked');
  end if;

  if p_picks is null or jsonb_typeof(p_picks) <> 'array' then
    return json_build_object('ok', false, 'error', 'p_picks must be a JSON array');
  end if;

  for v_item in select * from jsonb_array_elements(p_picks)
  loop
    begin
      v_bot := (v_item->>'user_id')::uuid;
    exception when others then
      v_skipped := v_skipped + 1;
      continue;
    end;

    v_team := trim(coalesce(v_item->>'team_name', ''));
    if v_team = '' or char_length(v_team) > 120 then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    if not exists (
      select 1 from public.memberships m
      where m.league_id = p_league_id
        and m.user_id = v_bot
        and m.is_bot = true
    ) then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    insert into public.crystal_ball_picks (league_id, user_id, team_name, picked_at)
    values (p_league_id, v_bot, v_team, now())
    on conflict (league_id, user_id) do update
      set team_name = excluded.team_name,
          picked_at = excluded.picked_at;

    v_inserted := v_inserted + 1;
  end loop;

  return json_build_object(
    'ok', true,
    'inserted', v_inserted,
    'skipped', v_skipped
  );
end;
$$;

revoke all on function public.seed_bot_crystal_ball_picks(uuid, jsonb) from public;
grant execute on function public.seed_bot_crystal_ball_picks(uuid, jsonb) to authenticated;

-- ── Crown RPC (P7/P8) ───────────────────────────────────────────────────────
-- Commissioner of that league OR is_platform_staff().
-- NOT is_league_ops (deputies cannot crown).
-- First crown immutable; no re-upsert.

create or replace function public.crown_crystal_ball_champion(
  p_league_id uuid,
  p_champion_team text
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_team text := trim(coalesce(p_champion_team, ''));
  v_winners int := 0;
  v_commish boolean;
  v_platform boolean;
begin
  if v_uid is null then
    return json_build_object('ok', false, 'error', 'Not authenticated');
  end if;

  v_commish := public.is_league_commissioner_uid(p_league_id);
  v_platform := public.is_platform_staff();

  if not (v_commish or v_platform) then
    return json_build_object(
      'ok', false,
      'error', 'Commissioner or platform staff only'
    );
  end if;

  if v_team = '' or char_length(v_team) > 120 then
    return json_build_object('ok', false, 'error', 'Invalid champion team');
  end if;

  if exists (
    select 1 from public.crystal_ball_result r where r.league_id = p_league_id
  ) then
    return json_build_object('ok', false, 'error', 'already_crowned');
  end if;

  insert into public.crystal_ball_result (
    league_id, champion_team, crowned_at, crowned_by
  ) values (
    p_league_id, v_team, now(), v_uid
  );

  -- Does NOT modify crystal_ball_state.lock_at / reveal_at (P2)

  select count(*)::int into v_winners
  from public.crystal_ball_picks p
  where p.league_id = p_league_id
    and lower(p.team_name) = lower(v_team);

  return json_build_object(
    'ok', true,
    'winners', v_winners,
    'crowned_by', v_uid,
    'via_platform_staff', v_platform and not v_commish
  );
end;
$$;

comment on function public.crown_crystal_ball_champion(uuid, text) is
  'D1C-S2B REVIEW-ONLY: first crown only. Commish or platform_staff. Not deputies.';

revoke all on function public.crown_crystal_ball_champion(uuid, text) from public;
grant execute on function public.crown_crystal_ball_champion(uuid, text) to authenticated;

-- ── Pre-lock audited deadline correction (platform staff only) ──────────────

create or replace function public.correct_crystal_ball_deadline(
  p_league_id uuid,
  p_new_lock_at timestamptz,
  p_reason text,
  p_season_year integer default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_year integer;
  v_old_lock timestamptz;
  v_old_reveal timestamptz;
  v_reason text := trim(coalesce(p_reason, ''));
begin
  if v_uid is null then
    return json_build_object('ok', false, 'error', 'Not authenticated');
  end if;

  -- T8: platform staff only — NOT commissioners, NOT is_league_ops deputies
  if not public.is_platform_staff() then
    return json_build_object('ok', false, 'error', 'Platform staff only');
  end if;

  if p_new_lock_at is null then
    return json_build_object('ok', false, 'error', 'new_lock_at required');
  end if;

  if length(v_reason) < 8 then
    return json_build_object('ok', false, 'error', 'reason required (min 8 chars)');
  end if;

  v_year := coalesce(p_season_year, public.crystal_ball_resolve_season_year(p_league_id));
  perform public.crystal_ball_ensure_state(p_league_id, v_year);

  select s.lock_at, s.reveal_at into v_old_lock, v_old_reveal
  from public.crystal_ball_state s
  where s.league_id = p_league_id and s.season_year = v_year
  for update;

  -- Post-lock: immutable (break-glass not in S2b)
  if v_old_lock is not null and now() >= v_old_lock then
    return json_build_object(
      'ok', false,
      'error', 'lock_at immutable after lock has passed'
    );
  end if;

  -- Also refuse if new lock is already in the past? Allowed only if still pre old lock;
  -- if setting to past, that would lock immediately — allowed for correction of error.
  insert into public.crystal_ball_deadline_corrections (
    league_id, season_year,
    old_lock_at, new_lock_at,
    old_reveal_at, new_reveal_at,
    reason, corrected_by
  ) values (
    p_league_id, v_year,
    v_old_lock, p_new_lock_at,
    v_old_reveal, p_new_lock_at, -- P1 keep equal; never drift later alone
    v_reason, v_uid
  );

  update public.crystal_ball_state
  set lock_at = p_new_lock_at,
      reveal_at = p_new_lock_at,
      lock_source = 'manual_ops',
      lock_reason = v_reason,
      reveal_source = 'manual_ops',
      schedule_warning = false,
      schedule_warning_code = null,
      authority_version = authority_version + 1,
      updated_at = now(),
      updated_by = v_uid
  where league_id = p_league_id and season_year = v_year;

  return json_build_object(
    'ok', true,
    'old_lock_at', v_old_lock,
    'new_lock_at', p_new_lock_at,
    'season_year', v_year,
    'corrected_by', v_uid
  );
end;
$$;

comment on function public.correct_crystal_ball_deadline(uuid, timestamptz, text, integer) is
  'D1C-S2B REVIEW-ONLY: pre-lock platform deadline correction with audit. Not post-lock break-glass.';

revoke all on function public.correct_crystal_ball_deadline(uuid, timestamptz, text, integer) from public;
grant execute on function public.correct_crystal_ball_deadline(uuid, timestamptz, text, integer) to authenticated;

-- =============================================================================
-- END 04-rpc-bot-crown-deadline.sql — REVIEW ONLY — NON-PRODUCTION
-- =============================================================================
