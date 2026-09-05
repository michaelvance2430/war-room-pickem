-- Build 21 review only: NFL division fields and autonomous Final Thirteen closeout.
-- DO NOT apply to production without explicit deployment approval.
-- Apply after:
--   1. competitive-league-qualification-build21-REVIEW-ONLY.sql
--   2. postseason-authority-v1.sql
--   3. nfl-jdam-scoring-build21-REVIEW-ONLY.sql
--   4. nfl-postseason-awards-foundation-build21-REVIEW-ONLY.sql
--   5. multi-sport-season-closeout-build21-REVIEW-ONLY.sql
--
-- Product law:
--   * Week 18 freezes the postseason field.
--   * Only active players (75 percent participation, four-card minimum) qualify.
--   * Fewer than eight active players makes the season a demo with no hardware.
--   * Every player division sends equal top and bottom fields:
--       min(4, floor(active division players / 2)).
--   * Final Thirteen adjusted points decide each field.
--   * Regular-season points at the freeze are the first and only tiebreaker.
--   * An exact remaining tie produces co-champions.
--   * Commissioners never choose recipients.

begin;

create or replace function private.freeze_nfl_postseason_field_if_absent(
  p_league_id uuid,
  p_season_key integer
) returns uuid
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_league public.leagues%rowtype;
  v_competitive public.league_competitive_seasons%rowtype;
  v_snapshot_id uuid;
  v_championship_count integer := 0;
  v_toilet_count integer := 0;
begin
  select * into v_league
  from public.leagues league
  where league.id=p_league_id
  for update;
  if not found or lower(coalesce(v_league.sport_id,''))<>'nfl' then
    raise exception 'NFL league required';
  end if;
  if p_season_key<2000 or p_season_key>2100 then
    raise exception 'Invalid NFL season key';
  end if;
  -- The authoritative scoring transaction does not advance current_week.
  -- The durable Week 18 result is therefore the freeze boundary; requiring a
  -- separately published postseason week here would make the final regular-
  -- season scoring transaction fail at commit.
  if not exists (
      select 1 from public.week_results result
      where result.league_id=p_league_id
        and result.week_number=v_league.regular_season_weeks
    ) then
    raise exception 'NFL postseason cannot freeze before the final regular-season card is scored';
  end if;

  select snapshot.id into v_snapshot_id
  from public.league_postseason_snapshots snapshot
  where snapshot.league_id=p_league_id
    and snapshot.season_key=p_season_key::text;
  if v_snapshot_id is not null then
    if not exists (
      select 1 from public.league_postseason_snapshots snapshot
      where snapshot.id=v_snapshot_id and snapshot.sport_id='nfl'
    ) then raise exception 'Existing postseason snapshot belongs to another sport'; end if;
    return v_snapshot_id;
  end if;

  v_competitive:=private.certify_league_competitive_season(
    p_league_id,p_season_key,'nfl'
  );

  if v_competitive.status='official' and exists (
    select 1
    from jsonb_array_elements(v_competitive.qualification) qualification
    join public.memberships membership
      on membership.league_id=p_league_id
     and membership.user_id=(qualification->>'userId')::uuid
    where coalesce((qualification->>'qualifies')::boolean,false)
      and lower(coalesce(membership.division,'')) not in ('north','south','east','west')
  ) then
    raise exception 'Every active NFL player needs a valid division before the Week 18 freeze';
  end if;

  insert into public.league_postseason_snapshots(
    league_id,season_key,sport_id,cut_week,cut_percent,eligible_human_count,
    qualifier_count,toilet_bowl_active,creation_reason,created_by,metadata
  ) values (
    p_league_id,p_season_key::text,'nfl',v_league.regular_season_weeks,50,
    v_competitive.active_human_count,0,false,'cut_week_scored',
    coalesce((select auth.uid()),v_league.commissioner_id),
    jsonb_build_object(
      'formula','division-top-bottom-min-4-floor-half',
      'engine','nfl-final-thirteen-v1',
      'official',v_competitive.status='official',
      'minimum_active_players',8,
      'participation_percent',75,
      'postseason_score_source','final_thirteen_adjusted_points',
      'tiebreaker','regular_season_points_at_cut',
      'co_champions',true,
      'immutable',true
    )
  ) returning id into v_snapshot_id;

  if v_competitive.status='official' then
    with active as (
      select
        membership.user_id,
        coalesce(
          nullif(trim(membership.display_name_override),''),
          nullif(trim(profile.display_name),''),
          'Player'
        ) as display_name,
        initcap(lower(membership.division)) as division,
        coalesce(membership.total_points,0)-coalesce(membership.deployment_credit,0) as earned_points,
        membership.ats_correct,
        membership.ats_total,
        membership.best_week,
        membership.current_streak,
        membership.best_bet_hits,
        membership.best_bet_total
      from jsonb_array_elements(v_competitive.qualification) qualification
      join public.memberships membership
        on membership.league_id=p_league_id
       and membership.user_id=(qualification->>'userId')::uuid
      join public.profiles profile on profile.id=membership.user_id
      where coalesce((qualification->>'qualifies')::boolean,false)
    ), ranked as (
      select active.*,
        row_number() over (
          partition by division
          order by earned_points desc,
            case when ats_total>0 then ats_correct::numeric/ats_total else 0 end desc,
            best_week desc,current_streak desc,
            case when best_bet_total>0 then best_bet_hits::numeric/best_bet_total else 0 end desc,
            display_name,user_id
        )::integer as division_rank,
        count(*) over (partition by division)::integer as division_count
      from active
    ), classified as (
      select ranked.*,
        least(4,division_count/2)::integer as berth_count,
        case
          when division_rank<=least(4,division_count/2) then 'championship'
          when division_rank>division_count-least(4,division_count/2) then 'toilet'
          else 'eliminated'
        end as field
      from ranked
    ), seeded as (
      select classified.*,
        case when field in ('championship','toilet') then
          row_number() over (
            partition by field
            order by
              case when field='championship' then earned_points end desc,
              case when field='toilet' then earned_points end asc,
              display_name,user_id
          )::integer
        end as field_seed
      from classified
    )
    insert into public.league_postseason_participants(
      snapshot_id,user_id,display_name_snapshot,field,seed,first_round_bye,
      division_snapshot,standings_rank_at_cut,season_points_at_cut
    )
    select
      v_snapshot_id,user_id,display_name,field,field_seed,false,
      division,division_rank,earned_points
    from seeded;
  end if;

  select
    count(*) filter (where participant.field='championship')::integer,
    count(*) filter (where participant.field='toilet')::integer
  into v_championship_count,v_toilet_count
  from public.league_postseason_participants participant
  where participant.snapshot_id=v_snapshot_id;

  update public.league_postseason_snapshots
  set qualifier_count=v_championship_count,
      toilet_bowl_active=v_toilet_count>0,
      updated_at=now(),
      metadata=metadata||jsonb_build_object(
        'championship_count',v_championship_count,
        'toilet_count',v_toilet_count
      )
  where id=v_snapshot_id;

  return v_snapshot_id;
end;
$function$;

revoke all on function private.freeze_nfl_postseason_field_if_absent(uuid,integer)
  from public,anon,authenticated;

-- Preserve the existing CFB trigger behavior while giving NFL a service-safe,
-- division-based freeze at the authoritative Week 18 transaction boundary.
create or replace function public.freeze_postseason_after_cut_score()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_league public.leagues%rowtype;
  v_scored_at timestamptz := coalesce(new.scored_at,now());
  v_season_key integer;
begin
  select * into v_league from public.leagues league where league.id=new.league_id;
  if not found or new.week_number<>v_league.regular_season_weeks then return null; end if;

  if lower(coalesce(v_league.sport_id,'cfb'))='nfl' then
    v_season_key:=extract(year from v_scored_at)::integer;
    if extract(month from v_scored_at)::integer<=3 then
      v_season_key:=v_season_key-1;
    end if;
    perform private.freeze_nfl_postseason_field_if_absent(new.league_id,v_season_key);
  else
    perform public.freeze_postseason_snapshot_if_absent(new.league_id,null);
  end if;
  return null;
end;
$function$;
revoke all on function public.freeze_postseason_after_cut_score()
  from public,anon,authenticated;

create or replace function private.finalize_nfl_postseason_if_ready(
  p_league_id uuid,
  p_season_key integer
) returns jsonb
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_league public.leagues%rowtype;
  v_competitive public.league_competitive_seasons%rowtype;
  v_snapshot_id uuid;
  v_national_champion text;
  v_expected_scorecards integer;
  v_actual_scorecards integer;
  v_champions uuid[];
  v_toilet uuid[];
  v_champion record;
  v_source_key text;
begin
  select * into v_league
  from public.leagues league
  where league.id=p_league_id
  for update;
  if not found or lower(coalesce(v_league.sport_id,''))<>'nfl' then
    raise exception 'NFL league required';
  end if;
  if not coalesce(private.validate_closeout_trophy_catalog(
    'nfl',v_league.championship_trophy_id
  ),false) then
    raise exception 'A locked NFL championship trophy is required before postseason closeout';
  end if;

  select result.winners->>'SUPER-BOWL' into v_national_champion
  from public.nfl_postseason_results result
  where result.league_id=p_league_id and result.season_key=p_season_key
    and jsonb_object_length(result.winners)=13;
  if coalesce(v_national_champion,'')='' then
    return jsonb_build_object('ok',false,'status','results_pending');
  end if;

  select count(*)::integer into v_expected_scorecards
  from public.nfl_postseason_entries entry
  where entry.league_id=p_league_id and entry.season_key=p_season_key
    and entry.locked_at is not null;
  select count(*)::integer into v_actual_scorecards
  from public.nfl_postseason_scorecards scorecard
  where scorecard.league_id=p_league_id and scorecard.season_key=p_season_key;
  if v_actual_scorecards<>v_expected_scorecards then
    return jsonb_build_object('ok',false,'status','scorecards_pending');
  end if;

  select * into v_competitive
  from public.league_competitive_seasons competitive
  where competitive.league_id=p_league_id
    and competitive.season_key=p_season_key
    and competitive.sport_id='nfl';
  if not found then
    v_competitive:=private.certify_league_competitive_season(
      p_league_id,p_season_key,'nfl'
    );
  end if;
  if v_competitive.status<>'official' then
    return jsonb_build_object('ok',true,'status','demo_no_hardware');
  end if;

  select snapshot.id into v_snapshot_id
  from public.league_postseason_snapshots snapshot
  where snapshot.league_id=p_league_id
    and snapshot.season_key=p_season_key::text
    and snapshot.sport_id='nfl';
  if v_snapshot_id is null then
    raise exception 'Authoritative NFL Week 18 field is missing';
  end if;

  if exists (
    select 1 from public.league_season_closeouts closeout
    where closeout.league_id=p_league_id
      and closeout.season_key=p_season_key
      and closeout.competition_type='league'
  ) then
    return jsonb_build_object('ok',true,'status','already_closed');
  end if;

  delete from public.nfl_postseason_awards award
  where award.league_id=p_league_id and award.season_key=p_season_key;

  with candidates as (
    select participant.user_id,participant.division_snapshot,
      coalesce(scorecard.adjusted_points,0)::integer as postseason_points,
      participant.season_points_at_cut::integer as regular_points
    from public.league_postseason_participants participant
    left join public.nfl_postseason_scorecards scorecard
      on scorecard.league_id=p_league_id
     and scorecard.season_key=p_season_key
     and scorecard.user_id=participant.user_id
    where participant.snapshot_id=v_snapshot_id
      and participant.field='championship'
  ), ranked as (
    select candidates.*,
      dense_rank() over (
        order by postseason_points desc,regular_points desc
      ) as place
    from candidates
  )
  insert into public.nfl_postseason_awards(
    league_id,season_key,user_id,award_key,division_snapshot,
    postseason_points,regular_season_points,trophy_id
  )
  select p_league_id,p_season_key,user_id,'championship',division_snapshot,
    postseason_points,regular_points,v_league.championship_trophy_id
  from ranked where place=1;

  with candidates as (
    select participant.user_id,participant.division_snapshot,
      coalesce(scorecard.adjusted_points,0)::integer as postseason_points,
      participant.season_points_at_cut::integer as regular_points
    from public.league_postseason_participants participant
    left join public.nfl_postseason_scorecards scorecard
      on scorecard.league_id=p_league_id
     and scorecard.season_key=p_season_key
     and scorecard.user_id=participant.user_id
    where participant.snapshot_id=v_snapshot_id
      and participant.field='toilet'
  ), ranked as (
    select candidates.*,
      dense_rank() over (
        order by postseason_points desc,regular_points desc
      ) as place
    from candidates
  )
  insert into public.nfl_postseason_awards(
    league_id,season_key,user_id,award_key,division_snapshot,
    postseason_points,regular_season_points,trophy_id
  )
  select p_league_id,p_season_key,user_id,'toilet_bowl',division_snapshot,
    postseason_points,regular_points,'toilet_bowl'
  from ranked where place=1;

  select coalesce(array_agg(award.user_id order by award.user_id),'{}'::uuid[])
  into v_champions
  from public.nfl_postseason_awards award
  where award.league_id=p_league_id and award.season_key=p_season_key
    and award.award_key='championship';
  select coalesce(array_agg(award.user_id order by award.user_id),'{}'::uuid[])
  into v_toilet
  from public.nfl_postseason_awards award
  where award.league_id=p_league_id and award.season_key=p_season_key
    and award.award_key='toilet_bowl';
  if cardinality(v_champions)=0 or cardinality(v_toilet)=0 then
    raise exception 'Official NFL season produced an empty hardware field';
  end if;

  insert into public.league_season_closeouts(
    league_id,season_key,sport_id,competition_type,readiness_version,
    national_champion,league_champion_id,toilet_bowl_champion_id,
    league_champion_ids,toilet_bowl_champion_ids,award_manifest,closed_by
  ) values (
    p_league_id,p_season_key,'nfl','league','nfl-final-thirteen-v1',
    v_national_champion,v_champions[1],v_toilet[1],v_champions,v_toilet,
    jsonb_build_object(
      'score_source','final_thirteen_adjusted_points',
      'tiebreaker','regular_season_points_at_cut',
      'co_champions',true,
      'commissioner_selected_recipients',false
    ),coalesce((select auth.uid()),v_league.commissioner_id)
  );

  -- NFL co-champions use a multi-recipient award ledger. Feed every legitimate
  -- production champion into the global career receipt ledger exactly once.
  if coalesce(v_league.mode::text,'production')='production' then
    for v_champion in
      select award.user_id,award.awarded_at
      from public.nfl_postseason_awards award
      where award.league_id=p_league_id and award.season_key=p_season_key
        and award.award_key='championship'
    loop
      v_source_key:='nfl:'||p_league_id::text||':'||p_season_key::text||':championship:'||v_champion.user_id::text;
      insert into public.career_championship_receipts(
        source_key,user_id,league_id,season_key,sport_id,earned_at
      ) values (
        v_source_key,v_champion.user_id,p_league_id,p_season_key,'nfl',v_champion.awarded_at
      ) on conflict(source_key) do nothing;
      perform private.refresh_repeat_champion_milestones(
        v_champion.user_id,v_source_key,p_league_id
      );
    end loop;
  end if;

  return jsonb_build_object(
    'ok',true,'status','closed',
    'championIds',to_jsonb(v_champions),
    'toiletBowlChampionIds',to_jsonb(v_toilet)
  );
end;
$function$;
revoke all on function private.finalize_nfl_postseason_if_ready(uuid,integer)
  from public,anon,authenticated;

create or replace function private.finalize_nfl_postseason_after_results()
returns trigger
language plpgsql
security definer
set search_path=''
as $function$
begin
  perform private.finalize_nfl_postseason_if_ready(new.league_id,new.season_key);
  return null;
end;
$function$;
revoke all on function private.finalize_nfl_postseason_after_results()
  from public,anon,authenticated;

drop trigger if exists finalize_nfl_postseason_after_results
  on public.nfl_postseason_results;
create constraint trigger finalize_nfl_postseason_after_results
after insert or update of winners on public.nfl_postseason_results
deferrable initially deferred
for each row execute function private.finalize_nfl_postseason_after_results();

create or replace view public.nfl_postseason_field_status
with (security_invoker=true)
as
select
  competitive.league_id,
  competitive.season_key,
  membership.user_id,
  competitive.status as season_status,
  competitive.active_human_count,
  competitive.total_human_count,
  coalesce(participant.field,'ineligible') as field,
  participant.seed,
  participant.division_snapshot,
  participant.season_points_at_cut::integer as regular_season_points
from public.league_competitive_seasons competitive
join public.memberships membership on membership.league_id=competitive.league_id
left join public.league_postseason_snapshots snapshot
  on snapshot.league_id=competitive.league_id
 and snapshot.season_key=competitive.season_key::text
 and snapshot.sport_id='nfl'
left join public.league_postseason_participants participant
  on participant.snapshot_id=snapshot.id
 and participant.user_id=membership.user_id
where competitive.sport_id='nfl';
grant select on public.nfl_postseason_field_status to authenticated;

create or replace view public.nfl_profile_trophies
with (security_invoker=true)
as
select
  award.id,
  award.league_id,
  award.season_key as season_year,
  award.award_key as trophy_type,
  coalesce(nullif(trim(profile.display_name),''),'Player') as winner_name,
  award.user_id as winner_user_id,
  case award.award_key
    when 'championship' then 'NFL Final Thirteen Champion · '
    else 'NFL Toilet Bowl Champion · '
  end||award.season_key::text as subtitle,
  'Won the '||case award.award_key
    when 'championship' then 'Championship field'
    else 'Toilet Bowl field'
  end||' with '||award.postseason_points||
  ' Final Thirteen points. Regular-season tiebreak: '||
  award.regular_season_points||'.' as notes,
  award.awarded_at,
  award.trophy_id as trophy_design_id
from public.nfl_postseason_awards award
left join public.profiles profile on profile.id=award.user_id;
grant select on public.nfl_profile_trophies to authenticated;

notify pgrst, 'reload schema';
commit;
