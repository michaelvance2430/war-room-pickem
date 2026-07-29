-- War Room Pick'Em — Supabase schema
-- Run in Supabase → SQL Editor → New query → Run

create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.leagues (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text not null unique,
  commissioner_id uuid not null references public.profiles (id) on delete cascade,
  cut_percent int not null default 50 check (cut_percent between 10 and 75),
  regular_season_weeks int not null default 18 check (regular_season_weeks between 4 and 24),
  games_per_week int not null default 5,
  current_week int not null default 1,
  created_at timestamptz not null default now()
);

create index if not exists leagues_code_idx on public.leagues (code);

do $$ begin
  create type public.member_role as enum ('commissioner', 'player');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.division as enum ('North', 'South', 'East', 'West');
exception when duplicate_object then null;
end $$;

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.member_role not null default 'player',
  division public.division not null default 'North',
  total_points int not null default 0,
  weekly_points int[] not null default '{}',
  ats_correct int not null default 0,
  ats_total int not null default 0,
  current_streak int not null default 0,
  best_week int not null default 0,
  worst_week int not null default 0,
  perfect_weeks int not null default 0,
  best_bet_hits int not null default 0,
  best_bet_total int not null default 0,
  prop_hits int not null default 0,
  prop_total int not null default 0,
  weeks_played int not null default 0,
  joined_at timestamptz not null default now(),
  unique (league_id, user_id)
);

create index if not exists memberships_league_idx on public.memberships (league_id);
create index if not exists memberships_user_idx on public.memberships (user_id);

create table if not exists public.week_cards (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  week_number int not null,
  lock_time text,
  prop_question text,
  prop_option_a text,
  prop_option_b text,
  prop_points int not null default 3,
  published_at timestamptz not null default now(),
  unique (league_id, week_number)
);

create table if not exists public.card_games (
  id uuid primary key default gen_random_uuid(),
  week_card_id uuid not null references public.week_cards (id) on delete cascade,
  sort_order int not null default 0,
  away_team text not null,
  home_team text not null,
  spread numeric not null,
  favorite text not null check (favorite in ('home', 'away')),
  start_time text,
  bookmaker text
);

create index if not exists card_games_card_idx on public.card_games (week_card_id);

create table if not exists public.picks (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  week_number int not null,
  prop_choice text,
  best_bet_game_id uuid references public.card_games (id) on delete set null,
  locked_at timestamptz,
  total_points int,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (league_id, user_id, week_number)
);

create table if not exists public.pick_games (
  id uuid primary key default gen_random_uuid(),
  pick_id uuid not null references public.picks (id) on delete cascade,
  card_game_id uuid not null references public.card_games (id) on delete cascade,
  side text not null check (side in ('home', 'away')),
  confidence int not null check (confidence between 1 and 5),
  is_best_bet boolean not null default false,
  locked_spread numeric,
  locked_favorite text,
  unique (pick_id, card_game_id)
);

create table if not exists public.week_results (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  week_number int not null,
  prop_result text,
  scored_at timestamptz not null default now(),
  unique (league_id, week_number)
);

create table if not exists public.game_results (
  id uuid primary key default gen_random_uuid(),
  week_result_id uuid not null references public.week_results (id) on delete cascade,
  card_game_id uuid not null references public.card_games (id) on delete cascade,
  winner text not null check (winner in ('home', 'away', 'push')),
  unique (week_result_id, card_game_id)
);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1))
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.leagues enable row level security;
alter table public.memberships enable row level security;
alter table public.week_cards enable row level security;
alter table public.card_games enable row level security;
alter table public.picks enable row level security;
alter table public.pick_games enable row level security;
alter table public.week_results enable row level security;
alter table public.game_results enable row level security;

create policy "Profiles viewable authenticated"
  on public.profiles for select to authenticated using (true);
create policy "Users update own profile"
  on public.profiles for update to authenticated using (auth.uid() = id);

create policy "Leagues readable authenticated"
  on public.leagues for select to authenticated using (true);
create policy "Users create leagues"
  on public.leagues for insert to authenticated
  with check (auth.uid() = commissioner_id);
create policy "Commissioner updates league"
  on public.leagues for update to authenticated
  using (auth.uid() = commissioner_id);

create policy "Memberships readable by league mates"
  on public.memberships for select to authenticated using (
    exists (
      select 1 from public.memberships m
      where m.league_id = memberships.league_id and m.user_id = auth.uid()
    )
  );
create policy "Users insert own membership"
  on public.memberships for insert to authenticated
  with check (auth.uid() = user_id);
create policy "Commissioner updates memberships"
  on public.memberships for update to authenticated
  using (
    exists (
      select 1 from public.leagues l
      where l.id = league_id and l.commissioner_id = auth.uid()
    )
  );

create policy "Members read week cards"
  on public.week_cards for select to authenticated using (
    exists (
      select 1 from public.memberships m
      where m.league_id = week_cards.league_id and m.user_id = auth.uid()
    )
  );
create policy "Commissioner manages week cards"
  on public.week_cards for all to authenticated
  using (
    exists (
      select 1 from public.leagues l
      where l.id = league_id and l.commissioner_id = auth.uid()
    )
  );

create policy "Members read card games"
  on public.card_games for select to authenticated using (
    exists (
      select 1 from public.week_cards wc
      join public.memberships m on m.league_id = wc.league_id
      where wc.id = card_games.week_card_id and m.user_id = auth.uid()
    )
  );
create policy "Commissioner manages card games"
  on public.card_games for all to authenticated
  using (
    exists (
      select 1 from public.week_cards wc
      join public.leagues l on l.id = wc.league_id
      where wc.id = week_card_id and l.commissioner_id = auth.uid()
    )
  );

create policy "Users manage own picks"
  on public.picks for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
create policy "Members view league picks"
  on public.picks for select to authenticated using (
    exists (
      select 1 from public.memberships m
      where m.league_id = picks.league_id and m.user_id = auth.uid()
    )
  );

create policy "Users manage own pick_games"
  on public.pick_games for all to authenticated
  using (
    exists (select 1 from public.picks p where p.id = pick_id and p.user_id = auth.uid())
  );
create policy "Members read pick_games"
  on public.pick_games for select to authenticated using (
    exists (
      select 1 from public.picks p
      join public.memberships m on m.league_id = p.league_id
      where p.id = pick_id and m.user_id = auth.uid()
    )
  );

create policy "Members read week results"
  on public.week_results for select to authenticated using (
    exists (
      select 1 from public.memberships m
      where m.league_id = week_results.league_id and m.user_id = auth.uid()
    )
  );
create policy "Commissioner manages week results"
  on public.week_results for all to authenticated
  using (
    exists (
      select 1 from public.leagues l
      where l.id = league_id and l.commissioner_id = auth.uid()
    )
  );

create policy "Members read game results"
  on public.game_results for select to authenticated using (
    exists (
      select 1 from public.week_results wr
      join public.memberships m on m.league_id = wr.league_id
      where wr.id = game_results.week_result_id and m.user_id = auth.uid()
    )
  );
create policy "Commissioner manages game results"
  on public.game_results for all to authenticated
  using (
    exists (
      select 1 from public.week_results wr
      join public.leagues l on l.id = wr.league_id
      where wr.id = week_result_id and l.commissioner_id = auth.uid()
    )
  );

-- Announcements (also in announcements.sql for incremental runs)
create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists announcements_league_idx on public.announcements (league_id, created_at desc);
create table if not exists public.announcement_reads (
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);
