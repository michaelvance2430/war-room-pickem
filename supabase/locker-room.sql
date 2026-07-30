-- ============================================================
-- Locker Room — league trash-talk board (short messages)
-- Run once in Supabase → SQL Editor → Run
-- ============================================================

create table if not exists public.locker_messages (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  body text not null check (char_length(body) >= 1 and char_length(body) <= 280),
  created_at timestamptz not null default now()
);

create index if not exists locker_messages_league_created_idx
  on public.locker_messages (league_id, created_at desc);

alter table public.locker_messages enable row level security;

drop policy if exists "Members read locker" on public.locker_messages;
create policy "Members read locker"
  on public.locker_messages for select to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.league_id = locker_messages.league_id
        and m.user_id = auth.uid()
    )
  );

drop policy if exists "Members post locker" on public.locker_messages;
create policy "Members post locker"
  on public.locker_messages for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.memberships m
      where m.league_id = locker_messages.league_id
        and m.user_id = auth.uid()
        and coalesce(m.is_bot, false) = false
    )
    and char_length(trim(body)) >= 1
    and char_length(body) <= 280
  );

-- Author or commissioner can delete
drop policy if exists "Author or commish delete locker" on public.locker_messages;
create policy "Author or commish delete locker"
  on public.locker_messages for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.leagues l
      where l.id = locker_messages.league_id
        and l.commissioner_id = auth.uid()
    )
  );
