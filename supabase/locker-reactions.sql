-- ============================================================
-- Locker Room message reactions (react without a full reply)
-- Run once in Supabase SQL Editor (dev / when promoting).
-- Safe to re-run.
-- ============================================================

create table if not exists public.locker_message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.locker_messages (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null check (char_length(emoji) >= 1 and char_length(emoji) <= 16),
  created_at timestamptz not null default now(),
  unique (message_id, user_id, emoji)
);

create index if not exists locker_reactions_message_idx
  on public.locker_message_reactions (message_id);

create index if not exists locker_reactions_user_idx
  on public.locker_message_reactions (user_id);

alter table public.locker_message_reactions enable row level security;

-- Read: league members only
drop policy if exists "Members read locker reactions" on public.locker_message_reactions;
create policy "Members read locker reactions"
  on public.locker_message_reactions for select to authenticated
  using (
    exists (
      select 1
      from public.locker_messages lm
      join public.memberships m on m.league_id = lm.league_id
      where lm.id = locker_message_reactions.message_id
        and m.user_id = auth.uid()
    )
  );

-- Add reaction: own row, member of league, not bot, not muted
drop policy if exists "Members react locker" on public.locker_message_reactions;
create policy "Members react locker"
  on public.locker_message_reactions for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.locker_messages lm
      join public.memberships m on m.league_id = lm.league_id
      where lm.id = locker_message_reactions.message_id
        and m.user_id = auth.uid()
        and coalesce(m.is_bot, false) = false
        and coalesce(m.locker_muted, false) = false
    )
  );

-- Remove own reaction (toggle off)
drop policy if exists "Members remove own locker reaction" on public.locker_message_reactions;
create policy "Members remove own locker reaction"
  on public.locker_message_reactions for delete to authenticated
  using (user_id = auth.uid());

comment on table public.locker_message_reactions is
  'Emoji reactions on locker messages — laugh, fire, cuss energy without a full reply.';
