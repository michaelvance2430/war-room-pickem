-- ========== sport-pool-polls.sql ==========
-- Cross-sport player pool: "Want to play [sport]?" â†’ spin up a new league for the yeses.
-- Run once in Supabase SQL Editor (dev first). Safe to re-run.

create table if not exists public.sport_pool_polls (
  id uuid primary key default gen_random_uuid(),
  source_league_id uuid not null references public.leagues (id) on delete cascade,
  commissioner_id uuid not null references public.profiles (id) on delete cascade,
  target_sport_id text not null default 'nfl',
  proposed_name text not null default 'War Room',
  message text not null default '',
  status text not null default 'open'
    check (status in ('open', 'closed', 'spun_up')),
  created_league_id uuid references public.leagues (id) on delete set null,
  created_at timestamptz not null default now(),
  closed_at timestamptz
);

create index if not exists sport_pool_polls_source_idx
  on public.sport_pool_polls (source_league_id, status);

create index if not exists sport_pool_polls_commish_idx
  on public.sport_pool_polls (commissioner_id, status);

create table if not exists public.sport_pool_votes (
  id uuid primary key default gen_random_uuid(),
  poll_id uuid not null references public.sport_pool_polls (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  response text not null check (response in ('yes', 'no')),
  created_at timestamptz not null default now(),
  unique (poll_id, user_id)
);

create index if not exists sport_pool_votes_poll_idx
  on public.sport_pool_votes (poll_id);

alter table public.sport_pool_polls enable row level security;
alter table public.sport_pool_votes enable row level security;

-- Members of the source league can read open polls for that league
drop policy if exists "sport_pool_polls_select" on public.sport_pool_polls;
create policy "sport_pool_polls_select"
  on public.sport_pool_polls for select to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.league_id = sport_pool_polls.source_league_id
        and m.user_id = auth.uid()
    )
    or commissioner_id = auth.uid()
  );

-- Only commissioner of source league can insert polls
drop policy if exists "sport_pool_polls_insert" on public.sport_pool_polls;
create policy "sport_pool_polls_insert"
  on public.sport_pool_polls for insert to authenticated
  with check (
    commissioner_id = auth.uid()
    and exists (
      select 1 from public.leagues l
      where l.id = source_league_id
        and l.commissioner_id = auth.uid()
    )
  );

-- Commissioner can update their polls (close / spun_up)
drop policy if exists "sport_pool_polls_update" on public.sport_pool_polls;
create policy "sport_pool_polls_update"
  on public.sport_pool_polls for update to authenticated
  using (commissioner_id = auth.uid())
  with check (commissioner_id = auth.uid());

-- Members of source league can vote
drop policy if exists "sport_pool_votes_select" on public.sport_pool_votes;
create policy "sport_pool_votes_select"
  on public.sport_pool_votes for select to authenticated
  using (
    exists (
      select 1 from public.sport_pool_polls p
      join public.memberships m on m.league_id = p.source_league_id
      where p.id = sport_pool_votes.poll_id
        and m.user_id = auth.uid()
    )
    or user_id = auth.uid()
  );

drop policy if exists "sport_pool_votes_upsert" on public.sport_pool_votes;
drop policy if exists "sport_pool_votes_insert" on public.sport_pool_votes;
create policy "sport_pool_votes_insert"
  on public.sport_pool_votes for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.sport_pool_polls p
      join public.memberships m on m.league_id = p.source_league_id
      where p.id = sport_pool_votes.poll_id
        and m.user_id = auth.uid()
        and p.status = 'open'
    )
  );

drop policy if exists "sport_pool_votes_update" on public.sport_pool_votes;
create policy "sport_pool_votes_update"
  on public.sport_pool_votes for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

comment on table public.sport_pool_polls is
  'Commissioner asks the current room if they want a new sport/league; yeses get spun up together.';

-- ============================================================
-- Trial bots answer the poll (practice / padded rooms).
-- RLS only allows voting as yourself â€” commissioner seeds bot votes here.
-- ============================================================
create or replace function public.seed_bot_sport_pool_votes(p_poll_id uuid)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_league uuid;
  v_status text;
  v_bot uuid;
  v_yes int := 0;
  v_no int := 0;
  v_skipped int := 0;
  v_response text;
  v_hash int;
begin
  if v_uid is null then
    return json_build_object('ok', false, 'error', 'Not authenticated');
  end if;

  select p.source_league_id, p.status
    into v_league, v_status
  from public.sport_pool_polls p
  where p.id = p_poll_id;

  if v_league is null then
    return json_build_object('ok', false, 'error', 'Poll not found');
  end if;

  if v_status is distinct from 'open' then
    return json_build_object('ok', false, 'error', 'Poll is not open');
  end if;

  if not exists (
    select 1 from public.leagues l
    where l.id = v_league and l.commissioner_id = v_uid
  ) then
    return json_build_object('ok', false, 'error', 'Commissioner only');
  end if;

  for v_bot in
    select m.user_id
    from public.memberships m
    where m.league_id = v_league
      and coalesce(m.is_bot, false) = true
  loop
    -- ~80% yes / 20% no, stable per poll+bot so re-seed is idempotent flavor
    v_hash := abs(hashtext(p_poll_id::text || v_bot::text));
    if (v_hash % 10) < 8 then
      v_response := 'yes';
    else
      v_response := 'no';
    end if;

    begin
      insert into public.sport_pool_votes (poll_id, user_id, response)
      values (p_poll_id, v_bot, v_response)
      on conflict (poll_id, user_id) do update
        set response = excluded.response;

      if v_response = 'yes' then
        v_yes := v_yes + 1;
      else
        v_no := v_no + 1;
      end if;
    exception when others then
      v_skipped := v_skipped + 1;
    end;
  end loop;

  return json_build_object(
    'ok', true,
    'yes', v_yes,
    'no', v_no,
    'skipped', v_skipped,
    'bots', v_yes + v_no
  );
end;
$$;

revoke all on function public.seed_bot_sport_pool_votes(uuid) from public;
grant execute on function public.seed_bot_sport_pool_votes(uuid) to authenticated;

notify pgrst, 'reload schema';


-- ========== lazy-commish-auto-card.sql ==========
-- ============================================================
-- Lazy commissioner: auto-post week card + two-strike gavel pass
-- Run once in Supabase â†’ SQL Editor â†’ Run (safe to re-run)
--
-- App cron: /api/cron/auto-publish-card
-- If no card 48h before first kickoff â†’ system posts a 5-game slate.
-- Two consecutive auto-posts â†’ commissioner passes to 1st place human.
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

-- System transfer (service role / security definer â€” no auth.uid owner check)
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



