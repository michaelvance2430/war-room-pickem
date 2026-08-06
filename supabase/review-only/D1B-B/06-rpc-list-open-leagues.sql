-- =============================================================================
-- D1B-B / 06-rpc-list-open-leagues.sql
-- REVIEW ONLY — DO NOT APPLY TO LIVE WITHOUT SEPARATE STAGE AUTH
-- =============================================================================
-- B3 safe open-league discovery: NO join codes in result.
-- Stage 13 app cutover target (before tightening leagues SELECT).
-- =============================================================================

create or replace function public.list_open_leagues_public(
  p_sport_id text default null,
  p_limit integer default 40
)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_limit int := least(greatest(coalesce(p_limit, 40), 1), 100);
  v_sport text := nullif(lower(trim(coalesce(p_sport_id, ''))), '');
  v_rows json;
begin
  if v_uid is null then
    perform public.d1b_b_raise('not_authenticated');
  end if;

  if v_sport = 'any' then
    v_sport := null;
  end if;

  select coalesce(json_agg(row_to_json(t) order by t.human_count desc, t.sort_ts), '[]'::json)
  into v_rows
  from (
    select
      l.id,
      l.name,
      l.sport_id,
      -- commissioner_id omitted from public discovery (R5): internal profile UUID
      l.created_at,
      l.open_listed_at,
      public.d1b_b_human_member_count(l.id) as human_count,
      public.d1b_b_max_human_members(l.id) as max_human_members,
      greatest(
        public.d1b_b_max_human_members(l.id) - public.d1b_b_human_member_count(l.id),
        0
      ) as seats_left,
      coalesce(l.open_listed_at, l.created_at) as sort_ts
    from public.leagues l
    where l.is_open is true
      and (v_sport is null or l.sport_id = v_sport)
      and public.d1b_b_human_member_count(l.id) < public.d1b_b_max_human_members(l.id)
    order by public.d1b_b_human_member_count(l.id) desc,
             coalesce(l.open_listed_at, l.created_at)
    limit v_limit
  ) t;

  return json_build_object(
    'ok', true,
    'rooms', v_rows
    -- code intentionally omitted (B3)
    -- commissioner_id intentionally omitted (R5)
  );
end;
$$;

comment on function public.list_open_leagues_public(text, integer) is
  'D1B-B REVIEW-ONLY: open rooms without join codes. Apply only after stage auth.';

revoke all on function public.list_open_leagues_public(text, integer) from public;
revoke all on function public.list_open_leagues_public(text, integer) from anon;
grant execute on function public.list_open_leagues_public(text, integer) to authenticated;

-- END 06 — REVIEW ONLY
