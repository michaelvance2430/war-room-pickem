-- ============================================================
-- Trial bots: fill league with 50 auto-pick players for dry runs
-- Commissioner only. Clear bots keeps real members.
-- Run once in Supabase → SQL Editor → Run
-- ============================================================

alter table public.memberships
  add column if not exists is_bot boolean not null default false;

create index if not exists memberships_league_bot_idx
  on public.memberships (league_id)
  where is_bot = true;

-- ---------- Seed up to N bots (default 50) ----------
create or replace function public.seed_trial_bots(
  p_league_id uuid,
  p_count int default 50
)
returns json
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_existing int;
  v_need int;
  v_added int := 0;
  v_names text[] := array[
    'DJ Chaos','Couch QB','Line Shopper','Fade Master','Late Lock',
    'Sunday Scaries','Vegas Vic','Confidence King','Dog Walker','Pick Wizard',
    'Spread Sheet','Over Under','Locksmith','Parlay Pete','Unit Manager',
    'Prime Time','Red Zone Ron','Blown Cover','Juice Box','Steam Chaser',
    'Home Cooker','Road Warrior','Weather Guy','Injury Report','Sharp Adjacent',
    'Public Heat','Contrarian Cat','Midweek Mike','Kickoff Kate','Prop Queen',
    'ATS Andy','Moneyline Max','Teaser Tina','Hedge Fund','Live Bet Larry',
    'Closing Line','Opening Line','Bad Beat Bill','Lucky Bounce','No Look Nick',
    'Deep Dive Dana','Rivalry Rex','Division Dom','Prime Rib','Noonball',
    'Late Window','TNF Terror','MNF Machine','Bye Week Bob','Commissioner Bot'
  ];
  v_name text;
  v_email text;
  v_user_id uuid;
  v_div text;
  v_i int := 0;
  v_instance uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if not exists (
    select 1 from public.leagues l
    where l.id = p_league_id and l.commissioner_id = v_uid
  ) then
    raise exception 'Only the commissioner can seed trial bots';
  end if;

  select count(*) into v_existing
  from public.memberships
  where league_id = p_league_id and is_bot = true;

  v_need := greatest(0, least(coalesce(p_count, 50), 50) - v_existing);
  if v_need = 0 then
    return json_build_object('ok', true, 'added', 0, 'totalBots', v_existing);
  end if;

  select id into v_instance from auth.instances limit 1;
  if v_instance is null then
    v_instance := '00000000-0000-0000-0000-000000000000'::uuid;
  end if;

  foreach v_name in array v_names
  loop
    exit when v_added >= v_need;

    -- Skip if this display name already in league (bot or human)
    if exists (
      select 1
      from public.memberships m
      join public.profiles p on p.id = m.user_id
      where m.league_id = p_league_id
        and lower(p.display_name) = lower(v_name)
    ) then
      continue;
    end if;

    v_user_id := gen_random_uuid();
    v_email := 'bot+' || replace(v_user_id::text, '-', '') || '@warroom.trial';
    v_div := (array['North','South','East','West'])[1 + (v_added % 4)];

    insert into auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    ) values (
      v_instance,
      v_user_id,
      'authenticated',
      'authenticated',
      v_email,
      crypt(gen_random_uuid()::text, gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('display_name', v_name, 'is_trial_bot', true),
      now(),
      now(),
      '',
      '',
      '',
      ''
    );

    -- identities required on newer Supabase
    begin
      insert into auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
      ) values (
        gen_random_uuid(),
        v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', v_email),
        'email',
        v_user_id::text,
        now(),
        now(),
        now()
      );
    exception when others then
      -- older schemas may differ; user row is enough with profile trigger
      null;
    end;

    -- Ensure profile (trigger may already insert)
    insert into public.profiles (id, display_name)
    values (v_user_id, v_name)
    on conflict (id) do update set display_name = excluded.display_name;

    insert into public.memberships (
      league_id, user_id, role, division, is_bot
    ) values (
      p_league_id, v_user_id, 'player', v_div::public.division, true
    );

    v_added := v_added + 1;
  end loop;

  select count(*) into v_existing
  from public.memberships
  where league_id = p_league_id and is_bot = true;

  return json_build_object(
    'ok', true,
    'added', v_added,
    'totalBots', v_existing
  );
end;
$$;

-- ---------- Clear trial bots only (keep real people) ----------
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
    select m.user_id
    from public.memberships m
    where m.league_id = p_league_id and m.is_bot = true
  loop
    -- League-scoped data for this bot
    delete from public.picks
    where league_id = p_league_id and user_id = r.user_id;

    delete from public.crystal_ball_picks
    where league_id = p_league_id and user_id = r.user_id;

    delete from public.achievements
    where league_id = p_league_id and user_id = r.user_id;

    delete from public.memberships
    where league_id = p_league_id and user_id = r.user_id and is_bot = true;

    -- If bot has no other memberships, remove auth user (cascades profile)
    if not exists (
      select 1 from public.memberships m2 where m2.user_id = r.user_id
    ) then
      delete from auth.identities where user_id = r.user_id;
      delete from public.profiles where id = r.user_id;
      delete from auth.users where id = r.user_id;
    end if;

    v_removed := v_removed + 1;
  end loop;

  return json_build_object('ok', true, 'removed', v_removed);
end;
$$;

-- ---------- Auto-generate valid pick slips for all bots for a week ----------
create or replace function public.seed_bot_picks_for_week(
  p_league_id uuid,
  p_week_number int
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_card_id uuid;
  v_prop_a text;
  v_prop_b text;
  v_bot record;
  v_game_ids uuid[];
  v_n int;
  v_pick_id uuid;
  v_i int;
  v_seed int;
  v_side text;
  v_best uuid;
  v_prop text;
  v_filled int := 0;
  v_confs int[];
  v_j int;
  v_tmp int;
  v_spread numeric;
  v_fav text;
begin
  if v_uid is null then
    raise exception 'Not authenticated';
  end if;
  if not exists (
    select 1 from public.leagues l
    where l.id = p_league_id and l.commissioner_id = v_uid
  ) then
    raise exception 'Only the commissioner can seed bot picks';
  end if;

  select id, prop_option_a, prop_option_b
  into v_card_id, v_prop_a, v_prop_b
  from public.week_cards
  where league_id = p_league_id and week_number = p_week_number;

  if v_card_id is null then
    return json_build_object('ok', false, 'error', 'No published card for this week');
  end if;

  select array_agg(id order by sort_order)
  into v_game_ids
  from public.card_games
  where week_card_id = v_card_id;

  if v_game_ids is null or coalesce(array_length(v_game_ids, 1), 0) = 0 then
    return json_build_object('ok', false, 'error', 'Card has no games');
  end if;

  v_n := array_length(v_game_ids, 1);

  for v_bot in
    select m.user_id, p.display_name
    from public.memberships m
    join public.profiles p on p.id = m.user_id
    where m.league_id = p_league_id and m.is_bot = true
  loop
    -- Deterministic-ish seed from bot id + week
    v_seed := abs(hashtext(v_bot.user_id::text || ':' || p_week_number::text));

    -- Shuffle confidences 1..n (Fisher-Yates with seed)
    v_confs := array(select generate_series(1, v_n));
    for v_i in reverse v_n .. 2 loop
      v_j := 1 + ((v_seed + v_i * 17) % v_i);
      v_tmp := v_confs[v_i];
      v_confs[v_i] := v_confs[v_j];
      v_confs[v_j] := v_tmp;
      v_seed := v_seed + 31;
    end loop;

    -- Best bet = highest confidence game often
    v_best := v_game_ids[1];
    for v_i in 1 .. v_n loop
      if v_confs[v_i] = v_n then
        v_best := v_game_ids[v_i];
      end if;
    end loop;

    -- Prop
    if (v_seed % 2) = 0 then
      v_prop := coalesce(nullif(trim(v_prop_a), ''), 'Yes');
    else
      v_prop := coalesce(nullif(trim(v_prop_b), ''), 'No');
    end if;

    -- Upsert pick header
    delete from public.picks
    where league_id = p_league_id
      and user_id = v_bot.user_id
      and week_number = p_week_number;

    insert into public.picks (
      league_id, user_id, week_number, prop_choice, best_bet_game_id, locked_at
    ) values (
      p_league_id, v_bot.user_id, p_week_number, v_prop, v_best, now()
    )
    returning id into v_pick_id;

    for v_i in 1 .. v_n loop
      v_side := case when ((v_seed + v_i * 13) % 2) = 0 then 'home' else 'away' end;
      if lower(v_bot.display_name) like '%dog%' or lower(v_bot.display_name) like '%fade%' then
        v_side := case when ((v_seed + v_i) % 5) < 3 then 'away' else 'home' end;
      end if;

      select spread, favorite into v_spread, v_fav
      from public.card_games where id = v_game_ids[v_i];

      insert into public.pick_games (
        pick_id, card_game_id, side, confidence, is_best_bet,
        locked_spread, locked_favorite
      ) values (
        v_pick_id,
        v_game_ids[v_i],
        v_side,
        v_confs[v_i],
        v_game_ids[v_i] = v_best,
        coalesce(v_spread, 0),
        coalesce(v_fav, 'home')
      );
    end loop;

    v_filled := v_filled + 1;
  end loop;

  return json_build_object('ok', true, 'botsFilled', v_filled, 'week', p_week_number);
end;
$$;

grant execute on function public.seed_trial_bots(uuid, int) to authenticated;
grant execute on function public.clear_trial_bots(uuid) to authenticated;
grant execute on function public.seed_bot_picks_for_week(uuid, int) to authenticated;

-- ---------- Roster that always includes bots (bypasses embed/RLS quirks) ----------
create or replace function public.get_league_roster(p_league_id uuid)
returns table (
  membership_id uuid,
  user_id uuid,
  display_name text,
  division public.division,
  role public.member_role,
  total_points int,
  avatar_url text,
  is_bot boolean
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  if not exists (
    select 1 from public.memberships m
    where m.league_id = p_league_id and m.user_id = auth.uid()
  ) then
    raise exception 'Not a member of this league';
  end if;

  return query
  select
    m.id,
    m.user_id,
    coalesce(p.display_name, 'Player')::text,
    m.division,
    m.role,
    coalesce(m.total_points, 0),
    p.avatar_url::text,
    coalesce(m.is_bot, false)
  from public.memberships m
  left join public.profiles p on p.id = m.user_id
  where m.league_id = p_league_id
  order by coalesce(m.is_bot, false), p.display_name nulls last;
end;
$$;

grant execute on function public.get_league_roster(uuid) to authenticated;

notify pgrst, 'reload schema';
