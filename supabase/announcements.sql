-- War Room Pick'Em — Announcements
-- Run in Supabase → SQL Editor → New query → Run

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  league_id uuid not null references public.leagues (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index if not exists announcements_league_idx
  on public.announcements (league_id, created_at desc);

create table if not exists public.announcement_reads (
  announcement_id uuid not null references public.announcements (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (announcement_id, user_id)
);

create index if not exists announcement_reads_user_idx
  on public.announcement_reads (user_id);

alter table public.announcements enable row level security;
alter table public.announcement_reads enable row level security;

-- Members can read announcements in their leagues
drop policy if exists "Members read announcements" on public.announcements;
create policy "Members read announcements"
  on public.announcements for select to authenticated
  using (
    exists (
      select 1 from public.memberships m
      where m.league_id = announcements.league_id
        and m.user_id = auth.uid()
    )
  );

-- Only the commissioner can post (and update/delete) announcements
drop policy if exists "Commissioner manages announcements" on public.announcements;
create policy "Commissioner manages announcements"
  on public.announcements for all to authenticated
  using (
    exists (
      select 1 from public.leagues l
      where l.id = league_id and l.commissioner_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.leagues l
      where l.id = league_id and l.commissioner_id = auth.uid()
    )
    and author_id = auth.uid()
  );

-- Users can read their own read-receipts
drop policy if exists "Users read own announcement reads" on public.announcement_reads;
create policy "Users read own announcement reads"
  on public.announcement_reads for select to authenticated
  using (user_id = auth.uid());

-- Users can mark announcements as read (only for leagues they belong to)
drop policy if exists "Users insert own announcement reads" on public.announcement_reads;
create policy "Users insert own announcement reads"
  on public.announcement_reads for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.announcements a
      join public.memberships m on m.league_id = a.league_id
      where a.id = announcement_id
        and m.user_id = auth.uid()
    )
  );

-- Allow upsert conflict path (update read_at)
drop policy if exists "Users update own announcement reads" on public.announcement_reads;
create policy "Users update own announcement reads"
  on public.announcement_reads for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
