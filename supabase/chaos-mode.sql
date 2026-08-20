-- Legacy is_chaos flag: regular-season AI catch-up card, +50% earned points.
-- Run once in Supabase SQL Editor

alter table public.picks
  add column if not exists is_chaos boolean not null default false;

comment on column public.picks.is_chaos is
  'True when player authorized a sealed regular-season catch-up weapon card (+50% of points earned, no negative scoring).';

-- Optional index for board flames
create index if not exists picks_league_week_chaos_idx
  on public.picks (league_id, week_number)
  where is_chaos = true;
