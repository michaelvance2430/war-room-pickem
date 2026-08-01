-- ============================================================
-- Trial bots auto Crystal Ball / Super Bowl pride picks
-- Commissioner seeds picks AS bots (RLS blocks client insert for others).
-- Run once in Supabase → SQL Editor → Run
-- ============================================================

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

  if not exists (
    select 1 from public.leagues l
    where l.id = p_league_id and l.commissioner_id = v_uid
  ) then
    return json_build_object('ok', false, 'error', 'Commissioner only');
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

notify pgrst, 'reload schema';
