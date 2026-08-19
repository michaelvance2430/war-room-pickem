-- Creator-only bot postseason seeding. Never accepts a production league.
create or replace function public.seed_foundry_cfb_postseason(p_league_id uuid,p_season_key integer)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_uid uuid:=(select auth.uid()); v_slate public.cfb_postseason_slates%rowtype; v_bot record;
  v_picks jsonb; v_allocations jsonb; v_cfp jsonb; v_seeds text[]; v_count integer:=0;
  r1a text; r1b text; r1c text; r1d text; q1 text; q2 text; q3 text; q4 text; s1 text; s2 text; champion text;
begin
  if v_uid<>'09544d2b-6eca-4131-a321-c000586c9029'::uuid or not exists(
    select 1 from public.leagues l where l.id=p_league_id and l.mode='foundry' and l.commissioner_id=v_uid
  ) then raise exception 'Creator Foundry only'; end if;
  if exists(select 1 from public.memberships where league_id=p_league_id and not is_bot and user_id<>v_uid) then raise exception 'Human roster detected'; end if;
  select * into v_slate from public.cfb_postseason_slates where league_id=p_league_id and season_key=p_season_key;
  if not found then raise exception 'Publish the Foundry postseason slate first'; end if;
  select array_agg(value#>>'{}' order by ord) into v_seeds from jsonb_array_elements(v_slate.cfp_seeds) with ordinality s(value,ord);
  for v_bot in select m.user_id,row_number() over(order by m.user_id) n from public.memberships m where m.league_id=p_league_id and m.is_bot loop
    select jsonb_object_agg(g->>'id',case when mod(abs(hashtext(v_bot.user_id::text||(g->>'id'))),2)=0 then g->>'away' else g->>'home' end),
      jsonb_object_agg(g->>'id',4) into v_picks,v_allocations from jsonb_array_elements(v_slate.bowl_games) g;
    r1a:=case when mod(v_bot.n,2)=0 then v_seeds[5] else v_seeds[12] end;
    r1b:=case when mod(v_bot.n,3)=0 then v_seeds[8] else v_seeds[9] end;
    r1c:=case when mod(v_bot.n,4)=0 then v_seeds[7] else v_seeds[10] end;
    r1d:=case when mod(v_bot.n,5)=0 then v_seeds[6] else v_seeds[11] end;
    q1:=case when mod(v_bot.n,2)=0 then v_seeds[4] else r1a end;
    q2:=case when mod(v_bot.n,3)=0 then v_seeds[1] else r1b end;
    q3:=case when mod(v_bot.n,4)=0 then v_seeds[2] else r1c end;
    q4:=case when mod(v_bot.n,5)=0 then v_seeds[3] else r1d end;
    s1:=case when mod(v_bot.n,2)=0 then q1 else q2 end;
    s2:=case when mod(v_bot.n,3)=0 then q3 else q4 end;
    champion:=case when mod(v_bot.n,2)=0 then s1 else s2 end;
    v_cfp:=jsonb_build_object('r1a',r1a,'r1b',r1b,'r1c',r1c,'r1d',r1d,'q1',q1,'q2',q2,'q3',q3,'q4',q4,'s1',s1,'s2',s2,'final',champion);
    insert into public.cfb_postseason_entries(league_id,user_id,season_key,bowl_picks,bowl_allocations,dead_hand,bowl_locked_at,cfp_picks,cfp_locked_at)
    values(p_league_id,v_bot.user_id,p_season_key,v_picks,v_allocations,mod(v_bot.n,5)=0,now(),v_cfp,null)
    on conflict(league_id,user_id,season_key) do nothing;
    if found then v_count:=v_count+1; end if;
  end loop;
  return jsonb_build_object('ok',true,'botsSeeded',v_count,'seasonKey',p_season_key);
end;$function$;

revoke all on function public.seed_foundry_cfb_postseason(uuid,integer) from public,anon;
grant execute on function public.seed_foundry_cfb_postseason(uuid,integer) to authenticated;

create or replace function public.get_foundry_cfb_postseason_standings(p_league_id uuid,p_season_key integer)
returns table(user_id uuid,display_name text,dead_hand boolean,bowl_locked boolean,cfp_locked boolean,bowl_picks jsonb,cfp_picks jsonb,bowl_score integer,cfp_score integer,total_score integer)
language plpgsql security definer set search_path=public,pg_temp as $function$
begin
  if (select auth.uid())<>'09544d2b-6eca-4131-a321-c000586c9029'::uuid or not exists(
    select 1 from public.leagues l where l.id=p_league_id and l.mode='foundry' and l.commissioner_id=(select auth.uid())
  ) then raise exception 'Creator Foundry only'; end if;
  return query select e.user_id,coalesce(p.display_name,'Foundry Bot'),e.dead_hand,e.bowl_locked_at is not null,e.cfp_locked_at is not null,e.bowl_picks,e.cfp_picks,e.bowl_score,e.cfp_score,
    coalesce(e.bowl_score,0)+coalesce(e.cfp_score,0)
  from public.cfb_postseason_entries e join public.memberships m on m.league_id=e.league_id and m.user_id=e.user_id
  left join public.profiles p on p.id=e.user_id
  where e.league_id=p_league_id and e.season_key=p_season_key
  order by coalesce(e.bowl_score,0)+coalesce(e.cfp_score,0) desc,coalesce(p.display_name,'Foundry Bot');
end;$function$;

revoke all on function public.get_foundry_cfb_postseason_standings(uuid,integer) from public,anon;
grant execute on function public.get_foundry_cfb_postseason_standings(uuid,integer) to authenticated;
