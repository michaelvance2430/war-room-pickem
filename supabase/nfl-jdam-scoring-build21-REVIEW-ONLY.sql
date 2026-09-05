-- Build 21 review-only upgrade: authoritative NFL postseason JDAM scoring.
-- DO NOT apply to production without the release/deployment approval gate.
--
-- Rule: the Final Thirteen contains 13 decisions. 60% therefore requires
-- eight correct decisions (ceil(13 * 0.60)). JDAM applies its multiplier to
-- weighted raw points: 1.5x for 8-13 correct, 0.5x for 0-7 correct.
begin;

alter table public.nfl_postseason_scorecards
  add column if not exists correct_picks integer not null default 0,
  add column if not exists raw_points integer not null default 0,
  add column if not exists adjusted_points integer not null default 0,
  add column if not exists jdam_multiplier numeric(3,2) not null default 1.00;

-- Do not silently relabel an old ordinary-points JDAM receipt as corrected.
-- A deployed season with one of these rows needs an explicit recalculation
-- plan before this upgrade may proceed.
do $preflight$
begin
  if exists(
    select 1 from public.nfl_postseason_scorecards where used_jdam
  ) then
    raise exception 'Legacy NFL JDAM scorecards require explicit recalculation before Build 21';
  end if;
end;
$preflight$;

update public.nfl_postseason_scorecards
set correct_picks=0,
    raw_points=total_points,
    adjusted_points=total_points,
    jdam_multiplier=1.00;

alter table public.nfl_postseason_scorecards
  drop constraint if exists nfl_postseason_scorecards_correct_picks_check,
  add constraint nfl_postseason_scorecards_correct_picks_check
    check (correct_picks between 0 and 13),
  drop constraint if exists nfl_postseason_scorecards_jdam_multiplier_check,
  add constraint nfl_postseason_scorecards_jdam_multiplier_check
    check (jdam_multiplier in (0.50, 1.00, 1.50)),
  drop constraint if exists nfl_postseason_scorecards_points_receipt_check,
  add constraint nfl_postseason_scorecards_points_receipt_check
    check (raw_points >= 0 and adjusted_points >= 0 and total_points = adjusted_points);

-- All postseason mutations must pass through the guarded RPCs. The publish
-- RPC already verifies the commissioner and its slate trigger validates the
-- complete 14-team field; make it privileged before removing direct writes.
alter function public.publish_nfl_postseason_slate(uuid,integer,jsonb)
  security definer;
alter function public.publish_nfl_postseason_slate(uuid,integer,jsonb)
  set search_path = '';
alter function public.save_nfl_postseason_bracket(uuid,integer,jsonb,boolean)
  set search_path = '';
alter function public.reset_league_season_guarded(uuid,text)
  set search_path = '';
revoke all on function public.publish_nfl_postseason_slate(uuid,integer,jsonb)
  from public,anon;
grant execute on function public.publish_nfl_postseason_slate(uuid,integer,jsonb)
  to authenticated,service_role;
revoke all on function public.save_nfl_postseason_bracket(uuid,integer,jsonb,boolean)
  from public,anon;
grant execute on function public.save_nfl_postseason_bracket(uuid,integer,jsonb,boolean)
  to authenticated,service_role;
revoke insert,update on public.nfl_postseason_slates
  from authenticated;
revoke insert,update on public.nfl_postseason_entries
  from authenticated;
revoke insert,update on public.nfl_postseason_results
  from authenticated;

create or replace function public.save_nfl_postseason_results(
  p_league_id uuid,
  p_season_key integer,
  p_winners jsonb
)
returns public.nfl_postseason_results
language plpgsql
security definer
set search_path=''
as $function$
declare
  v_uid uuid:=(select auth.uid());
  v_authorized boolean:=false;
  v_row public.nfl_postseason_results;
  v_old jsonb:='{}'::jsonb;
  v_entry record;
  v_wc integer;
  v_div integer;
  v_conf integer;
  v_sb integer;
  v_correct integer;
  v_raw integer;
  v_adjusted integer;
  v_multiplier numeric(3,2);
  v_previous integer;
  v_had_scorecard boolean;
begin
  -- Serializes certification and every standings delta for this league.
  select l.sport_id='nfl' and l.commissioner_id=v_uid
  into v_authorized
  from public.leagues l
  where l.id=p_league_id
  for update;
  if not coalesce(v_authorized,false) then
    raise exception 'NFL commissioner authority required';
  end if;

  if jsonb_typeof(p_winners)<>'object'
    or exists(
      select 1 from jsonb_object_keys(p_winners) k
      where k not in (
        'AFC-WC-2-7','AFC-WC-3-6','AFC-WC-4-5',
        'NFC-WC-2-7','NFC-WC-3-6','NFC-WC-4-5',
        'AFC-DIV-1','AFC-DIV-2','NFC-DIV-1','NFC-DIV-2',
        'AFC-CONF','NFC-CONF','SUPER-BOWL'
      )
    ) then
    raise exception 'Invalid NFL result key';
  end if;

  if exists(
    select 1 from jsonb_each_text(p_winners) result
    where not exists(
      select 1
      from public.nfl_postseason_slates slate,
           jsonb_array_elements(slate.teams) team
      where slate.league_id=p_league_id
        and slate.season_key=p_season_key
        and team->>'id'=result.value
    )
  ) then
    raise exception 'An NFL winner is not in the official field';
  end if;

  select winners into v_old
  from public.nfl_postseason_results
  where league_id=p_league_id and season_key=p_season_key;
  v_old:=coalesce(v_old,'{}'::jsonb);
  if exists(
    select 1 from jsonb_each_text(v_old) old_result
    where p_winners->>old_result.key is distinct from old_result.value
  ) then
    raise exception 'Recorded NFL winners are permanent';
  end if;

  insert into public.nfl_postseason_results(league_id,season_key,winners)
  values(p_league_id,p_season_key,p_winners)
  on conflict(league_id,season_key) do update
    set winners=excluded.winners,updated_at=now()
  returning * into v_row;

  if jsonb_object_length(p_winners)=13 then
    for v_entry in
      select entry.*
      from public.nfl_postseason_entries entry
      where entry.league_id=p_league_id
        and entry.season_key=p_season_key
        and entry.locked_at is not null
      order by entry.user_id
    loop
      select count(*)::integer into v_wc
      from jsonb_each_text(p_winners) result
      where result.key like '%-WC-%' and v_entry.picks->>result.key=result.value;
      select (count(*)*2)::integer into v_div
      from jsonb_each_text(p_winners) result
      where result.key like '%-DIV-%' and v_entry.picks->>result.key=result.value;
      select (count(*)*4)::integer into v_conf
      from jsonb_each_text(p_winners) result
      where result.key like '%-CONF' and v_entry.picks->>result.key=result.value;
      select (count(*)*8)::integer into v_sb
      from jsonb_each_text(p_winners) result
      where result.key='SUPER-BOWL' and v_entry.picks->>result.key=result.value;

      select count(*)::integer into v_correct
      from jsonb_each_text(p_winners) result
      where v_entry.picks->>result.key=result.value;
      v_raw:=v_wc+v_div+v_conf+v_sb;

      if v_entry.used_jdam then
        v_multiplier:=case when v_correct>=8 then 1.50 else 0.50 end;
        v_adjusted:=round(v_raw*v_multiplier)::integer;
      else
        v_multiplier:=1.00;
        v_adjusted:=v_raw;
      end if;

      v_had_scorecard:=false;
      v_previous:=0;
      select true,total_points
      into v_had_scorecard,v_previous
      from public.nfl_postseason_scorecards
      where league_id=p_league_id
        and user_id=v_entry.user_id
        and season_key=p_season_key
      for update;
      v_had_scorecard:=coalesce(v_had_scorecard,false);
      v_previous:=coalesce(v_previous,0);

      insert into public.nfl_postseason_scorecards(
        league_id,user_id,season_key,
        wild_card_points,divisional_points,conference_points,super_bowl_points,
        correct_picks,raw_points,adjusted_points,total_points,
        used_jdam,jdam_multiplier,created_at
      ) values (
        p_league_id,v_entry.user_id,p_season_key,
        v_wc,v_div,v_conf,v_sb,
        v_correct,v_raw,v_adjusted,v_adjusted,
        v_entry.used_jdam,v_multiplier,now()
      )
      on conflict(league_id,user_id,season_key) do update set
        wild_card_points=excluded.wild_card_points,
        divisional_points=excluded.divisional_points,
        conference_points=excluded.conference_points,
        super_bowl_points=excluded.super_bowl_points,
        correct_picks=excluded.correct_picks,
        raw_points=excluded.raw_points,
        adjusted_points=excluded.adjusted_points,
        total_points=excluded.total_points,
        used_jdam=excluded.used_jdam,
        jdam_multiplier=excluded.jdam_multiplier;

      update public.memberships
      set total_points=total_points+(v_adjusted-v_previous),
          weekly_points=case
            when v_had_scorecard then weekly_points
            else array_append(coalesce(weekly_points,'{}'::integer[]),v_adjusted)
          end,
          weeks_played=case when v_had_scorecard then weeks_played else weeks_played+1 end,
          best_week=greatest(coalesce(best_week,v_adjusted),v_adjusted),
          worst_week=least(coalesce(worst_week,v_adjusted),v_adjusted)
      where league_id=p_league_id and user_id=v_entry.user_id;

      update public.nfl_postseason_entries
      set score=v_adjusted,updated_at=now()
      where league_id=p_league_id
        and user_id=v_entry.user_id
        and season_key=p_season_key;
    end loop;
  end if;
  return v_row;
end;
$function$;

revoke all on function public.save_nfl_postseason_results(uuid,integer,jsonb)
  from public,anon;
grant execute on function public.save_nfl_postseason_results(uuid,integer,jsonb)
  to authenticated;

comment on function public.save_nfl_postseason_results(uuid,integer,jsonb) is
  'Authoritative Final Thirteen certification. JDAM uses 8 of 13 as the 60 percent threshold, then applies 1.5x or 0.5x to weighted raw points and atomically updates standings.';

commit;
