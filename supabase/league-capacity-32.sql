-- ============================================================
-- Hard league capacity: 32 members (Championship + Toilet Bowl)
-- Run once in Supabase → SQL Editor → Run
-- Enforces at DB so join can't be bypassed.
-- ============================================================

create or replace function public.enforce_league_capacity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count int;
  v_max int := 32;
begin
  -- Count current members; NEW row not inserted yet on BEFORE INSERT
  select count(*)::int into v_count
  from public.memberships
  where league_id = NEW.league_id;

  if v_count >= v_max then
    raise exception
      'League is full (max %). Championship and Toilet Bowl fit 32 players (16 per bracket).',
      v_max
      using errcode = 'check_violation';
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_enforce_league_capacity on public.memberships;
create trigger trg_enforce_league_capacity
  before insert on public.memberships
  for each row
  execute function public.enforce_league_capacity();

-- Trial bots: never fill past 32 total members
create or replace function public.seed_trial_bots(
  p_league_id uuid,
  p_count int default 50
)
returns json
language plpgsql
security definer
set search_path = public, auth, extensions
as $$
declare
  v_uid uuid := auth.uid();
  v_existing_bots int;
  v_total_members int;
  v_seats int;
  v_need int;
  v_added int := 0;
  v_password text;
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
  v_instance uuid;
  v_max int := 32;
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

  select count(*)::int into v_total_members
  from public.memberships
  where league_id = p_league_id;

  select count(*)::int into v_existing_bots
  from public.memberships
  where league_id = p_league_id and is_bot = true;

  v_seats := greatest(0, v_max - v_total_members);
  v_need := greatest(0, least(coalesce(p_count, 50), v_seats));

  if v_need = 0 then
    return json_build_object(
      'ok', true,
      'added', 0,
      'totalBots', v_existing_bots,
      'leagueCap', v_max,
      'seatsRemaining', v_seats
    );
  end if;

  select id into v_instance from auth.instances limit 1;
  if v_instance is null then
    v_instance := '00000000-0000-0000-0000-000000000000'::uuid;
  end if;

  foreach v_name in array v_names
  loop
    exit when v_added >= v_need;

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
    v_password := extensions.crypt(
      gen_random_uuid()::text,
      extensions.gen_salt('bf')
    );

    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, recovery_token,
      email_change_token_new, email_change
    ) values (
      v_instance, v_user_id, 'authenticated', 'authenticated', v_email, v_password,
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('display_name', v_name, 'is_trial_bot', true),
      now(), now(), '', '', '', ''
    );

    begin
      insert into auth.identities (
        id, user_id, identity_data, provider, provider_id,
        last_sign_in_at, created_at, updated_at
      ) values (
        gen_random_uuid(), v_user_id,
        jsonb_build_object('sub', v_user_id::text, 'email', v_email),
        'email', v_user_id::text, now(), now(), now()
      );
    exception when others then
      null;
    end;

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

  select count(*)::int into v_existing_bots
  from public.memberships
  where league_id = p_league_id and is_bot = true;

  return json_build_object(
    'ok', true,
    'added', v_added,
    'totalBots', v_existing_bots,
    'leagueCap', v_max
  );
end;
$$;

grant execute on function public.seed_trial_bots(uuid, int) to authenticated;
