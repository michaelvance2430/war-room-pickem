-- Durable, idempotent CFB season closeout receipt.
-- The receipt is written only after the final postseason scorecard and both
-- league-bracket trophies exist. Client-local ceremony flags are presentation only.

create table if not exists public.league_season_closeouts (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  season_key integer not null,
  sport_id text not null default 'cfb' check (sport_id in ('cfb')),
  readiness_version text not null,
  national_champion text not null,
  league_champion_id uuid not null references public.profiles(id),
  toilet_bowl_champion_id uuid not null references public.profiles(id),
  award_manifest jsonb not null default '{}'::jsonb,
  closed_by uuid not null references public.profiles(id),
  closed_at timestamptz not null default now(),
  unique (league_id, season_key)
);

create index if not exists league_season_closeouts_league_idx
  on public.league_season_closeouts(league_id, season_key desc);

alter table public.league_season_closeouts enable row level security;

drop policy if exists "Members read season closeouts" on public.league_season_closeouts;
create policy "Members read season closeouts"
  on public.league_season_closeouts for select to authenticated
  using (exists (
    select 1 from public.memberships m
    where m.league_id=league_season_closeouts.league_id
      and m.user_id=(select auth.uid())
  ));

grant select on public.league_season_closeouts to authenticated;
revoke all on public.league_season_closeouts from anon;

create or replace function public.record_cfb_season_closeout(
  p_league_id uuid,
  p_season_key integer,
  p_readiness_version text,
  p_national_champion text,
  p_league_champion_id uuid,
  p_toilet_bowl_champion_id uuid,
  p_award_manifest jsonb default '{}'::jsonb
) returns public.league_season_closeouts
language plpgsql security definer
set search_path=public,pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_league public.leagues%rowtype;
  v_row public.league_season_closeouts%rowtype;
begin
  if v_uid is null then raise exception 'Authentication required'; end if;
  select * into v_league from public.leagues where id=p_league_id for update;
  if not found or coalesce(v_league.sport_id,'cfb')<>'cfb' then
    raise exception 'CFB league required';
  end if;
  if not exists (
    select 1 from public.memberships m
    where m.league_id=p_league_id and m.user_id=v_uid
      and (m.role='commissioner' or coalesce(m.is_deputy,false))
  ) then raise exception 'Commissioner or deputy required'; end if;
  if coalesce(trim(p_readiness_version),'')='' or coalesce(trim(p_national_champion),'')='' then
    raise exception 'Closeout evidence is incomplete';
  end if;
  if not exists (
    select 1 from public.league_postseason_snapshots s
    where s.league_id=p_league_id and s.season_key=p_season_key::text
  ) then raise exception 'Durable postseason snapshot is missing'; end if;
  if not exists (
    select 1 from public.postseason_scorecards s
    where s.league_id=p_league_id and s.season_key=p_season_key
      and s.phase='championship'
  ) then raise exception 'Final postseason scorecard is missing'; end if;
  if not exists (
    select 1 from public.league_trophies t
    where t.league_id=p_league_id and t.season_year=p_season_key
      and t.trophy_type='championship' and t.winner_user_id=p_league_champion_id
  ) then raise exception 'Championship trophy is missing or mismatched'; end if;
  if not exists (
    select 1 from public.league_trophies t
    where t.league_id=p_league_id and t.season_year=p_season_key
      and t.trophy_type='toilet_bowl' and t.winner_user_id=p_toilet_bowl_champion_id
  ) then raise exception 'Toilet Bowl trophy is missing or mismatched'; end if;

  insert into public.league_season_closeouts(
    league_id,season_key,readiness_version,national_champion,
    league_champion_id,toilet_bowl_champion_id,award_manifest,closed_by
  ) values (
    p_league_id,p_season_key,p_readiness_version,trim(p_national_champion),
    p_league_champion_id,p_toilet_bowl_champion_id,coalesce(p_award_manifest,'{}'::jsonb),v_uid
  ) on conflict(league_id,season_key) do nothing;

  select * into v_row from public.league_season_closeouts
  where league_id=p_league_id and season_key=p_season_key;
  if v_row.readiness_version<>p_readiness_version then
    raise exception 'Season already closed with different evidence';
  end if;
  return v_row;
end;
$$;

revoke all on function public.record_cfb_season_closeout(uuid,integer,text,text,uuid,uuid,jsonb)
  from public,anon;
grant execute on function public.record_cfb_season_closeout(uuid,integer,text,text,uuid,uuid,jsonb)
  to authenticated;

notify pgrst, 'reload schema';
