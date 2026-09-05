-- Build 21 disposable branch behavior rehearsal.
-- This script creates deterministic fixtures inside one transaction and always rolls back.
-- Never run it against production.

begin;

do $$
begin
  if to_regclass('private.build21_rehearsal_sentinel') is null
     or not exists (
       select 1 from private.build21_rehearsal_sentinel
       where token='build-21-release-rehearsal-20260905'
     ) then
    raise exception 'Refusing to run Build 21 rehearsal without the disposable-branch sentinel';
  end if;
end;
$$;

-- Fixture IDs are deliberately obvious and exist only until the final rollback.
set local session_replication_role = replica;

insert into public.profiles(id,display_name)
select ('21000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid, 'Build 21 Human '||n
from generate_series(1,12) n;

insert into public.profiles(id,display_name) values
  ('21000000-0000-0000-0000-000000000098','Build 21 Bot'),
  ('21000000-0000-0000-0000-000000000099','Build 21 Outsider');

insert into public.leagues(id,name,code,commissioner_id,regular_season_weeks,sport_id,mode) values
  ('21100000-0000-0000-0000-000000000001','B21 Official CFB','B21OCF','21000000-0000-0000-0000-000000000001',4,'cfb','production'),
  ('21100000-0000-0000-0000-000000000002','B21 Demo NFL','B21DNF','21000000-0000-0000-0000-000000000001',4,'nfl','production'),
  ('21100000-0000-0000-0000-000000000003','B21 Floor NCAAM','B21FNM','21000000-0000-0000-0000-000000000001',4,'ncaam','production'),
  ('21100000-0000-0000-0000-000000000004','B21 Percent NCAAW','B21PNW','21000000-0000-0000-0000-000000000001',6,'ncaaw','production');

-- Official: eight qualifying humans plus one bot. Demo: seven qualifying humans.
insert into public.memberships(league_id,user_id,role,is_bot)
select '21100000-0000-0000-0000-000000000001',
       ('21000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
       case when n=1 then 'commissioner'::public.member_role else 'player'::public.member_role end,
       false
from generate_series(1,8) n;
insert into public.memberships(league_id,user_id,is_bot) values
  ('21100000-0000-0000-0000-000000000001','21000000-0000-0000-0000-000000000098',true);

insert into public.memberships(league_id,user_id,role,is_bot)
select '21100000-0000-0000-0000-000000000002',
       ('21000000-0000-0000-0000-'||lpad(n::text,12,'0'))::uuid,
       case when n=1 then 'commissioner'::public.member_role else 'player'::public.member_role end,
       false
from generate_series(1,7) n;

-- Floor league: one player locks 3/4 (fails), one locks 4/4 (passes).
insert into public.memberships(league_id,user_id,role,is_bot) values
  ('21100000-0000-0000-0000-000000000003','21000000-0000-0000-0000-000000000001','commissioner',false),
  ('21100000-0000-0000-0000-000000000003','21000000-0000-0000-0000-000000000002','player',false);

-- Percent league: one player locks 4/6 (fails), one locks 5/6 (passes).
insert into public.memberships(league_id,user_id,role,is_bot) values
  ('21100000-0000-0000-0000-000000000004','21000000-0000-0000-0000-000000000001','commissioner',false),
  ('21100000-0000-0000-0000-000000000004','21000000-0000-0000-0000-000000000002','player',false);

insert into public.week_cards(id,league_id,week_number)
select ('21200000-0000-0000-0001-'||lpad(w::text,12,'0'))::uuid,
       '21100000-0000-0000-0000-000000000001',w from generate_series(1,4) w;
insert into public.week_cards(id,league_id,week_number)
select ('21200000-0000-0000-0002-'||lpad(w::text,12,'0'))::uuid,
       '21100000-0000-0000-0000-000000000002',w from generate_series(1,4) w;
insert into public.week_cards(id,league_id,week_number)
select ('21200000-0000-0000-0003-'||lpad(w::text,12,'0'))::uuid,
       '21100000-0000-0000-0000-000000000003',w from generate_series(1,4) w;
insert into public.week_cards(id,league_id,week_number)
select ('21200000-0000-0000-0004-'||lpad(w::text,12,'0'))::uuid,
       '21100000-0000-0000-0000-000000000004',w from generate_series(1,6) w;

insert into public.week_results(league_id,week_number)
select l,w from (values
 ('21100000-0000-0000-0000-000000000001'::uuid,4),
 ('21100000-0000-0000-0000-000000000002'::uuid,4),
 ('21100000-0000-0000-0000-000000000003'::uuid,4),
 ('21100000-0000-0000-0000-000000000004'::uuid,6)
) x(l,maxw) cross join lateral generate_series(1,maxw) w;

-- Every official/demo human locks all four cards.
insert into public.picks(league_id,user_id,week_number,locked_at)
select m.league_id,m.user_id,w,now()
from public.memberships m
cross join generate_series(1,4) w
where m.league_id in ('21100000-0000-0000-0000-000000000001','21100000-0000-0000-0000-000000000002')
  and not m.is_bot;

insert into public.picks(league_id,user_id,week_number,locked_at)
select '21100000-0000-0000-0000-000000000003','21000000-0000-0000-0000-000000000001',w,now()
from generate_series(1,3) w;
insert into public.picks(league_id,user_id,week_number,locked_at)
select '21100000-0000-0000-0000-000000000003','21000000-0000-0000-0000-000000000002',w,now()
from generate_series(1,4) w;

insert into public.picks(league_id,user_id,week_number,locked_at)
select '21100000-0000-0000-0000-000000000004','21000000-0000-0000-0000-000000000001',w,now()
from generate_series(1,4) w;
insert into public.picks(league_id,user_id,week_number,locked_at)
select '21100000-0000-0000-0000-000000000004','21000000-0000-0000-0000-000000000002',w,now()
from generate_series(1,5) w;

update public.leagues set championship_trophy_id='command_cup'
where id='21100000-0000-0000-0000-000000000001';
insert into public.league_postseason_snapshots(
  league_id,season_key,sport_id,cut_week,cut_percent,eligible_human_count,qualifier_count
) values (
  '21100000-0000-0000-0000-000000000001','2026','cfb',4,50,8,4
);
insert into public.postseason_scorecards(
  league_id,user_id,season_key,week_number,phase,components,
  weekly_total,season_total_before,season_total_after
) values (
  '21100000-0000-0000-0000-000000000001','21000000-0000-0000-0000-000000000001',
  2026,4,'championship','[]',10,30,40
);

set local session_replication_role = origin;

do $test$
declare
  v jsonb;
  v_failed boolean;
  v_trophy_id uuid;
begin
  v:=private.compute_league_competitive_status('21100000-0000-0000-0000-000000000001');
  if v->>'status'<>'official' or (v->>'activeHumanCount')::int<>8 or (v->>'totalHumanCount')::int<>8 then
    raise exception 'FAIL official threshold or bot exclusion: %',v;
  end if;

  v:=private.compute_league_competitive_status('21100000-0000-0000-0000-000000000002');
  if v->>'status'<>'demo' or (v->>'activeHumanCount')::int<>7 then
    raise exception 'FAIL seven-player Demo threshold: %',v;
  end if;

  v:=private.compute_league_competitive_status('21100000-0000-0000-0000-000000000003');
  if coalesce((select (q->>'qualifies')::boolean from jsonb_array_elements(v->'qualification') q where q->>'userId'='21000000-0000-0000-0000-000000000001'),true)
     or not coalesce((select (q->>'qualifies')::boolean from jsonb_array_elements(v->'qualification') q where q->>'userId'='21000000-0000-0000-0000-000000000002'),false) then
    raise exception 'FAIL four-card floor: %',v;
  end if;

  v:=private.compute_league_competitive_status('21100000-0000-0000-0000-000000000004');
  if coalesce((select (q->>'qualifies')::boolean from jsonb_array_elements(v->'qualification') q where q->>'userId'='21000000-0000-0000-0000-000000000001'),true)
     or not coalesce((select (q->>'qualifies')::boolean from jsonb_array_elements(v->'qualification') q where q->>'userId'='21000000-0000-0000-0000-000000000002'),false) then
    raise exception 'FAIL 75 percent rule: %',v;
  end if;

  -- Demo rooms retain cards, picks, and results but permanent hardware is rejected.
  v_failed:=false;
  begin
    insert into public.league_trophies(league_id,season_year,trophy_type,winner_name,winner_user_id)
    values('21100000-0000-0000-0000-000000000002',2026,'championship','Demo Winner','21000000-0000-0000-0000-000000000001');
  exception when others then
    v_failed:=position('Demo league' in sqlerrm)>0;
  end;
  if not v_failed then raise exception 'FAIL Demo hardware write was not rejected'; end if;

  insert into public.league_trophies(league_id,season_year,trophy_type,winner_name,winner_user_id)
  values('21100000-0000-0000-0000-000000000001',2026,'championship','Official Winner','21000000-0000-0000-0000-000000000001')
  returning id into v_trophy_id;
  update public.league_trophies set trophy_design_id='command_cup' where id=v_trophy_id;
  insert into public.league_trophies(league_id,season_year,trophy_type,winner_name,winner_user_id)
  values('21100000-0000-0000-0000-000000000001',2026,'toilet_bowl','Official Toilet Winner','21000000-0000-0000-0000-000000000008');

  if (select count(*) from public.league_competitive_seasons where league_id='21100000-0000-0000-0000-000000000001' and status='official')<>1 then
    raise exception 'FAIL Official season receipt missing';
  end if;
  if (select count(*) from public.career_championship_receipts where source_key='league_trophy:'||v_trophy_id::text and user_id='21000000-0000-0000-0000-000000000001')<>1 then
    raise exception 'FAIL exact champion receipt missing';
  end if;

  update public.league_trophies set winner_name='Official Winner'
  where id=v_trophy_id;
  if (select count(*) from public.career_championship_receipts where source_key='league_trophy:'||v_trophy_id::text)<>1 then
    raise exception 'FAIL idempotency duplicated champion receipt';
  end if;
end;
$test$;

-- Public RPC authorization: member succeeds; nonmember and anonymous fail.
set local role authenticated;
select set_config('request.jwt.claim.sub','21000000-0000-0000-0000-000000000001',true);
do $$ begin
  if public.league_competitive_status('21100000-0000-0000-0000-000000000001')->>'sportId'<>'cfb' then
    raise exception 'FAIL member RPC or CFB decode';
  end if;
  if public.league_competitive_status('21100000-0000-0000-0000-000000000002')->>'sportId'<>'nfl' then
    raise exception 'FAIL NFL decode';
  end if;
  if public.league_competitive_status('21100000-0000-0000-0000-000000000003')->>'sportId'<>'ncaam' then
    raise exception 'FAIL NCAAM decode';
  end if;
  if public.league_competitive_status('21100000-0000-0000-0000-000000000004')->>'sportId'<>'ncaaw' then
    raise exception 'FAIL NCAAW decode';
  end if;
end $$;

-- The real multi-sport closeout entry point is repeatable with identical evidence,
-- writes one receipt, and rejects any later attempt to rewrite that evidence.
do $$ declare denied boolean:=false; begin
  perform public.record_season_closeout(
    '21100000-0000-0000-0000-000000000001',2026,'cfb','league','b21-rehearsal-v1','Fixture Champion',
    array['21000000-0000-0000-0000-000000000001'::uuid],
    array['21000000-0000-0000-0000-000000000008'::uuid],
    '{"source":"branch-rehearsal"}'::jsonb
  );
  perform public.record_season_closeout(
    '21100000-0000-0000-0000-000000000001',2026,'cfb','league','b21-rehearsal-v1','Fixture Champion',
    array['21000000-0000-0000-0000-000000000001'::uuid],
    array['21000000-0000-0000-0000-000000000008'::uuid],
    '{"source":"branch-rehearsal"}'::jsonb
  );
  if (select count(*) from public.league_season_closeouts where league_id='21100000-0000-0000-0000-000000000001' and season_key=2026)<>1 then
    raise exception 'FAIL closeout idempotency';
  end if;
  begin
    perform public.record_season_closeout(
      '21100000-0000-0000-0000-000000000001',2026,'cfb','league','different-evidence','Fixture Champion',
      array['21000000-0000-0000-0000-000000000001'::uuid],
      array['21000000-0000-0000-0000-000000000008'::uuid],
      '{}'::jsonb
    );
  exception when others then denied:=position('different evidence' in sqlerrm)>0; end;
  if not denied then raise exception 'FAIL closeout evidence rewrite was not rejected'; end if;
end $$;

select set_config('request.jwt.claim.sub','21000000-0000-0000-0000-000000000099',true);
do $$ declare denied boolean:=false; begin
  begin perform public.league_competitive_status('21100000-0000-0000-0000-000000000001');
  exception when others then denied:=position('League membership required' in sqlerrm)>0; end;
  if not denied then raise exception 'FAIL nonmember RPC access'; end if;
end $$;

reset role;
set local role anon;
select set_config('request.jwt.claim.sub','',true);
do $$ declare denied boolean:=false; begin
  begin perform public.league_competitive_status('21100000-0000-0000-0000-000000000001');
  exception when others then denied:=true; end;
  if not denied then raise exception 'FAIL anonymous RPC access'; end if;
end $$;

reset role;

select jsonb_build_object(
  'status','PASS',
  'memberOnlyRpc',true,
  'sevenIsDemo',true,
  'eightIsOfficial',true,
  'minimumFourLockedCards',true,
  'seventyFivePercentRequired',true,
  'botsExcluded',true,
  'demoHardwareRejected',true,
  'officialReceiptExact',true,
  'closeoutReceiptIdempotent',true,
  'sports',jsonb_build_array('cfb','nfl','ncaam','ncaaw')
) as build21_branch_rehearsal;

rollback;
