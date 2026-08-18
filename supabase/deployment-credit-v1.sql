-- Deployment Credit v1
-- Server-authoritative late-join credit and eligibility boundary.

alter table public.leagues
  add column if not exists late_join_policy text not null default 'reinforcement_credit';

alter table public.leagues
  drop constraint if exists leagues_late_join_policy_check;
alter table public.leagues
  add constraint leagues_late_join_policy_check
  check (late_join_policy in ('reinforcement_credit', 'zero_backfill', 'closed_roster'));

alter table public.memberships
  add column if not exists deployment_credit integer not null default 0;
alter table public.memberships
  add column if not exists deployment_credit_breakdown jsonb not null default '[]'::jsonb;
alter table public.memberships
  add column if not exists eligible_from_week integer not null default 0;

alter table public.memberships
  drop constraint if exists memberships_deployment_credit_nonnegative;
alter table public.memberships
  add constraint memberships_deployment_credit_nonnegative
  check (deployment_credit >= 0);

alter table public.memberships
  drop constraint if exists memberships_eligible_from_week_nonnegative;
alter table public.memberships
  add constraint memberships_eligible_from_week_nonnegative
  check (eligible_from_week >= 0);

create or replace function public.deployment_credit_summary(p_league_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_policy text;
  v_week integer;
  v_qualifying integer;
  v_bottom_count integer;
  v_credit integer;
  v_total integer := 0;
  v_weeks jsonb := '[]'::jsonb;
begin
  select l.late_join_policy
    into v_policy
  from public.leagues l
  where l.id = p_league_id;

  if not found or v_policy <> 'reinforcement_credit' then
    return jsonb_build_object('total', 0, 'weeks', v_weeks);
  end if;

  for v_week in
    select distinct wr.week_number
    from public.week_results wr
    where wr.league_id = p_league_id
      and wr.week_number >= 0
    order by wr.week_number
  loop
    select count(*)::integer
      into v_qualifying
    from public.picks p
    join public.memberships m
      on m.league_id = p.league_id
     and m.user_id = p.user_id
    where p.league_id = p_league_id
      and p.week_number = v_week
      and p.locked_at is not null
      and p.total_points is not null
      and p.total_points > 0
      and coalesce(m.is_bot, false) = false;

    if v_qualifying = 0 then
      v_credit := 0;
      v_bottom_count := 0;
    else
      v_bottom_count := greatest(1, ceil(v_qualifying * 0.15)::integer);
      select floor(avg(q.score))::integer
        into v_credit
      from (
        select p.total_points::numeric as score
        from public.picks p
        join public.memberships m
          on m.league_id = p.league_id
         and m.user_id = p.user_id
        where p.league_id = p_league_id
          and p.week_number = v_week
          and p.locked_at is not null
          and p.total_points is not null
          and p.total_points > 0
          and coalesce(m.is_bot, false) = false
        order by p.total_points, p.user_id
        limit v_bottom_count
      ) q;
      v_credit := greatest(0, coalesce(v_credit, 0));
    end if;

    v_total := v_total + v_credit;
    v_weeks := v_weeks || jsonb_build_array(jsonb_build_object(
      'weekNumber', v_week,
      'qualifyingPlayers', v_qualifying,
      'bottomCount', v_bottom_count,
      'credit', v_credit
    ));
  end loop;

  return jsonb_build_object('total', v_total, 'weeks', v_weeks);
end;
$$;

comment on function public.deployment_credit_summary(uuid) is
  'Bottom-15% Deployment Credit by completed week. Excludes bots, zeroes, and unlocked/no-submission slips.';

revoke all on function public.deployment_credit_summary(uuid) from public, anon, authenticated;

create or replace function public.apply_deployment_credit_on_join()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_league public.leagues%rowtype;
  v_summary jsonb;
  v_active_card boolean;
begin
  if coalesce(new.is_bot, false) or new.role = 'commissioner' then
    return new;
  end if;

  select * into v_league
  from public.leagues l
  where l.id = new.league_id
  for share;

  if not found then
    raise exception 'League not found';
  end if;

  if v_league.current_week > v_league.regular_season_weeks then
    raise exception 'Roster closed: postseason has begun';
  end if;

  if v_league.late_join_policy = 'closed_roster'
     and exists (
       select 1 from public.week_cards wc
       where wc.league_id = new.league_id and wc.published_at is not null
     ) then
    raise exception 'Roster closed: late joining is disabled';
  end if;

  select exists (
    select 1 from public.week_cards wc
    where wc.league_id = new.league_id
      and wc.week_number = v_league.current_week
      and wc.published_at is not null
  ) into v_active_card;

  new.eligible_from_week := greatest(
    0,
    v_league.current_week + case when v_active_card then 1 else 0 end
  );

  if v_league.late_join_policy = 'reinforcement_credit' then
    v_summary := public.deployment_credit_summary(new.league_id);
    new.deployment_credit := greatest(0, coalesce((v_summary ->> 'total')::integer, 0));
    new.deployment_credit_breakdown := coalesce(v_summary -> 'weeks', '[]'::jsonb);
  else
    new.deployment_credit := 0;
    new.deployment_credit_breakdown := '[]'::jsonb;
  end if;

  new.total_points := new.deployment_credit;
  new.weeks_played := 0;
  return new;
end;
$$;

revoke all on function public.apply_deployment_credit_on_join() from public, anon, authenticated;

drop trigger if exists memberships_apply_deployment_credit_on_join on public.memberships;
create trigger memberships_apply_deployment_credit_on_join
before insert on public.memberships
for each row execute function public.apply_deployment_credit_on_join();

create or replace function public.preserve_deployment_credit_in_total()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_earned integer;
begin
  if new.total_points is not distinct from old.total_points
     and new.deployment_credit is not distinct from old.deployment_credit then
    return new;
  end if;

  if greatest(coalesce(old.deployment_credit, 0), coalesce(new.deployment_credit, 0)) = 0 then
    return new;
  end if;

  select coalesce(sum(p.total_points), 0)::integer
    into v_earned
  from public.picks p
  join public.week_results wr
    on wr.league_id = p.league_id
   and wr.week_number = p.week_number
  where p.league_id = new.league_id
    and p.user_id = new.user_id
    and p.locked_at is not null
    and p.total_points is not null;

  new.total_points := greatest(0, coalesce(new.deployment_credit, 0)) + greatest(0, v_earned);
  return new;
end;
$$;

revoke all on function public.preserve_deployment_credit_in_total() from public, anon, authenticated;

drop trigger if exists memberships_preserve_deployment_credit_in_total on public.memberships;
create trigger memberships_preserve_deployment_credit_in_total
before update of total_points, deployment_credit on public.memberships
for each row execute function public.preserve_deployment_credit_in_total();

create or replace function public.enforce_membership_week_eligibility()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_eligible integer;
begin
  select m.eligible_from_week into v_eligible
  from public.memberships m
  where m.league_id = new.league_id
    and m.user_id = new.user_id;

  if found and new.week_number < coalesce(v_eligible, 0) then
    raise exception 'Deployment pending: eligible beginning Week %', v_eligible;
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_membership_week_eligibility() from public, anon, authenticated;

drop trigger if exists picks_enforce_membership_week_eligibility on public.picks;
create trigger picks_enforce_membership_week_eligibility
before insert or update of week_number on public.picks
for each row execute function public.enforce_membership_week_eligibility();

create or replace function public.lock_late_join_policy()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.is_open is true and new.late_join_policy <> 'reinforcement_credit' then
    raise exception 'Public-lobby leagues require Reinforcement Credit';
  end if;
  if tg_op = 'UPDATE'
     and new.late_join_policy is distinct from old.late_join_policy then
    raise exception 'Late-join policy is locked when the league is created';
  end if;
  return new;
end;
$$;

revoke all on function public.lock_late_join_policy() from public, anon, authenticated;

drop trigger if exists leagues_lock_late_join_policy on public.leagues;
create trigger leagues_lock_late_join_policy
before insert or update of late_join_policy, is_open on public.leagues
for each row execute function public.lock_late_join_policy();

create or replace function public.clear_deployment_credit_on_season_reset()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.current_week = 0 then
    update public.memberships m
    set deployment_credit = 0,
        deployment_credit_breakdown = '[]'::jsonb,
        eligible_from_week = 0,
        total_points = 0
    where m.league_id = new.id;

    delete from public.fair_entry_band_freezes f
    where f.league_id = new.id;
  end if;
  return new;
end;
$$;

revoke all on function public.clear_deployment_credit_on_season_reset() from public, anon, authenticated;

drop trigger if exists leagues_clear_deployment_credit_on_season_reset on public.leagues;
create trigger leagues_clear_deployment_credit_on_season_reset
after update of current_week on public.leagues
for each row execute function public.clear_deployment_credit_on_season_reset();

-- Keep legacy join RPCs source-compatible while replacing their old percentile
-- resolver with the new completed-week calculation.
create or replace function public.d1b_b_fair_entry_points(
  p_league_id uuid,
  p_exclude_user_id uuid default null
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select greatest(0, coalesce((public.deployment_credit_summary(p_league_id) ->> 'total')::integer, 0));
$$;

revoke all on function public.d1b_b_fair_entry_points(uuid, uuid) from public, anon, authenticated;

create or replace function public.d1b_b_fair_entry_points(p_league_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select public.d1b_b_fair_entry_points(p_league_id, auth.uid());
$$;

revoke all on function public.d1b_b_fair_entry_points(uuid) from public, anon, authenticated;
