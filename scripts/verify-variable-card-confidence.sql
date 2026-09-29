-- Run with an open published 30-game card and a member with a remaining weapon use.
-- Set these session settings first: warroom.test_league_id, warroom.test_user_id,
-- warroom.test_week. Every submission, receipt, and total change is rolled back.
begin;
create temporary table confidence_test_results(test text, result text) on commit drop;
do $test$
declare
  v_league_id uuid := current_setting('warroom.test_league_id')::uuid;
  v_user_id uuid := current_setting('warroom.test_user_id')::uuid;
  v_week_no integer := current_setting('warroom.test_week')::integer;
  card public.week_cards%rowtype;
  payload jsonb;
  best uuid;
  saved jsonb;
  saved_id uuid;
  weapon boolean;
  bad integer;
  rejected_constraint text;
begin
  perform set_config('request.jwt.claim.sub', v_user_id::text, true);
  select * into strict card from public.week_cards
    where week_cards.league_id=v_league_id and week_number=v_week_no;
  select jsonb_agg(jsonb_build_object('game_id',id,'side',side,'confidence',confidence)),
    (array_agg(id order by confidence desc))[1]
  into payload,best from (
    select id,case when lower(favorite)='away' then 'away' else 'home' end side,
      row_number() over(order by abs(spread),id::text)::integer confidence
    from public.card_games where week_card_id=card.id
  ) ranked;
  if jsonb_array_length(payload)<>30 then raise exception 'Use a 30-game fixture'; end if;
  foreach weapon in array array[false,true] loop
    begin
      saved := public.save_week_picks_atomic(v_league_id,v_week_no,payload,best,card.prop_option_a,weapon);
      saved_id := (saved->>'pick_id')::uuid;
      if (select count(*) from public.pick_games where pick_id=saved_id)<>30
         or (select sum(confidence) from public.pick_games where pick_id=saved_id)<>465
         or (select max(confidence) from public.pick_games where pick_id=saved_id)<>30 then
        raise exception 'Complete 1..30 confidence ladder was not saved';
      end if;
      if weapon then
        if not (select is_chaos from public.picks where id=saved_id) then
          raise exception 'Weapon was not marked';
        end if;
        if not exists(select 1 from public.weapon_service_events e
          where e.source_event_id='regular-weapon-'||v_league_id||'-'||v_user_id||'-'||v_week_no
            and e.decisions_changed=30 and e.weapon_type='tactical_nuke') then
          raise exception 'Missing 30-decision weapon receipt';
        end if;
        begin
          perform public.save_week_picks_atomic(v_league_id,v_week_no,payload,best,card.prop_option_a,false);
          raise exception 'Sealed weapon unexpectedly editable';
        exception when raise_exception then
          if SQLERRM<>'Authorized weapon cards are sealed and cannot be edited' then raise; end if;
        end;
      end if;
      -- Check the storage boundary independently of the RPC validator.
      foreach bad in array array[0,31] loop
        begin
          update public.pick_games set confidence=bad where pick_id=saved_id and card_game_id=best;
          raise exception 'Out-of-range confidence accepted';
        exception when check_violation then
          get stacked diagnostics rejected_constraint=CONSTRAINT_NAME;
          if rejected_constraint<>'pick_games_confidence_check' then raise; end if;
        end;
      end loop;
      raise exception using errcode='ZR001',message='Verified; undo test submission';
    exception when sqlstate 'ZR001' then
      insert into confidence_test_results values
        (case when weapon then 'Nuclear 30-game save, receipt, sealed-card guard' else 'Manual 30-game save' end,
         'PASS; confidence 1..30 persisted, 0/31 rejected, writes rolled back');
    end;
  end loop;
end
$test$;
select * from confidence_test_results;
rollback;
