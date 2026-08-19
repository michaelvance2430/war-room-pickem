-- Authoritative annual CFB bowl/CFP field. This is separate from player entries.
create table if not exists public.cfb_postseason_slates (
  league_id uuid not null references public.leagues(id) on delete cascade,
  season_key integer not null,
  bowl_games jsonb not null check (jsonb_typeof(bowl_games)='array'),
  cfp_seeds jsonb not null check (jsonb_typeof(cfp_seeds)='array'),
  published_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (league_id,season_key)
);

alter table public.cfb_postseason_slates enable row level security;
revoke all on table public.cfb_postseason_slates from public,anon,authenticated;
grant select,insert,update on table public.cfb_postseason_slates to authenticated;

drop policy if exists "Members read published CFB slate" on public.cfb_postseason_slates;
create policy "Members read published CFB slate" on public.cfb_postseason_slates for select to authenticated
using (published_at is not null and public.is_league_member(league_id));

drop policy if exists "Commissioner creates CFB slate" on public.cfb_postseason_slates;
create policy "Commissioner creates CFB slate" on public.cfb_postseason_slates for insert to authenticated
with check (exists(select 1 from public.leagues l where l.id=league_id and l.commissioner_id=(select auth.uid())));

drop policy if exists "Commissioner updates CFB slate" on public.cfb_postseason_slates;
create policy "Commissioner updates CFB slate" on public.cfb_postseason_slates for update to authenticated
using (exists(select 1 from public.leagues l where l.id=league_id and l.commissioner_id=(select auth.uid())))
with check (exists(select 1 from public.leagues l where l.id=league_id and l.commissioner_id=(select auth.uid())));

create or replace function public.validate_cfb_postseason_slate() returns trigger
language plpgsql security invoker set search_path=public,pg_temp as $function$
declare v_marquee integer; v_sicko integer;
begin
  if tg_op='UPDATE' and exists(
    select 1 from public.cfb_postseason_entries e where e.league_id=old.league_id and e.season_key=old.season_key
      and (e.bowl_locked_at is not null or e.cfp_locked_at is not null)
  ) and (new.bowl_games is distinct from old.bowl_games or new.cfp_seeds is distinct from old.cfp_seeds) then
    raise exception 'Postseason slate is frozen after the first player lock';
  end if;
  if jsonb_array_length(new.bowl_games)<>25 then raise exception 'Postseason slate requires 25 bowls'; end if;
  select count(*) filter(where game->>'tier'='marquee'),count(*) filter(where game->>'tier'='sicko')
    into v_marquee,v_sicko from jsonb_array_elements(new.bowl_games) game;
  if v_marquee<>15 or v_sicko<>10 then raise exception 'Postseason slate requires 15 Marquee and 10 Sicko bowls'; end if;
  if exists(select 1 from jsonb_array_elements(new.bowl_games) game where
      coalesce(trim(game->>'id'),'')='' or coalesce(trim(game->>'name'),'')='' or
      coalesce(trim(game->>'away'),'')='' or coalesce(trim(game->>'home'),'')='' or
      coalesce((game->>'rank')::integer,0)<1 or coalesce((game->>'hosts_cfp')::boolean,false)) then
    raise exception 'Every bowl needs an id, name, teams, rank, and must not host a CFP game';
  end if;
  if (select count(distinct game->>'id') from jsonb_array_elements(new.bowl_games) game)<>25 then
    raise exception 'Bowl ids must be unique';
  end if;
  if jsonb_array_length(new.cfp_seeds)<>12 or
     (select count(distinct trim(value#>>'{}')) from jsonb_array_elements(new.cfp_seeds))<>12 or
     exists(select 1 from jsonb_array_elements(new.cfp_seeds) seed where trim(seed#>>'{}')='') then
    raise exception 'CFP field requires 12 unique seeded teams';
  end if;
  new.updated_at=now();
  return new;
end;$function$;

revoke all on function public.validate_cfb_postseason_slate() from public,anon,authenticated;
drop trigger if exists validate_cfb_postseason_slate on public.cfb_postseason_slates;
create trigger validate_cfb_postseason_slate before insert or update on public.cfb_postseason_slates
for each row execute function public.validate_cfb_postseason_slate();

create or replace function public.publish_cfb_postseason_slate(
  p_league_id uuid,p_season_key integer,p_bowl_games jsonb,p_cfp_seeds jsonb
) returns public.cfb_postseason_slates
language plpgsql security invoker set search_path=public,pg_temp as $function$
declare v_slate public.cfb_postseason_slates;
begin
  if not exists(select 1 from public.leagues l where l.id=p_league_id and l.sport_id='cfb' and
    l.commissioner_id=(select auth.uid()) and l.current_week>=l.regular_season_weeks+1) then
    raise exception 'Commissioner postseason authority required';
  end if;
  insert into public.cfb_postseason_slates(league_id,season_key,bowl_games,cfp_seeds,published_at)
  values(p_league_id,p_season_key,p_bowl_games,p_cfp_seeds,now())
  on conflict(league_id,season_key) do update set bowl_games=excluded.bowl_games,cfp_seeds=excluded.cfp_seeds,
    published_at=excluded.published_at,updated_at=now()
  returning * into v_slate;
  return v_slate;
end;$function$;

revoke all on function public.publish_cfb_postseason_slate(uuid,integer,jsonb,jsonb) from public,anon;
grant execute on function public.publish_cfb_postseason_slate(uuid,integer,jsonb,jsonb) to authenticated;
