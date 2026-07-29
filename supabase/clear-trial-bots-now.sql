-- ============================================================
-- FORCE REMOVE ALL TRIAL BOTS (run in Supabase → SQL Editor)
-- Keeps real human members. Safe to re-run.
-- ============================================================

-- 1) Hardened clear function (also used by Commissioner button)
create or replace function public.clear_trial_bots(p_league_id uuid)
returns json
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_removed int := 0;
  r record;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if not exists (
    select 1 from public.leagues l
    where l.id = p_league_id and l.commissioner_id = v_uid
  ) then
    raise exception 'Only the commissioner can clear trial bots';
  end if;

  for r in
    select distinct m.user_id
    from public.memberships m
    left join auth.users u on u.id = m.user_id
    left join public.profiles p on p.id = m.user_id
    where m.league_id = p_league_id
      and (
        coalesce(m.is_bot, false) = true
        or coalesce(u.email, '') ilike '%@warroom.trial'
        or coalesce(u.raw_user_meta_data->>'is_trial_bot', '') = 'true'
      )
  loop
    begin
      delete from public.picks
      where league_id = p_league_id and user_id = r.user_id;
    exception when others then null;
    end;

    begin
      delete from public.crystal_ball_picks
      where league_id = p_league_id and user_id = r.user_id;
    exception when others then null;
    end;

    begin
      delete from public.achievements
      where league_id = p_league_id and user_id = r.user_id;
    exception when others then null;
    end;

    -- Always remove from league
    delete from public.memberships
    where league_id = p_league_id and user_id = r.user_id;

    -- Best-effort: wipe bot auth user if they have no other leagues
    if not exists (
      select 1 from public.memberships m2 where m2.user_id = r.user_id
    ) then
      begin
        delete from auth.identities where user_id = r.user_id;
      exception when others then null;
      end;
      begin
        delete from public.profiles where id = r.user_id;
      exception when others then null;
      end;
      begin
        delete from auth.users where id = r.user_id;
      exception when others then null;
      end;
    end if;

    v_removed := v_removed + 1;
  end loop;

  return json_build_object('ok', true, 'removed', v_removed);
end;
$$;

revoke all on function public.clear_trial_bots(uuid) from public;
grant execute on function public.clear_trial_bots(uuid) to authenticated;
grant execute on function public.clear_trial_bots(uuid) to service_role;

-- 2) IMMEDIATE wipe: every trial bot in EVERY league (SQL Editor runs as superuser)
do $$
declare
  r record;
  v_total int := 0;
begin
  for r in
    select m.league_id, m.user_id
    from public.memberships m
    left join auth.users u on u.id = m.user_id
    where coalesce(m.is_bot, false) = true
       or coalesce(u.email, '') ilike '%@warroom.trial'
       or coalesce(u.raw_user_meta_data->>'is_trial_bot', '') = 'true'
  loop
    begin
      delete from public.picks
      where league_id = r.league_id and user_id = r.user_id;
    exception when others then null;
    end;
    begin
      delete from public.crystal_ball_picks
      where league_id = r.league_id and user_id = r.user_id;
    exception when others then null;
    end;
    begin
      delete from public.achievements
      where league_id = r.league_id and user_id = r.user_id;
    exception when others then null;
    end;

    delete from public.memberships
    where league_id = r.league_id and user_id = r.user_id;

    v_total := v_total + 1;
  end loop;

  -- Orphan bot auth users (no memberships left)
  for r in
    select u.id as user_id
    from auth.users u
    where (
      coalesce(u.email, '') ilike '%@warroom.trial'
      or coalesce(u.raw_user_meta_data->>'is_trial_bot', '') = 'true'
    )
    and not exists (
      select 1 from public.memberships m where m.user_id = u.id
    )
  loop
    begin
      delete from auth.identities where user_id = r.user_id;
    exception when others then null;
    end;
    begin
      delete from public.profiles where id = r.user_id;
    exception when others then null;
    end;
    begin
      delete from auth.users where id = r.user_id;
    exception when others then null;
    end;
  end loop;

  raise notice 'Removed % trial bot membership(s). Real players kept.', v_total;
end;
$$;

-- Sanity check: bots left should be 0
select
  count(*) filter (where coalesce(m.is_bot, false)) as bot_memberships,
  count(*) filter (where not coalesce(m.is_bot, false)) as human_memberships
from public.memberships m;
