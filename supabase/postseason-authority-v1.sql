-- Durable Championship / Toilet Bowl cut snapshot.
-- The deferred score trigger freezes fields after membership scoring updates,
-- and aborts the cut-week transaction if the freeze cannot be committed.

create table if not exists public.league_postseason_snapshots (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues(id) on delete cascade,
  season_key text not null,
  sport_id text not null,
  cut_week integer not null,
  frozen_at timestamptz not null default now(),
  cut_percent integer not null check (cut_percent between 0 and 100),
  eligible_human_count integer not null check (eligible_human_count >= 0),
  qualifier_count integer not null check (qualifier_count >= 0),
  toilet_bowl_active boolean not null default false,
  snapshot_version integer not null default 1,
  creation_reason text not null default 'cut_week_scored'
    check (creation_reason in ('cut_week_scored','manual_repair','system_backfill')),
  created_by uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, season_key)
);

create table if not exists public.league_postseason_participants (
  id uuid primary key default gen_random_uuid(),
  snapshot_id uuid not null references public.league_postseason_snapshots(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  display_name_snapshot text not null,
  field text not null check (field in ('championship','toilet','eliminated')),
  seed integer check (seed is null or seed >= 1),
  first_round_bye boolean not null default false,
  division_snapshot text,
  standings_rank_at_cut integer,
  season_points_at_cut integer,
  created_at timestamptz not null default now(),
  unique (snapshot_id, user_id)
);

create index if not exists league_postseason_snapshots_league_idx
  on public.league_postseason_snapshots(league_id, season_key);
create index if not exists league_postseason_participants_snapshot_idx
  on public.league_postseason_participants(snapshot_id, field, seed);

alter table public.league_postseason_snapshots enable row level security;
alter table public.league_postseason_participants enable row level security;

drop policy if exists "Members read postseason snapshots" on public.league_postseason_snapshots;
create policy "Members read postseason snapshots"
  on public.league_postseason_snapshots for select to authenticated
  using (exists (
    select 1 from public.memberships m
    where m.league_id=league_postseason_snapshots.league_id and m.user_id=(select auth.uid())
  ));

drop policy if exists "Members read postseason participants" on public.league_postseason_participants;
create policy "Members read postseason participants"
  on public.league_postseason_participants for select to authenticated
  using (exists (
    select 1 from public.league_postseason_snapshots s
    join public.memberships m on m.league_id=s.league_id
    where s.id=league_postseason_participants.snapshot_id and m.user_id=(select auth.uid())
  ));

grant select on public.league_postseason_snapshots to authenticated;
grant select on public.league_postseason_participants to authenticated;
revoke all on public.league_postseason_snapshots from anon;
revoke all on public.league_postseason_participants from anon;

create or replace function public.freeze_postseason_snapshot_if_absent(
  p_league_id uuid,
  p_season_key text default null
) returns uuid
language plpgsql security definer
set search_path=public,pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_league public.leagues%rowtype;
  v_snapshot uuid;
  v_key text;
  v_n integer;
  v_q integer;
  v_conference_count integer;
  v_smallest_conference integer;
  v_unassigned integer;
begin
  select * into v_league from public.leagues where id=p_league_id for update;
  if not found then raise exception 'League not found'; end if;
  if v_uid is null or not exists (
    select 1 from public.memberships m
    where m.league_id=p_league_id and m.user_id=v_uid
      and (m.role='commissioner' or coalesce(m.is_deputy,false))
  ) then raise exception 'Commissioner or deputy required to freeze postseason'; end if;

  v_key := coalesce(nullif(trim(p_season_key),''),
    case when extract(month from current_date)<7
      then (extract(year from current_date)::integer-1)::text
      else extract(year from current_date)::integer::text end);

  select id into v_snapshot from public.league_postseason_snapshots
  where league_id=p_league_id and season_key=v_key;
  if v_snapshot is not null then return v_snapshot; end if;

  select count(*) into v_n from public.memberships
  where league_id=p_league_id and not coalesce(is_bot,false);
  if v_n>32 then
    select count(distinct division),min(conference_size),count(*) filter(where division is null)
      into v_conference_count,v_smallest_conference,v_unassigned
    from (
      select division,count(*) over(partition by division) conference_size
      from public.memberships
      where league_id=p_league_id and not coalesce(is_bot,false)
    ) conference_roster;
    if v_unassigned>0 or v_conference_count<>4 then
      raise exception 'Large leagues require every player assigned across exactly four conferences';
    end if;
    if v_smallest_conference<8 then
      raise exception 'Each conference needs at least eight players before the postseason cut';
    end if;
  end if;
  v_q := case when v_n>32 then 16 when v_n<2 then 0
    else least(16, v_n, greatest(2, ceil(v_n*(100-v_league.cut_percent)/100.0)::integer)) end;

  insert into public.league_postseason_snapshots(
    league_id,season_key,sport_id,cut_week,cut_percent,eligible_human_count,
    qualifier_count,toilet_bowl_active,created_by,metadata
  ) values (
    p_league_id,v_key,coalesce(v_league.sport_id,'cfb'),v_league.regular_season_weeks,
    case when v_n>32 then 50 else v_league.cut_percent end,v_n,v_q,
    case when v_n>32 then true else (v_n-v_q)>=4 end,v_uid,
    jsonb_build_object(
      'formula',case when v_n>32 then 'four-conferences-top-4-bottom-4' else 'min(16,ceil(n*(100-cut)/100))' end,
      'toilet_cap',16,'engine','server-v3','immutable',true,'conference_based',v_n>32
    )
  ) returning id into v_snapshot;

  with base as (
    select m.*,
      coalesce(nullif(trim(m.display_name_override),''),nullif(trim(p.display_name),''),'Player') display_name,
      coalesce(m.total_points,0)-coalesce(m.deployment_credit,0) earned_points,
      coalesce(array_length(m.weekly_points,1),0) played
    from public.memberships m join public.profiles p on p.id=m.user_id
    where m.league_id=p_league_id and not coalesce(m.is_bot,false)
  ), h2h as (
    select a.user_id,coalesce(sum(case when x.aw>x.bw then 1 when x.aw<x.bw then -1 else 0 end),0) h2h_wins
    from base a left join base b on b.user_id<>a.user_id and b.earned_points=a.earned_points
    left join lateral (
      select count(*) filter(where av>bv) aw,count(*) filter(where av<bv) bw
      from unnest(coalesce(a.weekly_points,array[]::integer[]),coalesce(b.weekly_points,array[]::integer[])) z(av,bv)
    ) x on true group by a.user_id
  ), ordered as (
    select b.*,row_number() over(order by
      b.earned_points desc,h.h2h_wins desc,
      case when b.ats_total>0 then b.ats_correct::numeric/b.ats_total else 0 end desc,
      case when b.weeks_played>0 then b.earned_points::numeric/b.weeks_played else 0 end desc,
      b.best_week desc,b.current_streak desc,
      case when b.best_bet_total>0 then b.best_bet_hits::numeric/b.best_bet_total else 0 end desc,
      b.display_name,b.user_id) overall_rank,
      row_number() over(partition by b.division order by
        b.earned_points desc,h.h2h_wins desc,b.display_name,b.user_id) division_rank,
      count(*) over(partition by b.division) division_count
    from base b join h2h h using(user_id)
  ), classified as (
    select o.*,
      case when v_n>32 and division_rank<=4 then 'championship'
           when v_n>32 and division_rank>division_count-4 then 'toilet'
           when v_n<=32 and overall_rank<=v_q then 'championship'
           when v_n<=32 and (v_n-v_q)>=4 and overall_rank>v_n-least(16,v_n-v_q) then 'toilet'
           else 'eliminated' end field
    from ordered o
  ), seeded as (
    select c.*,
      case when field='championship' then row_number() over(partition by field order by overall_rank)
           when field='toilet' then row_number() over(partition by field order by overall_rank desc)
           else null end field_seed,
      count(*) over(partition by field) field_count
    from classified c
  )
  insert into public.league_postseason_participants(
    snapshot_id,user_id,display_name_snapshot,field,seed,first_round_bye,
    division_snapshot,standings_rank_at_cut,season_points_at_cut
  ) select v_snapshot,user_id,display_name,field,field_seed,
      field_seed is not null and field_seed<=case
        when field_count<=2 then 2-field_count
        when field_count<=4 then 4-field_count
        when field_count<=8 then 8-field_count
        when field_count<=16 then 16-field_count else 32-field_count end,
      division::text,overall_rank,earned_points
    from seeded order by overall_rank;

  return v_snapshot;
end;
$$;

revoke all on function public.freeze_postseason_snapshot_if_absent(uuid,text) from public,anon,authenticated;

create or replace function public.freeze_postseason_after_cut_score()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare v_cut integer;
begin
  select regular_season_weeks into v_cut from public.leagues where id=new.league_id;
  if new.week_number=v_cut then perform public.freeze_postseason_snapshot_if_absent(new.league_id,null); end if;
  return null;
end; $$;

drop trigger if exists freeze_postseason_after_cut_score on public.week_results;
create constraint trigger freeze_postseason_after_cut_score
after insert or update on public.week_results deferrable initially deferred
for each row execute function public.freeze_postseason_after_cut_score();

revoke all on function public.freeze_postseason_after_cut_score() from public,anon,authenticated;

create or replace function public.clear_postseason_snapshot_on_season_reset()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.current_week=0 and old.current_week<>0 then
    delete from public.league_postseason_snapshots where league_id=new.id;
  end if;
  return new;
end; $$;

drop trigger if exists clear_postseason_snapshot_on_season_reset on public.leagues;
create trigger clear_postseason_snapshot_on_season_reset
after update of current_week on public.leagues for each row
execute function public.clear_postseason_snapshot_on_season_reset();

revoke all on function public.clear_postseason_snapshot_on_season_reset() from public,anon,authenticated;

notify pgrst, 'reload schema';
