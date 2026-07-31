-- Chaos Mode: pure random card, 2× week points, visible to the room
-- Run once in Supabase SQL Editor

alter table public.picks
  add column if not exists is_chaos boolean not null default false;

comment on column public.picks.is_chaos is
  'True when player locked Chaos Mode (pure random card, 2x week points).';

-- Optional index for board flames
create index if not exists picks_league_week_chaos_idx
  on public.picks (league_id, week_number)
  where is_chaos = true;
