-- Disposable branch only. Proves deleting an Auth login cannot erase the
-- durable profile, Bowl/CFP entry, or explanatory postseason scorecard.

begin;

do $$
declare
  v_departing uuid := gen_random_uuid();
  v_successor uuid := gen_random_uuid();
  v_league uuid := gen_random_uuid();
  v_count integer;
begin
  insert into auth.users (id, email, created_at, updated_at) values
    (v_departing, 'departing-postseason@example.invalid', now(), now()),
    (v_successor, 'successor-postseason@example.invalid', now(), now());

  update public.profiles set display_name = 'Departing Postseason Player'
    where id = v_departing;
  update public.profiles set display_name = 'Successor'
    where id = v_successor;

  insert into public.leagues (
    id, name, code, commissioner_id, regular_season_weeks
  ) values (
    v_league, 'Postseason Tombstone Proof', 'PSTOMB', v_successor, 14
  );
  insert into public.memberships (league_id, user_id, role, division) values
    (v_league, v_departing, 'player', 'North'),
    (v_league, v_successor, 'commissioner', 'South');

  insert into public.cfb_postseason_entries (
    league_id, user_id, season_key, bowl_picks
  ) values (
    v_league, v_departing, 2026, '{"bowl-1":"home"}'::jsonb
  );
  insert into public.postseason_scorecards (
    league_id, user_id, season_key, week_number, phase, components,
    weekly_total, season_total_before, season_total_after
  ) values (
    v_league, v_departing, 2026, 16, 'bowl_opening',
    '[{"label":"Bowl","points":8}]'::jsonb, 8, 20, 28
  );

  delete from auth.users where id = v_departing;

  select count(*) into v_count from public.profiles where id = v_departing;
  if v_count <> 1 then raise exception 'FAIL: profile tombstone cascaded'; end if;
  select count(*) into v_count from public.cfb_postseason_entries where user_id = v_departing;
  if v_count <> 1 then raise exception 'FAIL: postseason entry cascaded'; end if;
  select count(*) into v_count from public.postseason_scorecards where user_id = v_departing;
  if v_count <> 1 then raise exception 'FAIL: postseason scorecard cascaded'; end if;
end;
$$;

rollback;

select 'PASS' as postseason_tombstone_auth_delete_harness;
