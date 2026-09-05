-- Build 21 review only: official-season qualification and demo-room guard.
-- No production database has been changed by this file.
--
-- A human is active when they lock at least 75 percent of the regular-season
-- cards published after their eligibility boundary, rounded up, with a hard
-- minimum of four locked cards. Eight active humans make a season official.

begin;

create table if not exists public.league_competitive_seasons (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  season_key integer not null,
  sport_id text not null,
  status text not null check (status in ('official','demo')),
  active_human_count integer not null check (active_human_count >= 0),
  total_human_count integer not null check (total_human_count >= 0),
  minimum_active_players integer not null default 8 check (minimum_active_players = 8),
  required_participation_percent integer not null default 75 check (required_participation_percent = 75),
  minimum_locked_cards integer not null default 4 check (minimum_locked_cards = 4),
  qualification jsonb not null default '[]'::jsonb,
  certified_at timestamptz not null default now(),
  unique (league_id, season_key, sport_id)
);

alter table public.league_competitive_seasons enable row level security;

drop policy if exists "Members read competitive season status" on public.league_competitive_seasons;
create policy "Members read competitive season status"
  on public.league_competitive_seasons for select to authenticated
  using (exists (
    select 1 from public.memberships m
    where m.league_id = league_competitive_seasons.league_id
      and m.user_id = (select auth.uid())
  ));

-- New public tables are not guaranteed to be exposed to the Data API. The
-- explicit grant is intentional; RLS still limits rows to room members.
grant select on public.league_competitive_seasons to authenticated;
revoke all on public.league_competitive_seasons from anon;

create or replace function private.compute_league_competitive_status(p_league_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  with room as (
    select l.id, coalesce(l.sport_id,'cfb') as sport_id, l.regular_season_weeks
    from public.leagues l
    where l.id = p_league_id
  ), humans as (
    select m.user_id, greatest(0,coalesce(m.eligible_from_week,0)) as eligible_from_week
    from public.memberships m
    join room r on r.id = m.league_id
    where coalesce(m.is_bot,false) = false
  ), activity as (
    select h.user_id,
      count(wc.id)::integer as eligible_cards,
      count(p.id) filter (where p.locked_at is not null)::integer as locked_cards
    from humans h
    cross join room r
    left join public.week_cards wc
      on wc.league_id = r.id
     and wc.week_number >= h.eligible_from_week
     and wc.week_number <= r.regular_season_weeks
     and exists (
       select 1 from public.week_results wr
       where wr.league_id = wc.league_id and wr.week_number = wc.week_number
     )
    left join public.picks p
      on p.league_id = r.id
     and p.user_id = h.user_id
     and p.week_number = wc.week_number
    group by h.user_id
  ), evaluated as (
    select a.*,
      case when a.eligible_cards > 0 then ((a.eligible_cards * 3 + 3) / 4)::integer else 0 end as required_locked_cards,
      (
        a.locked_cards >= 4
        and a.locked_cards >= case when a.eligible_cards > 0 then ((a.eligible_cards * 3 + 3) / 4)::integer else 0 end
      ) as qualifies
    from activity a
  ), totals as (
    select
      (select count(*)::integer from humans) as total_humans,
      count(*) filter (where qualifies)::integer as active_humans,
      coalesce(jsonb_agg(jsonb_build_object(
        'userId',user_id,
        'eligibleCards',eligible_cards,
        'lockedCards',locked_cards,
        'requiredLockedCards',required_locked_cards,
        'qualifies',qualifies
      ) order by user_id),'[]'::jsonb) as qualification
    from evaluated
  )
  select jsonb_build_object(
    'leagueId',p_league_id,
    'sportId',(select sport_id from room),
    'status',case when coalesce(active_humans,0) >= 8 then 'official' else 'demo' end,
    'official',coalesce(active_humans,0) >= 8,
    'activeHumanCount',coalesce(active_humans,0),
    'totalHumanCount',coalesce(total_humans,0),
    'minimumActivePlayers',8,
    'requiredParticipationPercent',75,
    'minimumLockedCards',4,
    'qualification',qualification
  )
  from totals;
$$;

revoke all on function private.compute_league_competitive_status(uuid) from public,anon,authenticated;

create or replace function public.league_competitive_status(p_league_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  if not exists (
    select 1 from public.memberships m
    where m.league_id = p_league_id and m.user_id = (select auth.uid())
  ) then raise exception 'League membership required'; end if;
  return private.compute_league_competitive_status(p_league_id);
end;
$$;

revoke all on function public.league_competitive_status(uuid) from public,anon;
grant execute on function public.league_competitive_status(uuid) to authenticated;

create or replace function private.certify_league_competitive_season(
  p_league_id uuid,
  p_season_key integer,
  p_sport_id text
) returns public.league_competitive_seasons
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status jsonb;
  v_row public.league_competitive_seasons%rowtype;
begin
  v_status := private.compute_league_competitive_status(p_league_id);
  if v_status->>'sportId' is null then raise exception 'League not found'; end if;

  insert into public.league_competitive_seasons(
    league_id,season_key,sport_id,status,active_human_count,total_human_count,qualification,certified_at
  ) values (
    p_league_id,p_season_key,lower(p_sport_id),v_status->>'status',
    (v_status->>'activeHumanCount')::integer,(v_status->>'totalHumanCount')::integer,
    coalesce(v_status->'qualification','[]'::jsonb),now()
  )
  on conflict(league_id,season_key,sport_id) do update set
    status=excluded.status,
    active_human_count=excluded.active_human_count,
    total_human_count=excluded.total_human_count,
    qualification=excluded.qualification,
    certified_at=excluded.certified_at
  returning * into v_row;
  return v_row;
end;
$$;

revoke all on function private.certify_league_competitive_season(uuid,integer,text) from public,anon,authenticated;

-- All permanent league hardware uses this final server gate. A demo room can
-- still play and score, but it cannot manufacture career brass.
create or replace function private.guard_demo_league_hardware()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status jsonb;
begin
  if new.winner_user_id is null then return new; end if;
  v_status := private.compute_league_competitive_status(new.league_id);
  if not coalesce((v_status->>'official')::boolean,false) then
    raise exception 'Demo league: eight active players at 75 percent participation are required for permanent hardware';
  end if;
  return new;
end;
$$;

drop trigger if exists league_trophies_require_official_season on public.league_trophies;
create trigger league_trophies_require_official_season
before insert or update of winner_user_id on public.league_trophies
for each row execute function private.guard_demo_league_hardware();

revoke all on function private.guard_demo_league_hardware() from public,anon,authenticated;

notify pgrst, 'reload schema';
commit;
