-- BUILD 21 REVIEW ONLY. Do not apply to production without explicit approval.
-- Replaces the CFB-only closeout gate with one sport-aware, idempotent receipt.
-- Apply after the Fieldhouse Build 21 schema and NFL postseason schema.

begin;

alter table public.league_season_closeouts
  add column if not exists competition_type text not null default 'league',
  add column if not exists league_champion_ids uuid[] not null default '{}'::uuid[],
  add column if not exists toilet_bowl_champion_ids uuid[] not null default '{}'::uuid[];

update public.league_season_closeouts
set league_champion_ids=array[league_champion_id]
where cardinality(league_champion_ids)=0;

update public.league_season_closeouts
set toilet_bowl_champion_ids=array[toilet_bowl_champion_id]
where cardinality(toilet_bowl_champion_ids)=0;

alter table public.league_season_closeouts
  drop constraint if exists league_season_closeouts_sport_id_check,
  add constraint league_season_closeouts_sport_id_check
    check (sport_id in ('cfb','nfl','ncaam','ncaaw')),
  drop constraint if exists league_season_closeouts_competition_type_check,
  add constraint league_season_closeouts_competition_type_check
    check (competition_type in ('league')),
  drop constraint if exists league_season_closeouts_league_champion_ids_check,
  add constraint league_season_closeouts_league_champion_ids_check
    check (cardinality(league_champion_ids)>0 and array_position(league_champion_ids,null) is null),
  drop constraint if exists league_season_closeouts_toilet_champion_ids_check,
  add constraint league_season_closeouts_toilet_champion_ids_check
    check (cardinality(toilet_bowl_champion_ids)>0 and array_position(toilet_bowl_champion_ids,null) is null);

alter table public.league_season_closeouts
  drop constraint if exists league_season_closeouts_league_id_season_key_key;
create unique index if not exists league_season_closeouts_competition_key
  on public.league_season_closeouts(league_id,season_key,competition_type);

create or replace function private.validate_closeout_trophy_catalog(
  p_sport_id text,
  p_trophy_id text
) returns boolean
language sql immutable
set search_path=''
as $$
  select case p_sport_id
    when 'cfb' then p_trophy_id in (
      'command_cup','golden_gut','the_receipt','insufferable_crown','brass_football','last_one_standing'
    )
    when 'nfl' then p_trophy_id in (
      'nfl_sunday_scepter','nfl_gridiron_crown','nfl_fourth_down_forge',
      'nfl_two_minute_monument','nfl_iron_end_zone','nfl_final_whistle'
    )
    when 'ncaam' then p_trophy_id in (
      'm-iron-rim','m-net-cutter','m-hardwood-crown','m-final-possession','m-glass-house','m-fieldhouse-cup'
    )
    when 'ncaaw' then p_trophy_id in (
      'w-pure-game','w-extra-pass','w-94-feet','w-nylon-standard','w-forty-minutes','w-better-bracket'
    )
    else false
  end;
$$;
revoke all on function private.validate_closeout_trophy_catalog(text,text)
  from public,anon,authenticated;

create or replace function public.record_season_closeout(
  p_league_id uuid,
  p_season_key integer,
  p_sport_id text,
  p_competition_type text,
  p_readiness_version text,
  p_national_champion text,
  p_league_champion_ids uuid[],
  p_toilet_bowl_champion_ids uuid[],
  p_award_manifest jsonb default '{}'::jsonb
) returns public.league_season_closeouts
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_league public.leagues%rowtype;
  v_sport_id text := lower(trim(coalesce(p_sport_id,'')));
  v_competition_type text := lower(trim(coalesce(p_competition_type,'')));
  v_champions uuid[];
  v_toilet uuid[];
  v_tournament_id uuid;
  v_selected_trophy text;
  v_row public.league_season_closeouts%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;

  select * into v_league
  from public.leagues
  where id=p_league_id
  for update;
  if not found then raise exception 'League not found'; end if;
  if v_sport_id not in ('cfb','nfl','ncaam','ncaaw')
    or lower(coalesce(v_league.sport_id,'cfb'))<>v_sport_id then
    raise exception 'Closeout sport does not match the league';
  end if;
  if v_competition_type<>'league' then
    raise exception 'Unsupported closeout competition type';
  end if;
  if not exists (
    select 1 from public.memberships membership
    where membership.league_id=p_league_id
      and membership.user_id=v_uid
      and (membership.role='commissioner' or coalesce(membership.is_deputy,false))
  ) then raise exception 'Commissioner or deputy required'; end if;

  if coalesce(trim(p_readiness_version),'')=''
    or coalesce(trim(p_national_champion),'')='' then
    raise exception 'Closeout evidence is incomplete';
  end if;

  select coalesce(array_agg(distinct champion order by champion),'{}'::uuid[])
  into v_champions
  from unnest(coalesce(p_league_champion_ids,'{}'::uuid[])) champion
  where champion is not null;
  select coalesce(array_agg(distinct champion order by champion),'{}'::uuid[])
  into v_toilet
  from unnest(coalesce(p_toilet_bowl_champion_ids,'{}'::uuid[])) champion
  where champion is not null;
  if cardinality(v_champions)=0 or cardinality(v_toilet)=0 then
    raise exception 'Championship and Toilet Bowl recipients are required';
  end if;
  if exists (
    select 1 from unnest(v_champions||v_toilet) recipient
    where not exists (
      select 1 from public.memberships membership
      where membership.league_id=p_league_id and membership.user_id=recipient
    )
  ) then raise exception 'Every closeout recipient must belong to the league'; end if;

  if not exists (
    select 1 from public.league_competitive_seasons competitive
    where competitive.league_id=p_league_id
      and competitive.season_key=p_season_key
      and competitive.sport_id=v_sport_id
      and competitive.status='official'
  ) then raise exception 'Official competitive-season receipt is missing'; end if;

  v_selected_trophy:=v_league.championship_trophy_id;
  if not coalesce(private.validate_closeout_trophy_catalog(v_sport_id,v_selected_trophy),false) then
    raise exception 'Selected championship trophy does not match the league sport';
  end if;

  if v_sport_id='cfb' then
    if not exists (
      select 1 from public.league_postseason_snapshots snapshot
      where snapshot.league_id=p_league_id and snapshot.season_key=p_season_key::text
    ) then raise exception 'Durable postseason snapshot is missing'; end if;
    if not exists (
      select 1 from public.postseason_scorecards scorecard
      where scorecard.league_id=p_league_id and scorecard.season_key=p_season_key
        and scorecard.phase='championship'
    ) then raise exception 'Final postseason scorecard is missing'; end if;
  elsif v_sport_id='nfl' then
    if not exists (
      select 1 from public.nfl_postseason_results result
      where result.league_id=p_league_id and result.season_key=p_season_key
        and jsonb_object_length(result.winners)=13
        and coalesce(result.winners->>'SUPER-BOWL','')=trim(p_national_champion)
    ) then raise exception 'Final NFL postseason result is missing or mismatched'; end if;
    if exists (
      select 1 from unnest(v_champions||v_toilet) recipient
      where not exists (
        select 1 from public.nfl_postseason_scorecards scorecard
        where scorecard.league_id=p_league_id and scorecard.season_key=p_season_key
          and scorecard.user_id=recipient
      )
    ) then raise exception 'Final NFL scorecard is missing for a recipient'; end if;
    if v_champions<>coalesce((
      select array_agg(award.user_id order by award.user_id)
      from public.nfl_postseason_awards award
      where award.league_id=p_league_id and award.season_key=p_season_key
        and award.award_key='championship'
    ),'{}'::uuid[]) then
      raise exception 'NFL Championship recipients must match the authoritative Final Thirteen awards';
    end if;
    if v_toilet<>coalesce((
      select array_agg(award.user_id order by award.user_id)
      from public.nfl_postseason_awards award
      where award.league_id=p_league_id and award.season_key=p_season_key
        and award.award_key='toilet_bowl'
    ),'{}'::uuid[]) then
      raise exception 'NFL Toilet Bowl recipients must match the authoritative Final Thirteen awards';
    end if;
  else
    begin
      v_tournament_id:=coalesce(
        nullif(p_award_manifest->>'tournament_id','')::uuid,
        nullif(p_award_manifest->>'tournamentId','')::uuid
      );
    exception when invalid_text_representation then
      raise exception 'Fieldhouse tournament id is invalid';
    end;
    if v_tournament_id is null or not exists (
      select 1 from public.fieldhouse_tournaments tournament
      where tournament.id=v_tournament_id
        and tournament.sport_id=v_sport_id
        and tournament.season_key=p_season_key
        and tournament.status='final'
        and exists (
          select 1
          from public.fieldhouse_tournament_games title_game
          join public.fieldhouse_tournament_teams champion_team
            on champion_team.tournament_id=title_game.tournament_id
           and champion_team.team_id=title_game.winner_team_id
          where title_game.tournament_id=tournament.id
            and title_game.round_key='title'
            and (
              title_game.winner_team_id=trim(p_national_champion)
              or lower(champion_team.display_name)=lower(trim(p_national_champion))
            )
        )
    ) then raise exception 'Final Fieldhouse tournament evidence is missing or mismatched'; end if;
    if exists (
      select 1 from unnest(v_champions) recipient
      where not exists (
        select 1 from public.fieldhouse_postseason_awards award
        where award.tournament_id=v_tournament_id and award.league_id=p_league_id
          and award.user_id=recipient and award.award_key='league_champion'
          and award.trophy_id=v_selected_trophy
      )
    ) then raise exception 'Fieldhouse championship award is missing or mismatched'; end if;
    if exists (
      select 1 from unnest(v_toilet) recipient
      where not exists (
        select 1 from public.fieldhouse_postseason_awards award
        where award.tournament_id=v_tournament_id and award.league_id=p_league_id
          and award.user_id=recipient and award.award_key='toilet_champion'
      )
    ) then raise exception 'Fieldhouse Toilet Bowl award is missing or mismatched'; end if;
  end if;

  -- CFB still projects through the legacy one-winner-per-type trophy shelf.
  -- NFL co-champions use nfl_postseason_awards and were validated above.
  if v_sport_id='cfb' then
    if exists (
      select 1 from unnest(v_champions) recipient
      where not exists (
        select 1 from public.league_trophies trophy
        where trophy.league_id=p_league_id and trophy.season_year=p_season_key
          and trophy.trophy_type='championship' and trophy.winner_user_id=recipient
          and trophy.trophy_design_id=v_selected_trophy
      )
    ) then raise exception 'Championship trophy is missing or mismatched'; end if;
    if exists (
      select 1 from unnest(v_toilet) recipient
      where not exists (
        select 1 from public.league_trophies trophy
        where trophy.league_id=p_league_id and trophy.season_year=p_season_key
          and trophy.trophy_type='toilet_bowl' and trophy.winner_user_id=recipient
      )
    ) then raise exception 'Toilet Bowl trophy is missing or mismatched'; end if;
  end if;

  insert into public.league_season_closeouts(
    league_id,season_key,sport_id,competition_type,readiness_version,national_champion,
    league_champion_id,toilet_bowl_champion_id,
    league_champion_ids,toilet_bowl_champion_ids,
    award_manifest,closed_by
  ) values (
    p_league_id,p_season_key,v_sport_id,v_competition_type,p_readiness_version,
    trim(p_national_champion),v_champions[1],v_toilet[1],v_champions,v_toilet,
    coalesce(p_award_manifest,'{}'::jsonb),v_uid
  ) on conflict(league_id,season_key,competition_type) do nothing;

  select * into v_row from public.league_season_closeouts closeout
  where closeout.league_id=p_league_id and closeout.season_key=p_season_key
    and closeout.competition_type=v_competition_type;
  if v_row.readiness_version<>p_readiness_version
    or v_row.sport_id<>v_sport_id
    or v_row.league_champion_ids<>v_champions
    or v_row.toilet_bowl_champion_ids<>v_toilet then
    raise exception 'Season already closed with different evidence';
  end if;
  return v_row;
end;
$function$;

revoke all on function public.record_season_closeout(
  uuid,integer,text,text,text,text,uuid[],uuid[],jsonb
) from public,anon;
grant execute on function public.record_season_closeout(
  uuid,integer,text,text,text,text,uuid[],uuid[],jsonb
) to authenticated;

-- Backward-compatible CFB entry point. Existing clients keep working while
-- inheriting the same Official-season, trophy-catalog, and evidence gates.
create or replace function public.record_cfb_season_closeout(
  p_league_id uuid,
  p_season_key integer,
  p_readiness_version text,
  p_national_champion text,
  p_league_champion_id uuid,
  p_toilet_bowl_champion_id uuid,
  p_award_manifest jsonb default '{}'::jsonb
) returns public.league_season_closeouts
language sql
security invoker
set search_path=''
as $$
  select public.record_season_closeout(
    p_league_id,p_season_key,'cfb','league',p_readiness_version,p_national_champion,
    array[p_league_champion_id],array[p_toilet_bowl_champion_id],p_award_manifest
  );
$$;
revoke all on function public.record_cfb_season_closeout(uuid,integer,text,text,uuid,uuid,jsonb)
  from public,anon;
grant execute on function public.record_cfb_season_closeout(uuid,integer,text,text,uuid,uuid,jsonb)
  to authenticated;

notify pgrst, 'reload schema';
commit;
