-- ============================================================
-- Sandbox: random trial bots go Chaos (nuclear) for a week
-- Commissioner-only. Safe to re-run.
-- Run once in Supabase SQL Editor (dev first).
-- ============================================================

-- Ensure column exists
alter table public.picks
  add column if not exists is_chaos boolean not null default false;

/**
 * After bots have locked picks for a week, randomly flip some to Chaos Mode.
 * Those picks score 2× when the week is scored (same as human Chaos).
 *
 * p_chance: 0–100 (default 22 ≈ 1 in 5 bots)
 * Returns how many went nuclear + sample names.
 */
create or replace function public.apply_random_bot_chaos(
  p_league_id uuid,
  p_week_number int,
  p_chance int default 22
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_chance int := greatest(0, least(100, coalesce(p_chance, 22)));
  v_bot record;
  v_pick_id uuid;
  v_nuked int := 0;
  v_names text[] := '{}';
  v_name text;
  v_roll int;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if not exists (
    select 1 from public.leagues l
    where l.id = p_league_id and l.commissioner_id = v_uid
  ) then
    raise exception 'Only the commissioner can apply bot chaos';
  end if;

  for v_bot in
    select m.user_id, coalesce(p.display_name, 'Bot') as display_name
    from public.memberships m
    join public.profiles p on p.id = m.user_id
    where m.league_id = p_league_id
      and m.is_bot = true
  loop
    select id into v_pick_id
    from public.picks
    where league_id = p_league_id
      and user_id = v_bot.user_id
      and week_number = p_week_number
      and locked_at is not null
    limit 1;

    if v_pick_id is null then
      continue;
    end if;

    -- Deterministic-ish roll per bot+week so re-runs aren't pure thrash
    v_roll := abs(hashtext(v_bot.user_id::text || ':chaos:' || p_week_number::text)) % 100;
    -- Mix in wall clock so re-fill can change who goes nuclear
    v_roll := (v_roll + (extract(epoch from now())::int % 17)) % 100;

    if v_roll < v_chance then
      update public.picks
      set is_chaos = true
      where id = v_pick_id;

      -- Pure-random sides for true Chaos energy (keep conf / best bet structure)
      update public.pick_games pg
      set side = case
        when (abs(hashtext(pg.id::text || ':side')) % 2) = 0 then 'home'
        else 'away'
      end
      where pg.pick_id = v_pick_id;

      v_nuked := v_nuked + 1;
      v_name := v_bot.display_name;
      if array_length(v_names, 1) is null or array_length(v_names, 1) < 8 then
        v_names := array_append(v_names, v_name);
      end if;
    else
      -- Explicit clear so re-seed without chaos doesn't leave stale flags
      update public.picks
      set is_chaos = false
      where id = v_pick_id
        and is_chaos = true;
    end if;
  end loop;

  return json_build_object(
    'ok', true,
    'chaosCount', v_nuked,
    'chance', v_chance,
    'names', v_names,
    'week', p_week_number
  );
end;
$$;

grant execute on function public.apply_random_bot_chaos(uuid, int, int) to authenticated;
grant execute on function public.apply_random_bot_chaos(uuid, int, int) to service_role;

comment on function public.apply_random_bot_chaos(uuid, int, int) is
  'Sandbox: randomly mark trial-bot locked picks as Chaos (2× scoring) for a week.';
