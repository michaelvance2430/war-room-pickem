-- ============================================================
-- Lazy commissioner: auto-post week card + two-strike gavel pass
-- Run once in Supabase → SQL Editor → Run (safe to re-run)
--
-- App cron: /api/cron/auto-publish-card
-- If no card 48h before first kickoff → system posts a 5-game slate.
-- Two consecutive auto-posts → commissioner passes to 1st place human.
-- ============================================================

alter table public.leagues
  add column if not exists auto_publish_streak int not null default 0;

alter table public.leagues
  add column if not exists last_auto_publish_week int;

alter table public.week_cards
  add column if not exists auto_published boolean not null default false;

comment on column public.leagues.auto_publish_streak is
  'Consecutive weeks the system auto-posted the card for a lazy commissioner. Reset on human publish or after gavel pass.';

comment on column public.leagues.last_auto_publish_week is
  'Last pick''em week number that was auto-published (for consecutive-week streak).';

comment on column public.week_cards.auto_published is
  'True when the system posted this card because commissioner missed the 48h deadline.';

-- System transfer (service role / security definer — no auth.uid owner check)
create or replace function public.transfer_commissioner_system(
  p_league_id uuid,
  p_new_commissioner_id uuid,
  p_reason text default null
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old uuid;
  v_new_name text;
begin
  if p_league_id is null or p_new_commissioner_id is null then
    return json_build_object('ok', false, 'error', 'Missing league or user');
  end if;

  select commissioner_id into v_old
  from public.leagues
  where id = p_league_id;

  if v_old is null then
    return json_build_object('ok', false, 'error', 'League not found');
  end if;

  if v_old = p_new_commissioner_id then
    return json_build_object('ok', false, 'error', 'Already commissioner');
  end if;

  if not exists (
    select 1 from public.memberships m
    where m.league_id = p_league_id
      and m.user_id = p_new_commissioner_id
      and coalesce(m.is_bot, false) = false
  ) then
    return json_build_object('ok', false, 'error', 'New commissioner must be a human member');
  end if;

  update public.memberships
  set role = 'player'
  where league_id = p_league_id and user_id = v_old;

  update public.memberships
  set role = 'commissioner'
  where league_id = p_league_id and user_id = p_new_commissioner_id;

  update public.leagues
  set
    commissioner_id = p_new_commissioner_id,
    auto_publish_streak = 0,
    last_auto_publish_week = null
  where id = p_league_id;

  select coalesce(p.display_name, 'Player')
  into v_new_name
  from public.profiles p
  where p.id = p_new_commissioner_id;

  return json_build_object(
    'ok', true,
    'oldCommissionerId', v_old,
    'newCommissionerId', p_new_commissioner_id,
    'newCommissionerName', coalesce(v_new_name, 'Player'),
    'reason', p_reason
  );
end;
$$;

revoke all on function public.transfer_commissioner_system(uuid, uuid, text) from public;
-- Callable only with service role in practice (not granted to authenticated)
grant execute on function public.transfer_commissioner_system(uuid, uuid, text) to service_role;

notify pgrst, 'reload schema';
