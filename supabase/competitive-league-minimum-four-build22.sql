-- Build 22: four qualifying humans are required for permanent league hardware.
-- A qualifying human still must lock at least 75 percent of eligible scored
-- regular-season cards, with a hard minimum of four locked cards.

begin;

alter table public.league_competitive_seasons
  drop constraint if exists league_competitive_seasons_minimum_active_players_check;

alter table public.league_competitive_seasons
  alter column minimum_active_players set default 4;

update public.league_competitive_seasons
set minimum_active_players = 4
where minimum_active_players <> 4;

alter table public.league_competitive_seasons
  add constraint league_competitive_seasons_minimum_active_players_check
  check (minimum_active_players = 4);

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
    'status',case when coalesce(active_humans,0) >= 4 then 'official' else 'demo' end,
    'official',coalesce(active_humans,0) >= 4,
    'activeHumanCount',coalesce(active_humans,0),
    'totalHumanCount',coalesce(total_humans,0),
    'minimumActivePlayers',4,
    'requiredParticipationPercent',75,
    'minimumLockedCards',4,
    'qualification',qualification
  )
  from totals;
$$;

revoke all on function private.compute_league_competitive_status(uuid)
  from public,anon,authenticated;

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
    raise exception 'Demo league: four active players at 75 percent participation are required for permanent hardware';
  end if;
  perform private.certify_league_competitive_season(
    new.league_id,
    new.season_year,
    v_status->>'sportId'
  );
  return new;
end;
$$;

revoke all on function private.guard_demo_league_hardware()
  from public,anon,authenticated;

notify pgrst, 'reload schema';
commit;
