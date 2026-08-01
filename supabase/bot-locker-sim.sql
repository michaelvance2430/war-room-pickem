-- ============================================================
-- Bot locker shit-talk (pre-season / sandbox demos)
-- Commissioner seeds posts AS trial bots so Locker badges/unseen work.
-- Run once in Supabase → SQL Editor → Run
-- ============================================================

create or replace function public.seed_bot_locker_talk(
  p_league_id uuid,
  p_posts jsonb
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
  v_body text;
  v_mins int;
  v_created timestamptz;
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

  if p_posts is null or jsonb_typeof(p_posts) <> 'array' then
    return json_build_object('ok', false, 'error', 'p_posts must be a JSON array');
  end if;

  for v_item in select * from jsonb_array_elements(p_posts)
  loop
    begin
      v_bot := (v_item->>'user_id')::uuid;
    exception when others then
      v_skipped := v_skipped + 1;
      continue;
    end;

    v_body := trim(coalesce(v_item->>'body', ''));
    if v_body = '' or char_length(v_body) > 280 then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    -- Only post as trial bots in this league
    if not exists (
      select 1 from public.memberships m
      where m.league_id = p_league_id
        and m.user_id = v_bot
        and m.is_bot = true
    ) then
      v_skipped := v_skipped + 1;
      continue;
    end if;

    v_mins := greatest(0, least(10000, coalesce((v_item->>'minutes_ago')::int, 0)));
    v_created := now() - (v_mins || ' minutes')::interval;

    insert into public.locker_messages (league_id, user_id, body, created_at)
    values (p_league_id, v_bot, v_body, v_created);

    v_inserted := v_inserted + 1;
  end loop;

  return json_build_object(
    'ok', true,
    'inserted', v_inserted,
    'skipped', v_skipped
  );
end;
$$;

revoke all on function public.seed_bot_locker_talk(uuid, jsonb) from public;
grant execute on function public.seed_bot_locker_talk(uuid, jsonb) to authenticated;

notify pgrst, 'reload schema';
