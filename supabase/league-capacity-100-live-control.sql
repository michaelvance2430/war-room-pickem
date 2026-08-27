-- Raise human league capacity to 100 and let commissioners adjust it at any time.
-- Existing join paths already call d1b_b_max_human_members, so this remains the
-- single server-side source of truth for public, private, and code joins.

alter table public.leagues
  drop constraint if exists leagues_max_human_members_chk;

alter table public.leagues
  add constraint leagues_max_human_members_chk
  check (max_human_members between 2 and 100);

do $migration$
declare
  v_oid oid;
  v_before text;
  v_after text;
begin
  select 'public.create_league_with_commissioner_seat(text,text,boolean,boolean,integer,integer,integer,text)'::regprocedure::oid
    into v_oid;
  v_before := pg_get_functiondef(v_oid);
  v_after := replace(v_before, 'v_max > 64', 'v_max > 100');
  if v_after = v_before then
    raise exception 'capacity migration could not locate create-league limit';
  end if;
  execute v_after;

  select 'public.spin_up_sport_pool_league(uuid)'::regprocedure::oid into v_oid;
  v_before := pg_get_functiondef(v_oid);
  v_after := replace(v_before, 'v_seats > 64', 'v_seats > 100');
  v_after := replace(v_after, 'false, null, greatest(2,v_seats)', 'false, null, 100');
  if v_after = v_before or position('false, null, 100' in v_after) = 0 then
    raise exception 'capacity migration could not locate sport-pool limits';
  end if;
  execute v_after;
end
$migration$;

create or replace function public.set_league_capacity(
  p_league_id uuid,
  p_max_human_members integer
) returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $function$
declare
  v_uid uuid := auth.uid();
  v_human_count integer;
begin
  if v_uid is null then
    raise exception 'capacity:not_authenticated' using errcode = '42501';
  end if;
  if p_league_id is null then
    raise exception 'capacity:league_not_found' using errcode = 'P0002';
  end if;
  if p_max_human_members is null or p_max_human_members < 2 or p_max_human_members > 100 then
    raise exception 'capacity:must_be_between_2_and_100' using errcode = '23514';
  end if;

  perform 1
  from public.leagues l
  where l.id = p_league_id and l.commissioner_id = v_uid
  for update;
  if not found then
    raise exception 'capacity:commissioner_only' using errcode = '42501';
  end if;

  select count(*)::integer into v_human_count
  from public.memberships m
  where m.league_id = p_league_id
    and not coalesce(m.is_bot, false);

  if p_max_human_members < v_human_count then
    raise exception 'capacity:below_current_roster:%', v_human_count using errcode = '23514';
  end if;

  update public.leagues
  set max_human_members = p_max_human_members
  where id = p_league_id;

  return json_build_object(
    'ok', true,
    'max_human_members', p_max_human_members,
    'human_count', v_human_count
  );
end
$function$;

revoke all on function public.set_league_capacity(uuid, integer) from public;
revoke all on function public.set_league_capacity(uuid, integer) from anon;
grant execute on function public.set_league_capacity(uuid, integer) to authenticated;

-- A Run It Back room must remain open for original-roster UUIDs who join later.
update public.leagues l
set max_human_members = 100
where exists (
  select 1 from public.sport_pool_polls p
  where p.created_league_id = l.id
);
