-- Official CFB postseason results. Commissioner-authored, member-readable, append-only.
create table if not exists public.cfb_postseason_results (
  league_id uuid not null references public.leagues(id) on delete cascade,
  season_key integer not null,
  bowl_results jsonb not null default '{}'::jsonb check (jsonb_typeof(bowl_results)='object'),
  cfp_results jsonb not null default '{}'::jsonb check (jsonb_typeof(cfp_results)='object'),
  updated_at timestamptz not null default now(),
  primary key (league_id,season_key),
  foreign key (league_id,season_key) references public.cfb_postseason_slates(league_id,season_key) on delete cascade
);

alter table public.cfb_postseason_results enable row level security;
revoke all on table public.cfb_postseason_results from public,anon,authenticated;
grant select,insert,update on table public.cfb_postseason_results to authenticated;

create policy "Members read CFB postseason results" on public.cfb_postseason_results for select to authenticated
using (public.is_league_member(league_id));
create policy "Commissioner creates CFB postseason results" on public.cfb_postseason_results for insert to authenticated
with check (exists(select 1 from public.leagues l where l.id=league_id and l.commissioner_id=(select auth.uid())));
create policy "Commissioner updates CFB postseason results" on public.cfb_postseason_results for update to authenticated
using (exists(select 1 from public.leagues l where l.id=league_id and l.commissioner_id=(select auth.uid())))
with check (exists(select 1 from public.leagues l where l.id=league_id and l.commissioner_id=(select auth.uid())));

create or replace function public.validate_and_score_cfb_postseason_results() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $function$
declare v_slate public.cfb_postseason_slates%rowtype; v_bowl_count integer; v_cfp_count integer;
  v_seeds text[]; v_raw integer;
begin
  if not exists(select 1 from public.leagues l where l.id=new.league_id and l.commissioner_id=(select auth.uid())) then
    raise exception 'Commissioner postseason authority required';
  end if;
  select * into v_slate from public.cfb_postseason_slates where league_id=new.league_id and season_key=new.season_key;
  if not found then raise exception 'Publish the postseason slate first'; end if;
  if tg_op='UPDATE' and (exists(select 1 from jsonb_each_text(old.bowl_results) o where new.bowl_results->>o.key is distinct from o.value) or
    exists(select 1 from jsonb_each_text(old.cfp_results) o where new.cfp_results->>o.key is distinct from o.value)) then
    raise exception 'Recorded postseason winners are permanent';
  end if;
  if exists(select 1 from jsonb_each_text(new.bowl_results) r where not exists(
    select 1 from jsonb_array_elements(v_slate.bowl_games) g where g->>'id'=r.key and r.value in (g->>'away',g->>'home')
  )) then raise exception 'Invalid bowl result'; end if;
  if exists(select 1 from jsonb_object_keys(new.cfp_results) k where k not in ('r1a','r1b','r1c','r1d','q1','q2','q3','q4','s1','s2','final')) then
    raise exception 'Invalid CFP game id';
  end if;
  select array_agg(value#>>'{}' order by ord) into v_seeds from jsonb_array_elements(v_slate.cfp_seeds) with ordinality s(value,ord);
  if new.cfp_results ? 'r1a' and new.cfp_results->>'r1a' not in (v_seeds[5],v_seeds[12]) then raise exception 'Invalid r1a winner'; end if;
  if new.cfp_results ? 'r1b' and new.cfp_results->>'r1b' not in (v_seeds[8],v_seeds[9]) then raise exception 'Invalid r1b winner'; end if;
  if new.cfp_results ? 'r1c' and new.cfp_results->>'r1c' not in (v_seeds[7],v_seeds[10]) then raise exception 'Invalid r1c winner'; end if;
  if new.cfp_results ? 'r1d' and new.cfp_results->>'r1d' not in (v_seeds[6],v_seeds[11]) then raise exception 'Invalid r1d winner'; end if;
  if new.cfp_results ? 'q1' and (not new.cfp_results ? 'r1a' or new.cfp_results->>'q1' not in (v_seeds[4],new.cfp_results->>'r1a')) then raise exception 'Invalid q1 winner'; end if;
  if new.cfp_results ? 'q2' and (not new.cfp_results ? 'r1b' or new.cfp_results->>'q2' not in (v_seeds[1],new.cfp_results->>'r1b')) then raise exception 'Invalid q2 winner'; end if;
  if new.cfp_results ? 'q3' and (not new.cfp_results ? 'r1c' or new.cfp_results->>'q3' not in (v_seeds[2],new.cfp_results->>'r1c')) then raise exception 'Invalid q3 winner'; end if;
  if new.cfp_results ? 'q4' and (not new.cfp_results ? 'r1d' or new.cfp_results->>'q4' not in (v_seeds[3],new.cfp_results->>'r1d')) then raise exception 'Invalid q4 winner'; end if;
  if new.cfp_results ? 's1' and (not (new.cfp_results ? 'q1' and new.cfp_results ? 'q2') or new.cfp_results->>'s1' not in (new.cfp_results->>'q1',new.cfp_results->>'q2')) then raise exception 'Invalid s1 winner'; end if;
  if new.cfp_results ? 's2' and (not (new.cfp_results ? 'q3' and new.cfp_results ? 'q4') or new.cfp_results->>'s2' not in (new.cfp_results->>'q3',new.cfp_results->>'q4')) then raise exception 'Invalid s2 winner'; end if;
  if new.cfp_results ? 'final' and (not (new.cfp_results ? 's1' and new.cfp_results ? 's2') or new.cfp_results->>'final' not in (new.cfp_results->>'s1',new.cfp_results->>'s2')) then raise exception 'Invalid champion'; end if;
  new.updated_at=now();
  select count(*) into v_bowl_count from jsonb_object_keys(new.bowl_results);
  select count(*) into v_cfp_count from jsonb_object_keys(new.cfp_results);
  update public.cfb_postseason_entries e set bowl_score=case when v_bowl_count=25 then
    case when e.dead_hand then case when coalesce((select sum((e.bowl_allocations->>r.key)::integer) from jsonb_each_text(new.bowl_results) r where e.bowl_picks->>r.key=r.value),0)>=60
      then round(coalesce((select sum((e.bowl_allocations->>r.key)::integer) from jsonb_each_text(new.bowl_results) r where e.bowl_picks->>r.key=r.value),0)*1.5)::integer
      else round(coalesce((select sum((e.bowl_allocations->>r.key)::integer) from jsonb_each_text(new.bowl_results) r where e.bowl_picks->>r.key=r.value),0)*0.5)::integer end
    else coalesce((select sum((e.bowl_allocations->>r.key)::integer) from jsonb_each_text(new.bowl_results) r where e.bowl_picks->>r.key=r.value),0) end else null end,
    cfp_score=case when v_cfp_count=11 then coalesce((select sum(case when r.key like 'r1%' then 1 when r.key like 'q%' then 2 when r.key like 's%' then 4 when r.key='final' then 8 else 0 end) from jsonb_each_text(new.cfp_results) r where e.cfp_picks->>r.key=r.value),0) else null end,
    updated_at=now()
  where e.league_id=new.league_id and e.season_key=new.season_key;
  return new;
end;$function$;

revoke all on function public.validate_and_score_cfb_postseason_results() from public,anon,authenticated;
create trigger validate_and_score_cfb_postseason_results before insert or update on public.cfb_postseason_results
for each row execute function public.validate_and_score_cfb_postseason_results();
