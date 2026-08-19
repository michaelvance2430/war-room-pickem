-- Creator-only NFL postseason bot brackets for end-to-end Foundry QA.
create or replace function public.seed_foundry_nfl_postseason(
  p_league_id uuid,
  p_season_key integer
) returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $function$
declare
  v_uid uuid := (select auth.uid());
  v_teams jsonb;
  v_picks jsonb;
  v_seeded integer := 0;
begin
  if v_uid <> '09544d2b-6eca-4131-a321-c000586c9029'::uuid then
    raise exception 'Creator Foundry only';
  end if;
  if not exists(
    select 1 from public.leagues l
    where l.id=p_league_id
      and l.mode='foundry'
      and l.sport_id='nfl'
      and l.commissioner_id=v_uid
  ) then
    raise exception 'Creator NFL Foundry only';
  end if;
  if exists(
    select 1 from public.memberships m
    where m.league_id=p_league_id and not m.is_bot and m.user_id<>v_uid
  ) then
    raise exception 'Human roster detected';
  end if;

  select teams into v_teams
  from public.nfl_postseason_slates
  where league_id=p_league_id and season_key=p_season_key;
  if v_teams is null then raise exception 'Publish the Foundry NFL playoff field first'; end if;

  with seeds as (
    select t->>'conference' conference,(t->>'seed')::integer seed,t->>'id' team_id
    from jsonb_array_elements(v_teams) t
  )
  select jsonb_build_object(
    'AFC-WC-2-7',max(team_id) filter(where conference='AFC' and seed=2),
    'AFC-WC-3-6',max(team_id) filter(where conference='AFC' and seed=3),
    'AFC-WC-4-5',max(team_id) filter(where conference='AFC' and seed=4),
    'NFC-WC-2-7',max(team_id) filter(where conference='NFC' and seed=2),
    'NFC-WC-3-6',max(team_id) filter(where conference='NFC' and seed=3),
    'NFC-WC-4-5',max(team_id) filter(where conference='NFC' and seed=4),
    'AFC-DIV-1',max(team_id) filter(where conference='AFC' and seed=1),
    'AFC-DIV-2',max(team_id) filter(where conference='AFC' and seed=2),
    'NFC-DIV-1',max(team_id) filter(where conference='NFC' and seed=1),
    'NFC-DIV-2',max(team_id) filter(where conference='NFC' and seed=2),
    'AFC-CONF',max(team_id) filter(where conference='AFC' and seed=1),
    'NFC-CONF',max(team_id) filter(where conference='NFC' and seed=1),
    'SUPER-BOWL',max(team_id) filter(where conference='AFC' and seed=1)
  ) into v_picks
  from seeds;

  perform public.assert_nfl_postseason_path(v_teams,v_picks,true);

  insert into public.nfl_postseason_entries(
    league_id,user_id,season_key,picks,used_jdam,locked_at,updated_at
  )
  select p_league_id,m.user_id,p_season_key,v_picks,false,now(),now()
  from public.memberships m
  where m.league_id=p_league_id and m.is_bot
  on conflict(league_id,user_id,season_key) do update
    set picks=excluded.picks,used_jdam=false,locked_at=excluded.locked_at,updated_at=now()
    where public.nfl_postseason_entries.locked_at is null;
  select count(*)::integer into v_seeded
  from public.nfl_postseason_entries e
  join public.memberships m on m.league_id=e.league_id and m.user_id=e.user_id
  where e.league_id=p_league_id
    and e.season_key=p_season_key
    and m.is_bot
    and e.locked_at is not null;

  return jsonb_build_object(
    'ok',true,
    'seasonKey',p_season_key,
    'botsSeeded',v_seeded,
    'decisionCount',13
  );
end
$function$;

revoke all on function public.seed_foundry_nfl_postseason(uuid,integer) from public,anon;
grant execute on function public.seed_foundry_nfl_postseason(uuid,integer) to authenticated;
