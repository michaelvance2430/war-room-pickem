-- ============================================================
-- Smarter bot pick slips (optional re-run after trial-bots.sql)
-- Bots lean by persona; favorites slightly preferred by default.
-- Commissioner-only. Safe to re-run.
-- ============================================================

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
  v_name text;
  v_persona text;
  v_roll int;
  v_dog_side text;
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
    v_seed := abs(hashtext(v_bot.user_id::text || ':' || p_week_number::text));
    v_name := lower(coalesce(v_bot.display_name, ''));

    -- Persona from display name (stable archetypes)
    if v_name ~ '(dog|fade|contrarian|underdog)' then
      v_persona := 'dog';
    elsif v_name ~ '(public|locksmith|home cook|prime rib|chalk)' then
      v_persona := 'chalk';
    elsif v_name ~ '(sharp|closing|line shop|steam)' then
      v_persona := 'sharp';
    elsif v_name ~ '(weather|injury|road)' then
      v_persona := 'situational';
    else
      v_persona := 'mixed';
    end if;

    -- Confidence 1..n shuffled (deterministic)
    v_confs := array(select generate_series(1, v_n));
    for v_i in reverse v_n .. 2 loop
      v_j := 1 + ((v_seed + v_i * 17) % v_i);
      v_tmp := v_confs[v_i];
      v_confs[v_i] := v_confs[v_j];
      v_confs[v_j] := v_tmp;
      v_seed := v_seed + 31;
    end loop;

    v_best := v_game_ids[1];
    for v_i in 1 .. v_n loop
      if v_confs[v_i] = v_n then
        v_best := v_game_ids[v_i];
      end if;
    end loop;

    if (v_seed % 2) = 0 then
      v_prop := coalesce(nullif(trim(v_prop_a), ''), 'Yes');
    else
      v_prop := coalesce(nullif(trim(v_prop_b), ''), 'No');
    end if;

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
      select spread, favorite into v_spread, v_fav
      from public.card_games where id = v_game_ids[v_i];

      v_fav := coalesce(nullif(lower(v_fav), ''), 'home');
      if v_fav not in ('home', 'away') then
        v_fav := 'home';
      end if;
      v_dog_side := case when v_fav = 'home' then 'away' else 'home' end;

      v_roll := abs(v_seed + v_i * 41 + hashtext(v_persona)) % 100;

      -- Side guidance by persona
      if v_persona = 'dog' then
        -- ~65% underdog
        v_side := case when v_roll < 65 then v_dog_side else v_fav end;
      elsif v_persona = 'chalk' then
        -- ~70% favorite
        v_side := case when v_roll < 70 then v_fav else v_dog_side end;
      elsif v_persona = 'sharp' then
        -- slight dog lean on big numbers, else mixed
        if coalesce(v_spread, 0) >= 10 and v_roll < 55 then
          v_side := v_dog_side;
        elsif v_roll < 52 then
          v_side := v_fav;
        else
          v_side := v_dog_side;
        end if;
      elsif v_persona = 'situational' then
        -- prefer road dogs a bit, else 50/50-ish
        if v_dog_side = 'away' and v_roll < 58 then
          v_side := 'away';
        elsif v_roll < 50 then
          v_side := v_fav;
        else
          v_side := v_dog_side;
        end if;
      else
        -- mixed public: ~58% favorite
        v_side := case when v_roll < 58 then v_fav else v_dog_side end;
      end if;

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

grant execute on function public.seed_bot_picks_for_week(uuid, int) to authenticated;
