-- Defense-in-depth for the native NFL Final Thirteen.
-- Rejects impossible bracket paths at the database boundary and applies the
-- same suspended-account barrier used by the rest of War Room.
begin;

do $policies$
declare v_table text;
begin
  foreach v_table in array array[
    'nfl_postseason_slates',
    'nfl_postseason_entries',
    'nfl_postseason_results',
    'nfl_postseason_scorecards'
  ] loop
    execute format('drop policy if exists "Active accounts only" on public.%I', v_table);
    execute format(
      'create policy "Active accounts only" on public.%I as restrictive for all to authenticated using ((select private.is_active_account())) with check ((select private.is_active_account()))',
      v_table
    );
  end loop;
end
$policies$;

create or replace function public.assert_nfl_postseason_path(
  p_teams jsonb,
  p_picks jsonb,
  p_require_complete boolean default false
) returns void
language plpgsql
immutable
security invoker
set search_path=public,pg_temp
as $function$
declare
  v_conf text;
  v_prefix text;
  v_seed1 text;
  v_seed2 text;
  v_seed3 text;
  v_seed4 text;
  v_seed5 text;
  v_seed6 text;
  v_seed7 text;
  v_wc2 text;
  v_wc3 text;
  v_wc4 text;
  v_lowest text;
  v_other1 text;
  v_other2 text;
  v_div1 text;
  v_div2 text;
  v_afc text;
  v_nfc text;
begin
  if jsonb_typeof(p_picks) <> 'object' then
    raise exception 'NFL bracket decisions must be a JSON object';
  end if;

  if exists(
    select 1 from jsonb_object_keys(p_picks) k
    where k not in (
      'AFC-WC-2-7','AFC-WC-3-6','AFC-WC-4-5',
      'NFC-WC-2-7','NFC-WC-3-6','NFC-WC-4-5',
      'AFC-DIV-1','AFC-DIV-2','NFC-DIV-1','NFC-DIV-2',
      'AFC-CONF','NFC-CONF','SUPER-BOWL'
    )
  ) then
    raise exception 'Unknown NFL bracket decision';
  end if;

  if p_require_complete and (select count(*) from jsonb_object_keys(p_picks)) <> 13 then
    raise exception 'The Final Thirteen requires all 13 decisions';
  end if;

  foreach v_conf in array array['AFC','NFC'] loop
    v_prefix := v_conf || '-';
    select
      max(t->>'id') filter(where (t->>'seed')::integer=1),
      max(t->>'id') filter(where (t->>'seed')::integer=2),
      max(t->>'id') filter(where (t->>'seed')::integer=3),
      max(t->>'id') filter(where (t->>'seed')::integer=4),
      max(t->>'id') filter(where (t->>'seed')::integer=5),
      max(t->>'id') filter(where (t->>'seed')::integer=6),
      max(t->>'id') filter(where (t->>'seed')::integer=7)
    into v_seed1,v_seed2,v_seed3,v_seed4,v_seed5,v_seed6,v_seed7
    from jsonb_array_elements(p_teams) t
    where t->>'conference'=v_conf;

    if p_picks ? (v_prefix || 'WC-2-7') and p_picks->>(v_prefix || 'WC-2-7') not in (v_seed2,v_seed7) then
      raise exception '% Wild Card 2/7 winner did not play in that game', v_conf;
    end if;
    if p_picks ? (v_prefix || 'WC-3-6') and p_picks->>(v_prefix || 'WC-3-6') not in (v_seed3,v_seed6) then
      raise exception '% Wild Card 3/6 winner did not play in that game', v_conf;
    end if;
    if p_picks ? (v_prefix || 'WC-4-5') and p_picks->>(v_prefix || 'WC-4-5') not in (v_seed4,v_seed5) then
      raise exception '% Wild Card 4/5 winner did not play in that game', v_conf;
    end if;

    if p_picks ? (v_prefix || 'WC-2-7')
       and p_picks ? (v_prefix || 'WC-3-6')
       and p_picks ? (v_prefix || 'WC-4-5') then
      v_wc2 := p_picks->>(v_prefix || 'WC-2-7');
      v_wc3 := p_picks->>(v_prefix || 'WC-3-6');
      v_wc4 := p_picks->>(v_prefix || 'WC-4-5');

      select t->>'id' into v_lowest
      from jsonb_array_elements(p_teams) t
      where t->>'id' in (v_wc2,v_wc3,v_wc4)
      order by (t->>'seed')::integer desc
      limit 1;

      select min(value),max(value) into v_other1,v_other2
      from unnest(array[v_wc2,v_wc3,v_wc4]) value
      where value<>v_lowest;

      if p_picks ? (v_prefix || 'DIV-1') and p_picks->>(v_prefix || 'DIV-1') not in (v_seed1,v_lowest) then
        raise exception '% Divisional 1 winner did not play in that reseeded game', v_conf;
      end if;
      if p_picks ? (v_prefix || 'DIV-2') and p_picks->>(v_prefix || 'DIV-2') not in (v_other1,v_other2) then
        raise exception '% Divisional 2 winner did not play in that reseeded game', v_conf;
      end if;

      if p_picks ? (v_prefix || 'DIV-1') and p_picks ? (v_prefix || 'DIV-2') then
        v_div1 := p_picks->>(v_prefix || 'DIV-1');
        v_div2 := p_picks->>(v_prefix || 'DIV-2');
        if p_picks ? (v_prefix || 'CONF') and p_picks->>(v_prefix || 'CONF') not in (v_div1,v_div2) then
          raise exception '% champion did not reach the conference championship', v_conf;
        end if;
      elsif p_picks ? (v_prefix || 'CONF') then
        raise exception '% championship cannot be recorded before both Divisional games', v_conf;
      end if;
    elsif p_picks ? (v_prefix || 'DIV-1') or p_picks ? (v_prefix || 'DIV-2') or p_picks ? (v_prefix || 'CONF') then
      raise exception '% Divisional results require all three Wild Card winners', v_conf;
    end if;
  end loop;

  if p_picks ? 'AFC-CONF' and p_picks ? 'NFC-CONF' then
    v_afc := p_picks->>'AFC-CONF';
    v_nfc := p_picks->>'NFC-CONF';
    if p_picks ? 'SUPER-BOWL' and p_picks->>'SUPER-BOWL' not in (v_afc,v_nfc) then
      raise exception 'Super Bowl winner did not reach the Super Bowl';
    end if;
  elsif p_picks ? 'SUPER-BOWL' then
    raise exception 'Super Bowl result requires both conference champions';
  end if;
end
$function$;

revoke all on function public.assert_nfl_postseason_path(jsonb,jsonb,boolean) from public,anon,authenticated;

create or replace function public.validate_nfl_postseason_entry_path() returns trigger
language plpgsql
security invoker
set search_path=public,pg_temp
as $function$
declare v_teams jsonb;
begin
  if not (select private.is_active_account()) then
    raise exception 'An active War Room account is required';
  end if;
  select teams into v_teams from public.nfl_postseason_slates
  where league_id=new.league_id and season_key=new.season_key;
  if v_teams is null then raise exception 'Official NFL playoff field not found'; end if;
  perform public.assert_nfl_postseason_path(v_teams,new.picks,true);
  return new;
end
$function$;

create or replace function public.validate_nfl_postseason_result_path() returns trigger
language plpgsql
security invoker
set search_path=public,pg_temp
as $function$
declare v_teams jsonb;
begin
  if not (select private.is_active_account()) then
    raise exception 'An active War Room account is required';
  end if;
  select teams into v_teams from public.nfl_postseason_slates
  where league_id=new.league_id and season_key=new.season_key;
  if v_teams is null then raise exception 'Official NFL playoff field not found'; end if;
  perform public.assert_nfl_postseason_path(v_teams,new.winners,false);
  return new;
end
$function$;

revoke all on function public.validate_nfl_postseason_entry_path() from public,anon,authenticated;
revoke all on function public.validate_nfl_postseason_result_path() from public,anon,authenticated;

drop trigger if exists validate_nfl_postseason_entry_path on public.nfl_postseason_entries;
create trigger validate_nfl_postseason_entry_path
before insert or update of picks on public.nfl_postseason_entries
for each row execute function public.validate_nfl_postseason_entry_path();

drop trigger if exists validate_nfl_postseason_result_path on public.nfl_postseason_results;
create trigger validate_nfl_postseason_result_path
before insert or update of winners on public.nfl_postseason_results
for each row execute function public.validate_nfl_postseason_result_path();

commit;
