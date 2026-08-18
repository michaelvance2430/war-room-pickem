-- CFB postseason operations hardening v1
-- Once any member starts an entry (or any winner is recorded), the shared field
-- becomes immutable. This prevents a commissioner revision from silently
-- invalidating saved player work.

create or replace function public.validate_cfb_postseason_slate()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_marquee integer;
  v_sicko integer;
begin
  if tg_op = 'UPDATE' then
    if new.league_id is distinct from old.league_id
      or new.season_key is distinct from old.season_key then
      raise exception 'Postseason slate identity cannot be changed';
    end if;

    if (new.bowl_games is distinct from old.bowl_games
        or new.cfp_seeds is distinct from old.cfp_seeds)
      and (
        exists (
          select 1
          from public.cfb_postseason_entries e
          where e.league_id = old.league_id
            and e.season_key = old.season_key
        )
        or exists (
          select 1
          from public.cfb_postseason_results r
          where r.league_id = old.league_id
            and r.season_key = old.season_key
        )
      ) then
      raise exception 'Postseason slate is frozen after the first player entry or result';
    end if;
  end if;

  if jsonb_array_length(new.bowl_games) <> 25 then
    raise exception 'Postseason slate requires 25 bowls';
  end if;

  select count(*) filter (where game->>'tier' = 'marquee'),
         count(*) filter (where game->>'tier' = 'sicko')
    into v_marquee, v_sicko
  from jsonb_array_elements(new.bowl_games) game;

  if v_marquee <> 15 or v_sicko <> 10 then
    raise exception 'Postseason slate requires 15 Marquee and 10 Sicko bowls';
  end if;

  if exists (
    select 1
    from jsonb_array_elements(new.bowl_games) game
    where coalesce(trim(game->>'id'), '') = ''
      or coalesce(trim(game->>'name'), '') = ''
      or coalesce(trim(game->>'away'), '') = ''
      or coalesce(trim(game->>'home'), '') = ''
      or trim(game->>'away') = trim(game->>'home')
      or coalesce((game->>'rank')::integer, 0) < 1
      or coalesce((game->>'hosts_cfp')::boolean, false)
  ) then
    raise exception 'Every bowl needs an id, name, two different teams, rank, and must not host a CFP game';
  end if;

  if (select count(distinct game->>'id') from jsonb_array_elements(new.bowl_games) game) <> 25 then
    raise exception 'Bowl ids must be unique';
  end if;

  if jsonb_array_length(new.cfp_seeds) <> 12
    or (select count(distinct lower(trim(value#>>'{}'))) from jsonb_array_elements(new.cfp_seeds)) <> 12
    or exists (select 1 from jsonb_array_elements(new.cfp_seeds) seed where trim(seed#>>'{}') = '') then
    raise exception 'CFP field requires 12 unique seeded teams';
  end if;

  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.validate_cfb_postseason_slate() from public, anon, authenticated;
