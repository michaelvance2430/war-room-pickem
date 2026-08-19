-- Native CFB postseason ledger. Weekly picks remain unchanged.
create table if not exists public.cfb_postseason_entries (
  league_id uuid not null references public.leagues(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  season_key integer not null,
  bowl_picks jsonb not null default '{}'::jsonb check (jsonb_typeof(bowl_picks)='object'),
  bowl_allocations jsonb not null default '{}'::jsonb check (jsonb_typeof(bowl_allocations)='object'),
  dead_hand boolean not null default false,
  bowl_locked_at timestamptz,
  cfp_picks jsonb not null default '{}'::jsonb check (jsonb_typeof(cfp_picks)='object'),
  cfp_locked_at timestamptz,
  bowl_score integer,
  cfp_score integer,
  updated_at timestamptz not null default now(),
  primary key (league_id,user_id,season_key)
);

alter table public.cfb_postseason_entries enable row level security;
revoke all on table public.cfb_postseason_entries from public,anon;
revoke all on table public.cfb_postseason_entries from authenticated;
grant select on table public.cfb_postseason_entries to authenticated;
grant insert (league_id,user_id,season_key,bowl_picks,bowl_allocations,dead_hand,bowl_locked_at,cfp_picks,cfp_locked_at,updated_at)
on public.cfb_postseason_entries to authenticated;
grant update (bowl_picks,bowl_allocations,dead_hand,bowl_locked_at,cfp_picks,cfp_locked_at,updated_at)
on public.cfb_postseason_entries to authenticated;

drop policy if exists "Members read CFB postseason" on public.cfb_postseason_entries;
create policy "Members read CFB postseason" on public.cfb_postseason_entries for select to authenticated
using ((select auth.uid())=user_id and public.is_league_member(league_id));

drop policy if exists "Players create own CFB postseason" on public.cfb_postseason_entries;
create policy "Players create own CFB postseason" on public.cfb_postseason_entries for insert to authenticated
with check ((select auth.uid())=user_id and public.is_league_member(league_id));

create or replace function public.validate_cfb_postseason_entry() returns trigger
language plpgsql security invoker set search_path=public,pg_temp as $function$
declare v_count integer; v_total integer;
begin
  if tg_op='UPDATE' and old.bowl_locked_at is not null and
     (new.bowl_picks is distinct from old.bowl_picks or new.bowl_allocations is distinct from old.bowl_allocations or
      new.dead_hand is distinct from old.dead_hand or new.bowl_locked_at is distinct from old.bowl_locked_at) then
    raise exception 'Bowl Board is already locked';
  end if;
  if tg_op='UPDATE' and old.cfp_locked_at is not null and
     (new.cfp_picks is distinct from old.cfp_picks or new.cfp_locked_at is distinct from old.cfp_locked_at) then
    raise exception 'CFP bracket is already locked';
  end if;
  if new.bowl_locked_at is not null then
    if not exists(select 1 from public.leagues where id=new.league_id and sport_id='cfb' and current_week>=regular_season_weeks+2) then
      raise exception 'Bowl Mania is sealed';
    end if;
    select count(*),coalesce(sum(value::integer),0) into v_count,v_total from jsonb_each_text(new.bowl_allocations);
    if v_count<>25 or v_total<>100 or exists(select 1 from jsonb_each_text(new.bowl_allocations) where value::integer<1) or
       (select count(*) from jsonb_object_keys(new.bowl_picks))<>25 or
       (select array_agg(key order by key) from jsonb_each(new.bowl_picks)) is distinct from
       (select array_agg(key order by key) from jsonb_each(new.bowl_allocations)) then
      raise exception 'Bowl Board requires 25 picks and positive allocations totaling 100';
    end if;
  end if;
  if new.cfp_locked_at is not null and (select count(*) from jsonb_object_keys(new.cfp_picks))<>11 then
    raise exception 'CFP bracket requires 11 picks';
  end if;
  if new.cfp_locked_at is not null and not exists(
    select 1 from public.leagues where id=new.league_id and sport_id='cfb' and current_week>=regular_season_weeks+2
  ) then raise exception 'CFP is sealed'; end if;
  new.updated_at=now();
  return new;
end;$function$;

revoke all on function public.validate_cfb_postseason_entry() from public,anon,authenticated;
drop trigger if exists validate_cfb_postseason_entry on public.cfb_postseason_entries;
create trigger validate_cfb_postseason_entry before insert or update on public.cfb_postseason_entries
for each row execute function public.validate_cfb_postseason_entry();

drop policy if exists "Players update own unlocked CFB postseason" on public.cfb_postseason_entries;
create policy "Players update own unlocked CFB postseason" on public.cfb_postseason_entries for update to authenticated
using ((select auth.uid())=user_id and public.is_league_member(league_id))
with check ((select auth.uid())=user_id and public.is_league_member(league_id));

create or replace function public.save_cfb_bowl_board(
  p_league_id uuid,p_season_key integer,p_picks jsonb,p_allocations jsonb,p_dead_hand boolean default false
) returns public.cfb_postseason_entries
language plpgsql security invoker set search_path=public,pg_temp as $function$
declare v_uid uuid:=(select auth.uid()); v_entry public.cfb_postseason_entries; v_count integer; v_total integer;
begin
  if v_uid is null or not public.is_league_member(p_league_id) then raise exception 'League membership required'; end if;
  if not exists(select 1 from public.leagues where id=p_league_id and sport_id='cfb' and current_week>=regular_season_weeks+2) then
    raise exception 'Bowl Mania is sealed';
  end if;
  if jsonb_typeof(p_picks)<>'object' or jsonb_typeof(p_allocations)<>'object' then raise exception 'Invalid Bowl Board'; end if;
  select count(*),coalesce(sum(value::integer),0) into v_count,v_total from jsonb_each_text(p_allocations);
  if v_count<>25 or v_total<>100 or exists(select 1 from jsonb_each_text(p_allocations) where value::integer<1) then
    raise exception 'Bowl Board requires 25 positive allocations totaling 100';
  end if;
  if (select count(*) from jsonb_object_keys(p_picks))<>25 or
     (select array_agg(key order by key) from jsonb_each(p_picks)) is distinct from
     (select array_agg(key order by key) from jsonb_each(p_allocations)) then raise exception 'Every bowl needs one pick and allocation'; end if;
  insert into public.cfb_postseason_entries(league_id,user_id,season_key,bowl_picks,bowl_allocations,dead_hand,bowl_locked_at)
  values(p_league_id,v_uid,p_season_key,p_picks,p_allocations,p_dead_hand,now())
  on conflict(league_id,user_id,season_key) do update set
    bowl_picks=excluded.bowl_picks,bowl_allocations=excluded.bowl_allocations,dead_hand=excluded.dead_hand,
    bowl_locked_at=excluded.bowl_locked_at,updated_at=now()
  where public.cfb_postseason_entries.bowl_locked_at is null
  returning * into v_entry;
  if not found then raise exception 'Bowl Board is already locked'; end if;
  return v_entry;
end;$function$;

revoke all on function public.save_cfb_bowl_board(uuid,integer,jsonb,jsonb,boolean) from public,anon;
grant execute on function public.save_cfb_bowl_board(uuid,integer,jsonb,jsonb,boolean) to authenticated;

create or replace function public.save_cfb_playoff_bracket(
  p_league_id uuid,p_season_key integer,p_picks jsonb
) returns public.cfb_postseason_entries
language plpgsql security invoker set search_path=public,pg_temp as $function$
declare v_uid uuid:=(select auth.uid()); v_entry public.cfb_postseason_entries;
begin
  if v_uid is null or not public.is_league_member(p_league_id) then raise exception 'League membership required'; end if;
  if not exists(select 1 from public.leagues where id=p_league_id and sport_id='cfb' and current_week>=regular_season_weeks+2) then raise exception 'CFP is sealed'; end if;
  if jsonb_typeof(p_picks)<>'object' or (select count(*) from jsonb_object_keys(p_picks))<>11 then raise exception 'CFP bracket requires 11 picks'; end if;
  insert into public.cfb_postseason_entries(league_id,user_id,season_key,cfp_picks,cfp_locked_at)
  values(p_league_id,v_uid,p_season_key,p_picks,now())
  on conflict(league_id,user_id,season_key) do update set cfp_picks=excluded.cfp_picks,cfp_locked_at=excluded.cfp_locked_at,updated_at=now()
  where public.cfb_postseason_entries.cfp_locked_at is null
  returning * into v_entry;
  if not found then raise exception 'CFP bracket is already locked'; end if;
  return v_entry;
end;$function$;

revoke all on function public.save_cfb_playoff_bracket(uuid,integer,jsonb) from public,anon;
grant execute on function public.save_cfb_playoff_bracket(uuid,integer,jsonb) to authenticated;
