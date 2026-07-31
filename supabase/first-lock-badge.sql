-- First & Final rare badge support
-- One claim per league per week: first human to fully lock.
-- dirty = true if they later changed their slip.
-- Run once in Supabase SQL Editor.

create table if not exists public.first_lock_claims (
  league_id uuid not null references public.leagues (id) on delete cascade,
  week_number int not null,
  user_id uuid not null references public.profiles (id) on delete cascade,
  locked_at timestamptz not null default now(),
  slip_hash text not null default '',
  dirty boolean not null default false,
  primary key (league_id, week_number)
);

create index if not exists first_lock_claims_user_idx
  on public.first_lock_claims (user_id);

alter table public.first_lock_claims enable row level security;

-- League members can see who claimed first (no pick sides — just the race)
drop policy if exists "Members read first lock claims" on public.first_lock_claims;
create policy "Members read first lock claims"
  on public.first_lock_claims for select to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.league_id = first_lock_claims.league_id
        and m.user_id = auth.uid()
    )
  );

-- Only claim for yourself; insert fails if week already claimed (PK)
drop policy if exists "Users insert own first lock claim" on public.first_lock_claims;
create policy "Users insert own first lock claim"
  on public.first_lock_claims for insert to authenticated
  with check (auth.uid() = user_id);

-- Claim owner can mark dirty / update hash after edits
drop policy if exists "Users update own first lock claim" on public.first_lock_claims;
create policy "Users update own first lock claim"
  on public.first_lock_claims for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
