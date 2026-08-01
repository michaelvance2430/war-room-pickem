-- ============================================================
-- PASTE THIS WHOLE FILE into Supabase → SQL Editor → Run
-- Project: war-room-pickem (PRODUCTION)
-- Fixes: create NFL room flashes red then stays CFB green
-- Safe to re-run. Does NOT require crystal_ball_enabled.
-- ============================================================

-- 1) Sport column (DB default is cfb — that's the flip)
alter table public.leagues
  add column if not exists sport_id text not null default 'cfb';

alter table public.leagues
  add column if not exists sport_settings jsonb not null default '{}'::jsonb;

comment on column public.leagues.sport_id is
  'Sport pack id: cfb, nfl, nba, …';

create index if not exists leagues_sport_id_idx
  on public.leagues (sport_id);

-- Optional: add crystal ball column if you want it later (app works without it)
alter table public.leagues
  add column if not exists crystal_ball_enabled boolean default true;

-- 2) Commissioner can update their league (including sport_id)
do $$
begin
  alter table public.leagues enable row level security;
exception when others then null;
end $$;

drop policy if exists "leagues_commish_update_sport" on public.leagues;

create policy "leagues_commish_update_sport"
  on public.leagues
  for update
  to authenticated
  using (commissioner_id = auth.uid())
  with check (commissioner_id = auth.uid());

-- 3) List your rooms + sport (NO crystal_ball column required)
select id, name, code, sport_id, created_at
from public.leagues
order by created_at desc
limit 20;

-- 4) FIX rooms that should be NFL
--    Option A — names that look NFL (edit if needed):
update public.leagues
set sport_id = 'nfl'
where lower(coalesce(name, '')) like '%nfl%'
   or lower(coalesce(name, '')) like '%sunday%'
   or lower(coalesce(name, '')) like '%pro football%';

--    Option B — by invite code (uncomment + put YOUR code):
-- update public.leagues
-- set sport_id = 'nfl'
-- where code = 'ABC123';

--    Option C — by id from step 3 results (uncomment + paste uuid):
-- update public.leagues
-- set sport_id = 'nfl'
-- where id = 'PASTE-LEAGUE-UUID-HERE';

-- 5) Confirm NFL rooms
select id, name, code, sport_id, created_at
from public.leagues
where sport_id = 'nfl'
order by created_at desc;

-- 6) Reload API so inserts/updates see sport_id
notify pgrst, 'reload schema';

-- ============================================================
-- AFTER:
-- Hard-refresh phone app → open / create NFL room → should stay navy/crimson
-- If still green: run Option B/C with your exact code or id from step 3
-- ============================================================
