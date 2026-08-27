-- Crew continuity v1
-- Permanent Crew identity; seasons and sports are chapters with no expiry.
-- A new sport continues the source Crew when at least 50% of the source
-- chapter's human roster (minimum 3, commissioner included) opts in.

create schema if not exists private;

drop function if exists public.seed_bot_sport_pool_votes(uuid);

create table if not exists public.crews (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  founded_at timestamptz not null default now(),
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.crew_members (
  crew_id uuid not null references public.crews (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  role text not null default 'member' check (role in ('commissioner', 'member')),
  primary key (crew_id, user_id)
);

create index if not exists crew_members_user_idx
  on public.crew_members (user_id);

create table if not exists public.crew_seasons (
  id uuid primary key default gen_random_uuid(),
  crew_id uuid not null references public.crews (id) on delete cascade,
  league_id uuid not null references public.leagues (id) on delete cascade,
  sport_id text not null,
  season_year int not null,
  status text not null default 'active' check (status in ('active', 'complete')),
  league_name text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique (league_id)
);

create index if not exists crew_seasons_crew_idx
  on public.crew_seasons (crew_id);

alter table public.leagues
  add column if not exists crew_id uuid references public.crews (id) on delete set null;

create index if not exists leagues_crew_id_idx
  on public.leagues (crew_id);

alter table public.sport_pool_polls
  add column if not exists source_member_count int;
alter table public.sport_pool_polls
  add column if not exists continuity_required int;
alter table public.sport_pool_polls
  add column if not exists crew_continues boolean;

update public.sport_pool_polls p
set source_member_count = source_counts.humans,
    continuity_required = greatest(3, ceil(source_counts.humans / 2.0)::int)
from (
  select m.league_id, count(*)::int as humans
  from public.memberships m
  where coalesce(m.is_bot, false) = false
  group by m.league_id
) source_counts
where p.source_league_id = source_counts.league_id
  and p.source_member_count is null;

alter table public.sport_pool_polls
  alter column source_member_count set default 0;
alter table public.sport_pool_polls
  alter column source_member_count set not null;
alter table public.sport_pool_polls
  alter column continuity_required set default 3;
alter table public.sport_pool_polls
  alter column continuity_required set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'sport_pool_source_member_count_nonnegative'
      and conrelid = 'public.sport_pool_polls'::regclass
  ) then
    alter table public.sport_pool_polls
      add constraint sport_pool_source_member_count_nonnegative
      check (source_member_count >= 0);
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'sport_pool_continuity_required_minimum'
      and conrelid = 'public.sport_pool_polls'::regclass
  ) then
    alter table public.sport_pool_polls
      add constraint sport_pool_continuity_required_minimum
      check (continuity_required >= 3);
  end if;
end $$;

create or replace function private.snapshot_sport_pool_roster()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog
as $$
declare
  v_uid uuid := auth.uid();
  v_humans int;
begin
  if v_uid is null or new.commissioner_id is distinct from v_uid then
    raise exception 'sport_pool:commissioner_only' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.leagues l
    where l.id = new.source_league_id and l.commissioner_id = v_uid
  ) then
    raise exception 'sport_pool:commissioner_only' using errcode = '42501';
  end if;

  select count(*)::int into v_humans
  from public.memberships m
  where m.league_id = new.source_league_id
    and coalesce(m.is_bot, false) = false;

  new.source_member_count := v_humans;
  new.continuity_required := greatest(3, ceil(v_humans / 2.0)::int);
  new.crew_continues := null;
  return new;
end;
$$;

drop trigger if exists snapshot_sport_pool_roster on public.sport_pool_polls;
create trigger snapshot_sport_pool_roster
before insert on public.sport_pool_polls
for each row execute function private.snapshot_sport_pool_roster();

revoke all on function private.snapshot_sport_pool_roster() from public;

alter table public.crews enable row level security;
alter table public.crew_members enable row level security;
alter table public.crew_seasons enable row level security;

create or replace function private.is_crew_member(p_crew_id uuid)
returns boolean
language sql
stable
security definer
set search_path = pg_catalog
as $$
  select exists (
    select 1 from public.crew_members cm
    where cm.crew_id = p_crew_id and cm.user_id = auth.uid()
  );
$$;

revoke all on function private.is_crew_member(uuid) from public;
grant execute on function private.is_crew_member(uuid) to authenticated;

drop policy if exists "Crew members read crews" on public.crews;
create policy "Crew members read crews"
on public.crews for select to authenticated
using ((select private.is_crew_member(id)));

drop policy if exists "Crew members read membership" on public.crew_members;
create policy "Crew members read membership"
on public.crew_members for select to authenticated
using ((select private.is_crew_member(crew_id)));

drop policy if exists "Crew members read seasons" on public.crew_seasons;
create policy "Crew members read seasons"
on public.crew_seasons for select to authenticated
using ((select private.is_crew_member(crew_id)));

revoke insert, update, delete on public.crews from authenticated;
revoke insert, update, delete on public.crew_members from authenticated;
revoke insert, update, delete on public.crew_seasons from authenticated;
grant select on public.crews, public.crew_members, public.crew_seasons to authenticated;

create or replace function public.spin_up_sport_pool_league(p_poll_id uuid)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
  v_poll public.sport_pool_polls%rowtype;
  v_source public.leagues%rowtype;
  v_league_id uuid;
  v_crew_id uuid;
  v_code text;
  v_sport text;
  v_name text;
  v_seats int;
  v_inserted int;
  v_required int;
  v_continues boolean;
  v_try int := 0;
begin
  if v_uid is null then
    raise exception 'sport_pool:not_authenticated' using errcode = '42501';
  end if;
  if p_poll_id is null then
    raise exception 'sport_pool:poll_not_found' using errcode = 'P0002';
  end if;

  select * into v_poll
  from public.sport_pool_polls
  where id = p_poll_id
  for update;

  if not found then
    raise exception 'sport_pool:poll_not_found' using errcode = 'P0002';
  end if;

  select * into v_source
  from public.leagues l
  where l.id = v_poll.source_league_id;

  if v_poll.commissioner_id is distinct from v_uid
     or v_source.commissioner_id is distinct from v_uid then
    raise exception 'sport_pool:commissioner_only' using errcode = '42501';
  end if;

  if v_poll.status = 'spun_up' and v_poll.created_league_id is not null then
    return json_build_object(
      'ok', true,
      'already_created', true,
      'league_id', v_poll.created_league_id,
      'seats', (select count(*) from public.memberships m where m.league_id = v_poll.created_league_id),
      'source_member_count', v_poll.source_member_count,
      'continuity_required', v_poll.continuity_required,
      'crew_continues', coalesce(v_poll.crew_continues, false)
    );
  end if;
  if v_poll.status is distinct from 'open' then
    raise exception 'sport_pool:poll_not_open' using errcode = '23514';
  end if;

  v_sport := lower(trim(coalesce(v_poll.target_sport_id, '')));
  if v_sport not in ('cfb', 'nfl') then
    raise exception 'sport_pool:unsupported_sport' using errcode = '23514';
  end if;
  v_name := trim(coalesce(v_poll.proposed_name, ''));
  if v_name = '' or char_length(v_name) > 80 then
    raise exception 'sport_pool:invalid_name' using errcode = '23514';
  end if;

  select count(distinct seat.user_id)::int into v_seats
  from (
    select v_uid as user_id
    union
    select v.user_id
    from public.sport_pool_votes v
    join public.memberships source_m
      on source_m.league_id = v_poll.source_league_id
     and source_m.user_id = v.user_id
     and coalesce(source_m.is_bot, false) = false
    where v.poll_id = v_poll.id and v.response = 'yes'
  ) seat;

  if v_seats > 100 then
    raise exception 'sport_pool:too_many_seats' using errcode = '23514';
  end if;

  v_required := greatest(3, coalesce(v_poll.continuity_required, ceil(v_poll.source_member_count / 2.0)::int));
  v_continues := v_seats >= v_required;

  if v_continues then
    v_crew_id := v_source.crew_id;
    if v_crew_id is null then
      insert into public.crews (name, created_by)
      values (v_source.name, v_uid)
      returning id into v_crew_id;

      update public.leagues set crew_id = v_crew_id where id = v_source.id;

      insert into public.crew_seasons (
        crew_id, league_id, sport_id, season_year, league_name
      ) values (
        v_crew_id,
        v_source.id,
        coalesce(v_source.sport_id, 'cfb'),
        extract(year from current_date)::int,
        v_source.name
      ) on conflict (league_id) do nothing;

      insert into public.crew_members (crew_id, user_id, role)
      select v_crew_id, m.user_id,
        case when m.user_id = v_uid then 'commissioner' else 'member' end
      from public.memberships m
      where m.league_id = v_source.id
        and coalesce(m.is_bot, false) = false
      on conflict (crew_id, user_id) do nothing;
    end if;
  end if;

  loop
    v_try := v_try + 1;
    v_code := upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));
    exit when not exists (select 1 from public.leagues where code = v_code);
    if v_try >= 20 then
      raise exception 'sport_pool:code_generation_failed';
    end if;
  end loop;

  insert into public.leagues (
    name, code, commissioner_id, sport_id, crystal_ball_enabled,
    current_week, cut_percent, is_open, open_listed_at, max_human_members,
    crew_id
  ) values (
    v_name, v_code, v_uid, v_sport, true,
    0, 50, false, null, 100,
    v_crew_id
  ) returning id into v_league_id;

  with seats as (
    select v_uid as user_id, true as is_commissioner
    union
    select v.user_id, v.user_id = v_uid
    from public.sport_pool_votes v
    join public.memberships source_m
      on source_m.league_id = v_poll.source_league_id
     and source_m.user_id = v.user_id
     and coalesce(source_m.is_bot, false) = false
    where v.poll_id = v_poll.id and v.response = 'yes'
  ), numbered as (
    select distinct user_id, is_commissioner,
      row_number() over (order by is_commissioner desc, user_id) as n
    from seats
  )
  insert into public.memberships (
    league_id, user_id, role, division, total_points, weeks_played,
    is_bot, is_deputy, is_moderator, locker_muted
  )
  select v_league_id, n.user_id,
    case when n.is_commissioner then 'commissioner'::public.member_role else 'player'::public.member_role end,
    (array['North', 'South', 'East', 'West'])[1 + ((n.n - 1) % 4)]::public.division,
    0, 0, false, false, false, false
  from numbered n;
  get diagnostics v_inserted = row_count;

  insert into public.league_first_joins (league_id, user_id, first_joined_at)
  select v_league_id, m.user_id, now()
  from public.memberships m where m.league_id = v_league_id
  on conflict (league_id, user_id) do nothing;

  if v_continues then
    insert into public.crew_seasons (
      crew_id, league_id, sport_id, season_year, league_name
    ) values (
      v_crew_id, v_league_id, v_sport, extract(year from current_date)::int, v_name
    ) on conflict (league_id) do nothing;

    insert into public.crew_members (crew_id, user_id, role)
    select v_crew_id, m.user_id,
      case when m.user_id = v_uid then 'commissioner' else 'member' end
    from public.memberships m
    where m.league_id = v_league_id
    on conflict (crew_id, user_id) do nothing;
  end if;

  update public.sport_pool_polls
  set status = 'spun_up',
      created_league_id = v_league_id,
      closed_at = now(),
      crew_continues = v_continues,
      continuity_required = v_required
  where id = v_poll.id;

  return json_build_object(
    'ok', true,
    'already_created', false,
    'league_id', v_league_id,
    'code', v_code,
    'sport_id', v_sport,
    'name', v_name,
    'seats', v_inserted,
    'source_member_count', v_poll.source_member_count,
    'continuity_required', v_required,
    'crew_continues', v_continues,
    'crew_id', v_crew_id
  );
end;
$$;

revoke all on function public.spin_up_sport_pool_league(uuid) from public;
grant execute on function public.spin_up_sport_pool_league(uuid) to authenticated;

notify pgrst, 'reload schema';
