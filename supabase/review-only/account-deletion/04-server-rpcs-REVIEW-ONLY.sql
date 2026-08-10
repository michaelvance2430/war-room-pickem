-- Server-only account deletion transaction boundaries.
-- REVIEW ONLY. These RPCs are callable by service_role only.

create or replace function private.redact_jsonb_text(
  p_value jsonb,
  p_needle text
)
returns jsonb
language plpgsql
immutable
security invoker
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if p_value is null or nullif(p_needle, '') is null then return p_value; end if;
  case jsonb_typeof(p_value)
    when 'object' then
      select jsonb_object_agg(e.key, private.redact_jsonb_text(e.value, p_needle))
      into v_result from jsonb_each(p_value) e;
      return coalesce(v_result, '{}'::jsonb);
    when 'array' then
      select jsonb_agg(private.redact_jsonb_text(e.value, p_needle) order by e.ordinality)
      into v_result from jsonb_array_elements(p_value) with ordinality e(value, ordinality);
      return coalesce(v_result, '[]'::jsonb);
    when 'string' then
      return to_jsonb(replace(p_value #>> '{}', p_needle, '[REDACTED]'));
    else
      return p_value;
  end case;
end;
$$;

revoke all on function private.redact_jsonb_text(jsonb, text)
  from public, anon, authenticated;
grant execute on function private.redact_jsonb_text(jsonb, text)
  to service_role;

create or replace function public.begin_account_deletion(
  p_user_id uuid,
  p_operation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing private.account_deletion_operations%rowtype;
  v_owned_rooms integer;
begin
  if p_user_id is null or p_operation_id is null then
    raise exception 'User and operation ids are required';
  end if;

  perform 1 from public.profiles where id = p_user_id for update;
  if not found then raise exception 'Profile not found'; end if;

  select * into v_existing
  from private.account_deletion_operations
  where target_user_id = p_user_id
    and status not in ('complete', 'failed')
  order by requested_at desc
  limit 1;

  if v_existing.id is not null then p_operation_id := v_existing.id; end if;

  select count(*)::integer into v_owned_rooms
  from public.leagues where commissioner_id = p_user_id;

  insert into private.account_deletion_operations (
    id, target_user_id, requested_by, status
  ) values (
    p_operation_id, p_user_id, p_user_id,
    case when v_owned_rooms > 0 then 'blocked_commissioner' else 'revoking_sessions' end
  )
  on conflict (id) do update set
    status = excluded.status,
    updated_at = now();

  if v_owned_rooms > 0 then
    return jsonb_build_object(
      'ok', false,
      'blocked', 'commissioner',
      'ownedRooms', v_owned_rooms,
      'operationId', p_operation_id
    );
  end if;

  update public.profiles
  set account_state = 'deletion_in_progress'
  where id = p_user_id and account_state <> 'deleted';

  return jsonb_build_object(
    'ok', true,
    'stage', 'revoking_sessions',
    'operationId', p_operation_id
  );
end;
$$;

revoke all on function public.begin_account_deletion(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.begin_account_deletion(uuid, uuid)
  to service_role;

create or replace function public.redact_account_data(
  p_user_id uuid,
  p_operation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
  v_state text;
  v_operation_status text;
begin
  select status into v_operation_status
  from private.account_deletion_operations
  where id = p_operation_id and target_user_id = p_user_id
  for update;
  if v_operation_status is null then raise exception 'Deletion operation not found'; end if;
  if v_operation_status = 'complete' then
    return jsonb_build_object('ok', true, 'stage', 'complete', 'operationId', p_operation_id);
  end if;

  select display_name, account_state into v_name, v_state
  from public.profiles where id = p_user_id for update;
  if v_state is null then raise exception 'Profile not found'; end if;
  if exists (select 1 from public.leagues where commissioner_id = p_user_id) then
    update private.account_deletion_operations
      set status = 'blocked_commissioner', updated_at = now()
      where id = p_operation_id;
    raise exception 'Pass the Keys before deleting this account';
  end if;

  update private.account_deletion_operations
  set status = 'deleting_private_data',
      attempt_count = attempt_count + 1,
      started_at = coalesce(started_at, now()),
      updated_at = now(),
      error_code = null
  where id = p_operation_id;

  -- Private/noncompetitive rows.
  if to_regclass('public.locker_message_reactions') is not null then
    execute 'delete from public.locker_message_reactions where user_id = $1' using p_user_id;
  end if;
  if to_regclass('public.locker_messages') is not null then
    execute 'delete from public.locker_messages where user_id = $1' using p_user_id;
  end if;
  if to_regclass('public.announcement_reads') is not null then
    execute 'delete from public.announcement_reads where user_id = $1' using p_user_id;
  end if;
  if to_regclass('public.profile_favorite_teams') is not null then
    execute 'delete from public.profile_favorite_teams where user_id = $1' using p_user_id;
  end if;

  update private.account_deletion_operations
  set status = 'redacting_history', updated_at = now()
  where id = p_operation_id;

  -- Denormalized identity attached to preserved history.
  update public.memberships
    set display_name_override = null
    where user_id = p_user_id;
  if to_regclass('public.league_trophies') is not null then
    execute 'update public.league_trophies set winner_name = ''[REDACTED]'' where winner_user_id = $1' using p_user_id;
  end if;
  if to_regclass('public.egg_milestone_flexes') is not null then
    execute 'update public.egg_milestone_flexes set finder_name = ''[REDACTED]'' where finder_user_id = $1' using p_user_id;
  end if;
  if to_regclass('public.museum_allegiance_snapshots') is not null then
    execute 'update public.museum_allegiance_snapshots set display_name_snapshot = ''[REDACTED]'' where user_id = $1' using p_user_id;
  end if;
  if to_regclass('public.museum_event_participants') is not null then
    execute 'update public.museum_event_participants set display_name_snapshot = ''[REDACTED]'' where user_id = $1' using p_user_id;
  end if;
  if to_regclass('public.museum_events') is not null then
    execute 'update public.museum_events set fact_payload = private.redact_jsonb_text(fact_payload, $1) where fact_payload::text like ''%'' || $1 || ''%''' using v_name;
  end if;
  if to_regclass('public.gazette_editions') is not null then
    execute 'update public.gazette_editions set payload = private.redact_jsonb_text(payload, $1) where payload::text like ''%'' || $1 || ''%''' using v_name;
  end if;
  if to_regclass('public.platform_odds_api_usage') is not null then
    execute 'update public.platform_odds_api_usage set user_id = null where user_id = $1' using p_user_id;
  end if;
  if to_regclass('public.platform_status') is not null then
    execute 'update public.platform_status set updated_by = null where updated_by = $1' using p_user_id;
  end if;

  update public.leagues
  set open_room_nudge_left_name = null,
      open_room_nudge_pending = false,
      open_room_nudge_at = null
  where open_room_nudge_left_name = v_name;

  update public.profiles
  set display_name = '[REDACTED]',
      avatar_url = null,
      equipped_border_id = null,
      equipped_title_id = null,
      last_seen_at = null,
      birthday_mmdd = null,
      birthday_locked_at = null,
      account_state = 'deleted',
      deleted_at = coalesce(deleted_at, now())
  where id = p_user_id;

  update private.account_deletion_operations
  set status = 'deleting_auth_user', updated_at = now()
  where id = p_operation_id;

  return jsonb_build_object(
    'ok', true,
    'stage', 'deleting_auth_user',
    'operationId', p_operation_id
  );
exception when others then
  update private.account_deletion_operations
  set status = 'failed', error_code = sqlstate, updated_at = now()
  where id = p_operation_id;
  return jsonb_build_object(
    'ok', false,
    'stage', 'failed',
    'errorCode', sqlstate,
    'operationId', p_operation_id
  );
end;
$$;

revoke all on function public.redact_account_data(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.redact_account_data(uuid, uuid)
  to service_role;

create or replace function public.complete_account_deletion(
  p_user_id uuid,
  p_operation_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  update private.account_deletion_operations
  set status = 'complete', completed_at = coalesce(completed_at, now()),
      updated_at = now(), error_code = null
  where id = p_operation_id and target_user_id = p_user_id;
  if not found then raise exception 'Deletion operation not found'; end if;
  return jsonb_build_object('ok', true, 'stage', 'complete', 'operationId', p_operation_id);
end;
$$;

revoke all on function public.complete_account_deletion(uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.complete_account_deletion(uuid, uuid)
  to service_role;

create or replace function public.fail_account_deletion(
  p_user_id uuid,
  p_operation_id uuid,
  p_error_code text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  update private.account_deletion_operations
  set status = 'failed',
      error_code = left(coalesce(nullif(p_error_code, ''), 'unknown'), 120),
      updated_at = now()
  where id = p_operation_id and target_user_id = p_user_id
    and status <> 'complete';
  if not found then raise exception 'Deletion operation not found'; end if;
  return jsonb_build_object('ok', true, 'stage', 'failed', 'operationId', p_operation_id);
end;
$$;

revoke all on function public.fail_account_deletion(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function public.fail_account_deletion(uuid, uuid, text)
  to service_role;
